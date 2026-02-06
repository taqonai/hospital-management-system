/**
 * useConsultationScribe - Hook for AI Scribe integration in the consultation workflow.
 * Manages audio recording and calls the authenticated backend API to transcribe
 * and generate structured clinical documentation (SOAP notes, entities, codes).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { aiScribeApi } from '../services/api';

// ============ Types ============

export interface ScribeResults {
  sessionId: string;
  transcript: string;
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null;
  extractedSymptoms: Array<{ type: string; value: string; confidence: number; context?: string }>;
  extractedDiagnoses: Array<{ type: string; value: string; confidence: number; context?: string }>;
  extractedMedications: Array<{ type: string; value: string; confidence: number; context?: string }>;
  icdCodes: Array<{ code: string; description: string; confidence: string; supportingText?: string }>;
  cptCodes: Array<{ code: string; description: string; confidence: string; category?: string }>;
  followUpRecommendations: Array<{ recommendation: string; timeframe?: string; priority?: string }>;
  prescriptionSuggestions: Array<{ medication: string; dosage?: string; frequency?: string; duration?: string; route?: string; reason?: string }>;
}

export type ScribeStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'completed' | 'error';

export interface UseConsultationScribeOptions {
  autoStart?: boolean;
  patientContext: {
    patientId: string;
    patientName: string;
    patientAge: number;
    patientGender: string;
    appointmentId: string;
    existingConditions?: string[];
    currentMedications?: string[];
    knownAllergies?: string[];
  };
}

// ============ Hook ============

export function useConsultationScribe(options: UseConsultationScribeOptions) {
  const { autoStart = true, patientContext } = options;

  // State
  const [scribeStatus, setScribeStatus] = useState<ScribeStatus>('idle');
  const [isEnabled, setIsEnabled] = useState(true);
  const [duration, setDuration] = useState(0);
  const [results, setResults] = useState<ScribeResults | null>(null);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setError('Recording error occurred');
        setScribeStatus('error');
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setScribeStatus('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        if (isMountedRef.current) {
          setDuration(Date.now() - startTimeRef.current);
        }
      }, 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(msg);
      setScribeStatus('idle');
    }
  }, [getSupportedMimeType]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setScribeStatus('paused');
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      const pausedDuration = duration;
      const resumeTime = Date.now();
      timerRef.current = setInterval(() => {
        if (isMountedRef.current) {
          setDuration(pausedDuration + (Date.now() - resumeTime));
        }
      }, 100);
      setScribeStatus('recording');
    }
  }, [duration]);

  // Stop recording and process via the authenticated backend API
  const stopAndProcess = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setScribeStatus('idle');
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setScribeStatus('processing');

    // Wait for recorder to stop and collect audio
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
      setError('No audio recorded. Please speak and try again.');
      setScribeStatus('error');
      isProcessingRef.current = false;
      return;
    }

    try {
      // Build FormData with audio + patient context
      const formData = new FormData();
      const ext = audioBlob.type.includes('webm') ? 'webm' :
                  audioBlob.type.includes('ogg') ? 'ogg' :
                  audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
      formData.append('audio', audioBlob, `consultation-recording.${ext}`);
      formData.append('patientId', patientContext.patientId);
      formData.append('patientName', patientContext.patientName);
      formData.append('patientAge', String(patientContext.patientAge));
      formData.append('patientGender', patientContext.patientGender);
      formData.append('appointmentId', patientContext.appointmentId);
      formData.append('noteType', 'consultation');
      formData.append('generateSoapNote', 'true');
      formData.append('extractEntities', 'true');
      formData.append('suggestIcdCodes', 'true');
      formData.append('suggestCptCodes', 'true');
      formData.append('generateFollowUp', 'true');
      formData.append('generatePrescriptions', 'true');

      if (patientContext.existingConditions?.length) {
        formData.append('existingConditions', JSON.stringify(patientContext.existingConditions));
      }
      if (patientContext.currentMedications?.length) {
        formData.append('currentMedications', JSON.stringify(patientContext.currentMedications));
      }
      if (patientContext.knownAllergies?.length) {
        formData.append('knownAllergies', JSON.stringify(patientContext.knownAllergies));
      }

      const response = await aiScribeApi.transcribeAndGenerate(formData);
      const data = response.data?.data || response.data;

      const scribeResults: ScribeResults = {
        sessionId: data.sessionId || '',
        transcript: data.fullTranscript || data.transcript || '',
        soapNote: data.generatedNote || data.soapNote || null,
        extractedSymptoms: data.extractedEntities?.symptoms || [],
        extractedDiagnoses: data.extractedEntities?.diagnoses || [],
        extractedMedications: data.extractedEntities?.medications || [],
        icdCodes: data.suggestedICD10Codes || data.icdCodes || [],
        cptCodes: data.suggestedCPTCodes || data.cptCodes || [],
        followUpRecommendations: data.followUpRecommendations || [],
        prescriptionSuggestions: data.prescriptionSuggestions || [],
      };

      if (isMountedRef.current) {
        setResults(scribeResults);
        setScribeStatus('completed');
        setError(null);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to process recording';
      if (isMountedRef.current) {
        setError(msg);
        setScribeStatus('error');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [patientContext]);

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
        setScribeStatus('idle');
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
    setScribeStatus('idle');
    setDuration(0);
    setResults(null);
    setError(null);
    isProcessingRef.current = false;
    hasAutoStartedRef.current = false;
  }, []);

  // Auto-start recording when enabled and patient data is available
  useEffect(() => {
    if (
      autoStart &&
      isEnabled &&
      patientContext.patientId &&
      patientContext.appointmentId &&
      !hasAutoStartedRef.current &&
      scribeStatus === 'idle'
    ) {
      hasAutoStartedRef.current = true;
      startRecording();
    }
  }, [autoStart, isEnabled, patientContext.patientId, patientContext.appointmentId, scribeStatus, startRecording]);

  // When toggled back on after being off, start recording
  useEffect(() => {
    if (isEnabled && scribeStatus === 'idle' && hasAutoStartedRef.current) {
      // The user toggled back on — restart recording
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  return {
    scribeStatus,
    isEnabled,
    duration,
    results,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopAndProcess,
    toggleEnabled,
    reset,
  };
}

export default useConsultationScribe;
