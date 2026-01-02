import { useState, useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface UseVoiceRecognitionOptions {
  continuous?: boolean;
  language?: string;
  onResult?: (result: VoiceRecognitionResult) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const {
    continuous = false,
    language = 'en-US',
    onResult,
    onError,
  } = options;

  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition({
    commands: [],
  });

  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      setIsSupported(false);
      setError('Browser does not support speech recognition');
      onError?.('Browser does not support speech recognition');
    }
  }, [browserSupportsSpeechRecognition, onError]);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      resetTranscript();
      await SpeechRecognition.startListening({
        continuous,
        language,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start listening';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [continuous, language, resetTranscript, onError]);

  const stopListening = useCallback(async () => {
    try {
      await SpeechRecognition.stopListening();
      if (transcript && onResult) {
        onResult({
          transcript,
          confidence: 0.9, // Web Speech API doesn't provide confidence for final results
          isFinal: true,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop listening';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [transcript, onResult, onError]);

  const toggleListening = useCallback(async () => {
    if (listening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [listening, startListening, stopListening]);

  return {
    transcript,
    listening,
    isSupported,
    isMicrophoneAvailable,
    error,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.speechSynthesis) {
      setSupported(false);
    }
  }, []);

  const speak = useCallback((text: string, options?: { rate?: number; pitch?: number; voice?: string }) => {
    if (!supported || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate ?? 1;
    utterance.pitch = options?.pitch ?? 1;

    // Find voice if specified
    if (options?.voice) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.name.includes(options.voice!));
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const stop = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [supported]);

  return {
    speak,
    stop,
    speaking,
    supported,
  };
}
