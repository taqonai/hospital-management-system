import { useState, useRef, useCallback, useEffect } from 'react';
import { aiScribeApi } from '../services/api';

export type AutoScribeStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export interface AutoScribeResult {
  transcript: string;
  chiefComplaint: string;
  extractedSymptoms: Array<{ value: string; confidence: number }>;
}

interface UseAutoScribeOptions {
  enabled: boolean;
  patientId: string | null;
  appointmentId?: string;
}

export function useAutoScribe({ enabled, patientId, appointmentId }: UseAutoScribeOptions) {
  const [status, setStatus] = useState<AutoScribeStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutoScribeResult | null>(null);
  const [isEnabled, setIsEnabled] = useState(enabled);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!isEnabled || status !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(); // Single blob on stop
      setStatus('recording');
      setError(null);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      setError(err.name === 'NotAllowedError'
        ? 'Microphone permission denied. Please allow access and try again.'
        : `Microphone error: ${err.message}`);
    }
  }, [isEnabled, status]);

  const stopAndProcess = useCallback(async () => {
    if (status !== 'recording' || !mediaRecorderRef.current) return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const elapsed = Date.now() - startTimeRef.current;

    // Check minimum duration
    if (elapsed < 2000) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      setStatus('error');
      setError('Recording too short (less than 2 seconds)');
      return;
    }

    setStatus('processing');

    // Wait for recorder to finish and collect the blob
    const audioBlob = await new Promise<Blob>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        resolve(blob);
      };
      recorder.stop();
    });

    // Stop mic
    streamRef.current?.getTracks().forEach(t => t.stop());

    try {
      // Step 1: Transcribe audio via Whisper
      const ext = audioBlob.type.includes('webm') ? 'webm' : 'mp4';
      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${ext}`);
      if (patientId) formData.append('patientId', patientId);
      if (appointmentId) formData.append('appointmentId', appointmentId);

      const transcribeRes = await aiScribeApi.transcribe(formData);
      const transcript = transcribeRes.data?.data?.transcript
        || transcribeRes.data?.transcript
        || '';

      if (!transcript.trim()) {
        setStatus('done');
        setResult({ transcript: '', chiefComplaint: '', extractedSymptoms: [] });
        return;
      }

      // Step 2: Extract entities (symptoms) from transcript
      let extractedSymptoms: Array<{ value: string; confidence: number }> = [];
      try {
        const entityRes = await aiScribeApi.extractEntities({ text: transcript });
        const entities = entityRes.data?.data?.entities
          || entityRes.data?.entities
          || [];
        extractedSymptoms = entities
          .filter((e: any) => e.type === 'symptom' || e.type === 'complaint')
          .map((e: any) => ({ value: e.value, confidence: e.confidence ?? 0.8 }));
      } catch {
        // Entity extraction is optional — transcript alone is enough
      }

      setResult({
        transcript,
        chiefComplaint: transcript,
        extractedSymptoms,
      });
      setStatus('done');
    } catch (err: any) {
      setStatus('error');
      setError(err.response?.data?.message || err.message || 'Failed to process recording');
    }
  }, [status, patientId, appointmentId]);

  const toggle = useCallback(() => {
    if (isEnabled && status === 'recording') {
      // Turning off mid-recording: stop recorder and cleanup
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      chunksRef.current = [];
      setStatus('idle');
      setDuration(0);
    }
    setIsEnabled(prev => !prev);
    setError(null);
  }, [isEnabled, status]);

  return { status, duration, error, result, isEnabled, startRecording, stopAndProcess, toggle };
}
