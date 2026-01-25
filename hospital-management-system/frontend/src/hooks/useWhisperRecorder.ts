/**
 * useWhisperRecorder - A simple, reliable hook for Whisper voice-to-text
 * Specifically designed for medical transcription in consultation forms
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface WhisperRecorderState {
  isRecording: boolean;
  isProcessing: boolean;
  isAvailable: boolean | null;
  duration: number;
  error: string | null;
}

export interface UseWhisperRecorderOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  maxDuration?: number; // in milliseconds, default 60000 (60s)
  context?: { field?: string; type?: string; currentModule?: string }; // Context for better transcription accuracy
}

export function useWhisperRecorder(options: UseWhisperRecorderOptions = {}) {
  const { onTranscript, onError, maxDuration = 60000, context } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false); // Guard against duplicate processing
  const onTranscriptRef = useRef(onTranscript); // Store callback in ref to avoid stale closures
  const onErrorRef = useRef(onError);

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  // Check Whisper availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response = await fetch(`${API_URL}/ai/transcribe/status`);
        const json = await response.json();
        // Handle wrapped response { success: true, data: { available: true } }
        const available = json.data?.available ?? json.available ?? false;
        setIsAvailable(available);
      } catch (err) {
        console.error('Failed to check Whisper availability:', err);
        setIsAvailable(false);
      }
    };
    checkAvailability();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Get supported MIME type
  const getSupportedMimeType = useCallback(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        const errorMsg = 'Recording error occurred';
        setError(errorMsg);
        onError?.(errorMsg);
        stopRecording();
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Update duration every 100ms
      timerRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);

      // Auto-stop at max duration
      maxDurationTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, maxDuration);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsRecording(false);
    }
  }, [getSupportedMimeType, maxDuration, onError]);

  // Stop recording and process
  const stopRecording = useCallback(async () => {
    // Clear timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setIsRecording(false);
      return;
    }

    // Guard against duplicate processing (React StrictMode, double-clicks, etc.)
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;
    setIsProcessing(true);

    // Create a promise that resolves when recording stops
    const audioBlob = await new Promise<Blob | null>((resolve) => {
      const recorder = mediaRecorderRef.current!;

      recorder.onstop = () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Create blob from chunks and immediately clear them to prevent reprocessing
        if (audioChunksRef.current.length > 0) {
          const chunks = audioChunksRef.current;
          audioChunksRef.current = []; // Clear immediately
          const blob = new Blob(chunks, { type: recorder.mimeType });
          resolve(blob);
        } else {
          resolve(null);
        }
      };

      recorder.stop();
    });

    setIsRecording(false);

    // Process the audio
    if (audioBlob && audioBlob.size > 0) {
      await transcribeAudio(audioBlob);
    } else {
      const errorMsg = 'No audio recorded. Please try again and speak clearly.';
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  }, []);

  // Transcribe audio with Whisper
  const transcribeAudio = useCallback(async (blob: Blob) => {
    try {
      const formData = new FormData();
      // Determine extension from MIME type
      const ext = blob.type.includes('webm') ? 'webm' :
                  blob.type.includes('ogg') ? 'ogg' :
                  blob.type.includes('mp4') ? 'm4a' : 'webm';
      formData.append('audio', blob, `recording.${ext}`);
      formData.append('language', 'en');
      // Use provided context or default to medical context
      const transcriptionContext = context || { field: 'chiefComplaint', type: 'medical' };
      formData.append('context', JSON.stringify(transcriptionContext));

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ai/transcribe`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Transcription failed' }));
        throw new Error(errorData.message || errorData.error || `Server error: ${response.status}`);
      }

      const json = await response.json();
      // Handle wrapped response { success: true, data: { transcript: ... } }
      const data = json.data || json;
      const transcript = data.transcript || '';

      if (transcript) {
        setError(null);
        onTranscriptRef.current?.(transcript);
      } else {
        const errorMsg = 'No speech detected. Please speak clearly and try again.';
        setError(errorMsg);
        onErrorRef.current?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Transcription failed';
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  }, [context]);

  // Toggle recording
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cancel recording without processing
  const cancelRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    audioChunksRef.current = [];
    setIsRecording(false);
    setIsProcessing(false);
    setDuration(0);
  }, []);

  return {
    // State
    isRecording,
    isProcessing,
    isAvailable,
    duration,
    error,

    // Actions
    startRecording,
    stopRecording,
    toggleRecording,
    cancelRecording,
  };
}

// Helper to format duration
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default useWhisperRecorder;
