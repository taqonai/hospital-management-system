import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderResult {
  blob: Blob | null;
  url: string | null;
  duration: number;
}

export interface UseAudioRecorderOptions {
  maxDuration?: number; // Max recording duration in ms
  mimeType?: string;
  onRecordingComplete?: (result: AudioRecorderResult) => void;
  onError?: (error: string) => void;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const {
    maxDuration = 60000, // Default 60 seconds
    mimeType = 'audio/webm',
    onRecordingComplete,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSupportedMimeType = useCallback(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return mimeType;
  }, [mimeType]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      const supportedMimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedMimeType,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Clear intervals/timeouts
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        if (maxDurationTimeoutRef.current) {
          clearTimeout(maxDurationTimeoutRef.current);
          maxDurationTimeoutRef.current = null;
        }

        // Create blob from chunks
        const blob = new Blob(chunksRef.current, { type: supportedMimeType });
        const url = URL.createObjectURL(blob);
        const finalDuration = Date.now() - startTimeRef.current;

        setAudioBlob(blob);
        setAudioUrl(url);
        setIsRecording(false);
        setIsPaused(false);

        onRecordingComplete?.({
          blob,
          url,
          duration: finalDuration,
        });
      };

      mediaRecorder.onerror = () => {
        const errorMessage = 'Recording error occurred';
        setError(errorMessage);
        onError?.(errorMessage);
        setIsRecording(false);
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Update duration every 100ms
      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);

      // Auto-stop at max duration
      maxDurationTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, maxDuration);

    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to access microphone';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [maxDuration, getSupportedMimeType, onRecordingComplete, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume duration tracking
      const pausedDuration = duration;
      startTimeRef.current = Date.now() - pausedDuration;
      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
    }
  }, [duration]);

  const clearRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  }, [audioUrl]);

  return {
    isRecording,
    isPaused,
    audioBlob,
    audioUrl,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  };
}

// Helper to format duration
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
