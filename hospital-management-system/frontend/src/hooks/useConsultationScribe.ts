/**
 * useConsultationScribe - Simplified background AI Scribe for consultation.
 * Records silently, then on stopAndProcess: transcribes via Whisper → generates SOAP via GPT.
 * No pause/resume, no complex results. Just record → process → callback.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { aiScribeApi } from '../services/api';

// ============ Types ============

export type ScribeStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export interface ScribeResult {
  transcript: string;
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}

export interface UseConsultationScribeOptions {
  autoStart?: boolean;
  onComplete?: (result: ScribeResult) => void;
  onError?: (message: string) => void;
}

// ============ Helpers ============

/** Safely convert any GPT response value to a readable string (handles nested dicts, arrays, etc.) */
function ensureString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(v => typeof v === 'string' ? v : String(v)).join('\n');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Try common text keys first
    for (const key of ['text', 'summary', 'content', 'description']) {
      if (typeof obj[key] === 'string') return obj[key] as string;
    }
    // Join all values into readable text (handles GPT sub-structured objects)
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.trim()) {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        parts.push(`${label}: ${v}`);
      } else if (Array.isArray(v)) {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const items = v.filter(Boolean).join(', ');
        if (items) parts.push(`${label}: ${items}`);
      } else if (v && typeof v === 'object') {
        const nested = ensureString(v);
        if (nested) {
          const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          parts.push(`${label}: ${nested}`);
        }
      }
    }
    if (parts.length > 0) return parts.join('\n');
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

// ============ Hook ============

export function useConsultationScribe(options: UseConsultationScribeOptions) {
  const { autoStart = true, onComplete, onError } = options;

  // State
  const [status, setStatus] = useState<ScribeStatus>('idle');
  const [isEnabled, setIsEnabled] = useState(true);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);
  const hasAutoStartedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
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
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onerror = () => {
        if (isMountedRef.current) {
          setError('Recording error occurred');
          setStatus('error');
        }
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setStatus('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        if (isMountedRef.current) setDuration(Date.now() - startTimeRef.current);
      }, 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(msg);
      setStatus('error');
      onError?.(msg);
    }
  }, [getSupportedMimeType, onError]);

  // Stop recording and process: transcribe → generate SOAP → callback
  const stopAndProcess = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setStatus('idle');
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setStatus('processing');

    // Stop recorder and collect audio blob
    const audioBlob = await new Promise<Blob | null>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (audioChunksRef.current.length > 0) {
          const chunks = audioChunksRef.current;
          audioChunksRef.current = [];
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        } else {
          resolve(null);
        }
      };
      recorder.stop();
    });

    if (!audioBlob || audioBlob.size === 0) {
      const msg = 'No audio recorded';
      setError(msg);
      setStatus('error');
      isProcessingRef.current = false;
      onError?.(msg);
      return;
    }

    if (duration < 2000 || audioBlob.size < 1000) {
      const msg = 'Recording too short. Please speak for at least a few seconds.';
      setError(msg);
      setStatus('error');
      isProcessingRef.current = false;
      onError?.(msg);
      return;
    }

    try {
      // Step 1: Transcribe audio via Whisper
      const formData = new FormData();
      const ext = audioBlob.type.includes('webm') ? 'webm' :
                  audioBlob.type.includes('ogg') ? 'ogg' :
                  audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
      formData.append('audio', audioBlob, `consultation-recording.${ext}`);

      const transcribeResponse = await aiScribeApi.transcribe(formData);
      const transcribeData = transcribeResponse.data?.data || transcribeResponse.data;
      const transcript = ensureString(transcribeData?.transcript || transcribeData?.text || transcribeData?.fullTranscript || '');

      if (!transcript.trim()) {
        const msg = 'No speech detected in recording';
        if (isMountedRef.current) {
          setError(msg);
          setStatus('error');
        }
        isProcessingRef.current = false;
        onError?.(msg);
        return;
      }

      // Step 2: Generate SOAP note from transcript
      const noteResponse = await aiScribeApi.generateNote({ text: transcript, noteType: 'consultation' });
      const noteData = noteResponse.data?.data || noteResponse.data;
      const rawSoap = noteData?.soapNote || noteData?.generatedNote || noteData || {};

      const soapNote = {
        subjective: ensureString(rawSoap.subjective),
        objective: ensureString(rawSoap.objective),
        assessment: ensureString(rawSoap.assessment),
        plan: ensureString(rawSoap.plan),
      };

      const result: ScribeResult = { transcript, soapNote };

      if (isMountedRef.current) {
        setStatus('done');
        setError(null);
      }

      onComplete?.(result);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to process recording';
      if (isMountedRef.current) {
        setError(msg);
        setStatus('error');
      }
      onError?.(msg);
    } finally {
      isProcessingRef.current = false;
    }
  }, [duration, onComplete, onError]);

  // Toggle enabled/disabled
  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => {
      const newVal = !prev;
      if (!newVal) {
        // Turning off: stop any active recording and discard audio
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        audioChunksRef.current = [];
        setStatus('idle');
        setDuration(0);
      }
      return newVal;
    });
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    audioChunksRef.current = [];
    setStatus('idle');
    setDuration(0);
    setError(null);
    isProcessingRef.current = false;
    hasAutoStartedRef.current = false;
  }, []);

  // Auto-start recording when enabled
  useEffect(() => {
    if (autoStart && isEnabled && !hasAutoStartedRef.current && status === 'idle') {
      hasAutoStartedRef.current = true;
      startRecording();
    }
  }, [autoStart, isEnabled, status, startRecording]);

  // When toggled back on after being off, restart recording
  useEffect(() => {
    if (isEnabled && status === 'idle' && hasAutoStartedRef.current) {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  return {
    status,
    isEnabled,
    duration,
    error,
    startRecording,
    stopAndProcess,
    toggleEnabled,
    reset,
  };
}

export default useConsultationScribe;
