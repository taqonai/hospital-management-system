import { useState, useCallback, useRef, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useAudioRecorder } from './useAudioRecorder';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface HybridVoiceResult {
  transcript: string;
  confidence: number;
  source: 'web-speech' | 'whisper';
  isFinal: boolean;
}

export interface UseHybridVoiceOptions {
  // Confidence threshold below which to use Whisper
  confidenceThreshold?: number;
  // Always use Whisper (bypass Web Speech)
  alwaysUseWhisper?: boolean;
  // Language code
  language?: string;
  // Callback when transcription is complete
  onResult?: (result: HybridVoiceResult) => void;
  // Callback for errors
  onError?: (error: string) => void;
  // Context for better Whisper accuracy
  context?: Record<string, unknown>;
}

export function useHybridVoice(options: UseHybridVoiceOptions = {}) {
  const {
    confidenceThreshold = 0.8,
    alwaysUseWhisper = false,
    language = 'en-US',
    onResult,
    onError,
    context = {},
  } = options;

  // State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'web-speech' | 'whisper' | null>(null);
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);

  // Refs
  const webSpeechConfidenceRef = useRef<number>(0);

  // Web Speech API
  const {
    transcript: webSpeechTranscript,
    listening: webSpeechListening,
    resetTranscript: resetWebSpeech,
    browserSupportsSpeechRecognition,
    interimTranscript: webSpeechInterim,
  } = useSpeechRecognition();

  // Audio recorder for Whisper
  const {
    audioBlob,
    duration: recordingDuration,
    startRecording,
    stopRecording,
    clearRecording,
  } = useAudioRecorder({
    maxDuration: 30000, // 30 seconds max
    onError: (err) => {
      setError(err);
      onError?.(err);
    },
  });

  // Check Whisper availability on mount
  useEffect(() => {
    const checkWhisper = async () => {
      try {
        const response = await fetch(`${API_URL}/ai/transcribe/status`);
        const data = await response.json();
        setWhisperAvailable(data.available);
      } catch {
        setWhisperAvailable(false);
      }
    };
    checkWhisper();
  }, []);

  // Update interim transcript from Web Speech
  useEffect(() => {
    if (webSpeechListening && webSpeechInterim) {
      setInterimTranscript(webSpeechInterim);
    }
  }, [webSpeechInterim, webSpeechListening]);

  // Transcribe audio using Whisper API
  const transcribeWithWhisper = useCallback(async (blob: Blob): Promise<HybridVoiceResult | null> => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('language', language.split('-')[0]); // 'en-US' -> 'en'
      formData.append('context', JSON.stringify(context));

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ai/transcribe`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Transcription failed');
      }

      const data = await response.json();

      return {
        transcript: data.transcript,
        confidence: data.confidence,
        source: 'whisper',
        isFinal: true,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Whisper transcription failed';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    }
  }, [language, context, onError]);

  // Start listening with hybrid approach
  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setIsListening(true);

    if (alwaysUseWhisper && whisperAvailable) {
      // Use Whisper only
      setSource('whisper');
      await startRecording();
    } else if (browserSupportsSpeechRecognition) {
      // Use Web Speech with Whisper fallback
      setSource('web-speech');
      resetWebSpeech();

      // Start both Web Speech and audio recording (for potential fallback)
      await SpeechRecognition.startListening({
        continuous: false,
        language,
      });

      // Also record audio in case we need Whisper
      if (whisperAvailable) {
        await startRecording();
      }
    } else if (whisperAvailable) {
      // Web Speech not supported, use Whisper
      setSource('whisper');
      await startRecording();
    } else {
      setError('No speech recognition available');
      setIsListening(false);
      onError?.('No speech recognition available');
    }
  }, [
    alwaysUseWhisper,
    whisperAvailable,
    browserSupportsSpeechRecognition,
    startRecording,
    resetWebSpeech,
    language,
    onError,
  ]);

  // Stop listening and process results
  const stopListening = useCallback(async () => {
    setIsProcessing(true);

    // Stop Web Speech
    await SpeechRecognition.stopListening();

    // Stop recording
    stopRecording();

    setIsListening(false);
  }, [stopRecording]);

  // Process results after recording stops
  useEffect(() => {
    const processResults = async () => {
      if (!isProcessing || !audioBlob) return;

      try {
        if (alwaysUseWhisper) {
          // Use Whisper directly
          const result = await transcribeWithWhisper(audioBlob);
          if (result) {
            setTranscript(result.transcript);
            setSource('whisper');
            onResult?.(result);
          }
        } else if (webSpeechTranscript) {
          // Check Web Speech confidence
          // Note: Web Speech API doesn't provide confidence consistently
          // We'll use a heuristic or assume good confidence
          const estimatedConfidence = webSpeechTranscript.length > 3 ? 0.85 : 0.5;
          webSpeechConfidenceRef.current = estimatedConfidence;

          if (estimatedConfidence >= confidenceThreshold) {
            // Web Speech result is good enough
            const result: HybridVoiceResult = {
              transcript: webSpeechTranscript,
              confidence: estimatedConfidence,
              source: 'web-speech',
              isFinal: true,
            };
            setTranscript(webSpeechTranscript);
            setSource('web-speech');
            onResult?.(result);
          } else if (whisperAvailable) {
            // Fall back to Whisper for better accuracy
            const result = await transcribeWithWhisper(audioBlob);
            if (result) {
              setTranscript(result.transcript);
              setSource('whisper');
              onResult?.(result);
            } else {
              // Whisper failed, use Web Speech result anyway
              const fallbackResult: HybridVoiceResult = {
                transcript: webSpeechTranscript,
                confidence: estimatedConfidence,
                source: 'web-speech',
                isFinal: true,
              };
              setTranscript(webSpeechTranscript);
              onResult?.(fallbackResult);
            }
          } else {
            // No Whisper, use Web Speech
            const result: HybridVoiceResult = {
              transcript: webSpeechTranscript,
              confidence: estimatedConfidence,
              source: 'web-speech',
              isFinal: true,
            };
            setTranscript(webSpeechTranscript);
            onResult?.(result);
          }
        } else if (whisperAvailable) {
          // No Web Speech result, use Whisper
          const result = await transcribeWithWhisper(audioBlob);
          if (result) {
            setTranscript(result.transcript);
            setSource('whisper');
            onResult?.(result);
          }
        }
      } finally {
        setIsProcessing(false);
        setInterimTranscript('');
        clearRecording();
      }
    };

    processResults();
  }, [
    isProcessing,
    audioBlob,
    alwaysUseWhisper,
    webSpeechTranscript,
    confidenceThreshold,
    whisperAvailable,
    transcribeWithWhisper,
    onResult,
    clearRecording,
  ]);

  // Toggle listening
  const toggleListening = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Reset everything
  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setSource(null);
    resetWebSpeech();
    clearRecording();
  }, [resetWebSpeech, clearRecording]);

  return {
    // State
    isListening,
    isProcessing,
    transcript,
    interimTranscript,
    error,
    source,
    recordingDuration,

    // Availability
    webSpeechSupported: browserSupportsSpeechRecognition,
    whisperAvailable,

    // Actions
    startListening,
    stopListening,
    toggleListening,
    reset,
  };
}

export default useHybridVoice;
