import { useState, useRef, useEffect } from 'react';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  SparklesIcon,
  UserIcon,
  ArrowPathIcon,
  PhoneIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  MicrophoneIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { symptomCheckerApi } from '../../services/api';
import { useAudioRecorder, formatDuration } from '../../hooks/useAudioRecorder';

interface SymptomCheckerChatProps {
  onComplete?: (result: TriageResult) => void;
  onBookAppointment?: (department: string) => void;
  autoStart?: boolean;
}

interface Message {
  id: string;
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
  questions?: Question[];
  triageResult?: TriageResult;
}

interface Question {
  id: string;
  type: 'text' | 'multitext' | 'select' | 'multiselect' | 'scale';
  question: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  labels?: Record<string, string>;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
}

export interface TriageResult {
  session_id: string;
  urgency: 'self-care' | 'schedule-appointment' | 'urgent-care' | 'emergency';
  urgency_level: 1 | 2 | 3 | 4;
  urgency_color: string;
  primary_concern: string;
  body_part: string;
  severity: string;
  symptoms_summary: string[];
  possible_conditions: Array<{ name: string; likelihood: string; note: string }>;
  recommended_department: string;
  follow_up_questions: string[];
  self_care_advice: string[];
  when_to_seek_help: string[];
  red_flags_present: boolean;
  red_flag_symptoms: string[];
  disclaimer: string;
}

const triageLevelConfig = {
  EMERGENCY: { color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: ExclamationTriangleIcon, label: 'Emergency', description: 'Seek immediate medical attention' },
  URGENT: { color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', icon: ClockIcon, label: 'Urgent', description: 'See a doctor within a few hours' },
  ROUTINE: { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: CheckCircleIcon, label: 'Routine', description: 'Schedule an appointment' },
  SELF_CARE: { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200', icon: HeartIcon, label: 'Self-Care', description: 'Monitor at home' },
};

const urgencyToTriageLevel: Record<string, keyof typeof triageLevelConfig> = {
  'emergency': 'EMERGENCY',
  'urgent-care': 'URGENT',
  'schedule-appointment': 'ROUTINE',
  'self-care': 'SELF_CARE',
};

export default function SymptomCheckerChat({ onComplete, onBookAppointment, autoStart = false }: SymptomCheckerChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Audio recorder for Whisper
  const {
    isRecording,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    clearRecording,
  } = useAudioRecorder({
    maxDuration: 60000, // 60 seconds max
  });

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // Auto-start session if prop is set
  useEffect(() => {
    if (autoStart && !sessionId && messages.length === 0) {
      startSession();
    }
  }, [autoStart]);

  // Transcribe audio with Whisper when recording stops
  useEffect(() => {
    const transcribeAudio = async () => {
      if (!audioBlob || isRecording) return;

      setIsTranscribing(true);
      setVoiceError(null);

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', 'en');

        const token = localStorage.getItem('patientPortalToken') || localStorage.getItem('accessToken');
        const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

        const response = await fetch(`${API_URL}/ai/transcribe`, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Transcription failed');
        }

        const data = await response.json();
        const transcribedText = data.transcript || data.data?.transcript || '';

        if (transcribedText && currentQuestions.length > 0) {
          const firstQuestion = currentQuestions[0];
          if (firstQuestion.type === 'text' || firstQuestion.type === 'multitext') {
            setAnswers(prev => {
              const existingText = prev[firstQuestion.id] || '';
              const newText = existingText
                ? `${existingText}. ${transcribedText}`.replace(/\.\s*\./g, '.').trim()
                : transcribedText;
              return { ...prev, [firstQuestion.id]: newText };
            });
          }
        }
      } catch (err) {
        console.error('Transcription error:', err);
        setVoiceError('Failed to transcribe audio. Please try typing instead.');
      } finally {
        setIsTranscribing(false);
        clearRecording();
      }
    };

    transcribeAudio();
  }, [audioBlob, isRecording, currentQuestions, clearRecording]);

  const startSession = async () => {
    setIsLoading(true);
    try {
      const response = await symptomCheckerApi.startSession();
      const data = response.data.data;
      setSessionId(data.sessionId);
      setProgress(data.progress || 0);

      if (data.redFlagDetected && data.redFlagMessage) {
        setMessages([
          { id: '1', type: 'bot', content: data.message || 'Welcome to the AI Symptom Checker.', timestamp: new Date() },
          { id: '2', type: 'system', content: data.redFlagMessage, timestamp: new Date() }
        ]);
        setIsComplete(true);
        if (data.sessionId) {
          await completeAssessment(data.sessionId);
        }
      } else {
        setMessages([{
          id: '1',
          type: 'bot',
          content: data.message || "Hi! I'm your AI health assistant. Tell me what's bothering you today - you can type or use the microphone to speak.",
          timestamp: new Date(),
          questions: data.nextQuestions
        }]);
        setCurrentQuestions(data.nextQuestions || []);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      setMessages([{ id: '1', type: 'bot', content: 'Sorry, I encountered an error starting the session. Please try again.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitResponses = async () => {
    if (!sessionId || Object.keys(answers).length === 0) return;

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    setIsLoading(true);
    const userResponses = Object.entries(answers).map(([id, answer]) => {
      const question = currentQuestions.find((q) => q.id === id);
      if (Array.isArray(answer)) return answer.map(v => {
        const opt = question?.options?.find(o => o.value === v);
        return opt?.label || v;
      }).join(', ');
      if (question?.type === 'select' && question.options) {
        const option = question.options.find((o) => o.value === answer);
        return option?.label || answer;
      }
      return String(answer);
    }).join('; ');

    setMessages(prev => [...prev, { id: 'user-' + Date.now(), type: 'user', content: userResponses, timestamp: new Date() }]);

    try {
      const response = await symptomCheckerApi.respond({
        sessionId,
        responses: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }))
      });
      const data = response.data.data;
      setProgress(data.progress || 0);
      setAnswers({});
      clearRecording();
      setVoiceError(null);

      if (data.redFlagDetected && data.redFlagMessage) {
        setMessages(prev => [...prev, { id: 'system-' + Date.now(), type: 'system', content: data.redFlagMessage, timestamp: new Date() }]);
        setIsComplete(true);
        await completeAssessment(sessionId);
        return;
      }

      if (data.isComplete) {
        setIsComplete(true);
        await completeAssessment(sessionId);
      } else {
        const botMessage = data.message || "Thanks! Let me ask a few more questions...";
        setMessages(prev => [...prev, {
          id: 'bot-' + Date.now(),
          type: 'bot',
          content: botMessage,
          timestamp: new Date(),
          questions: data.nextQuestions
        }]);
        setCurrentQuestions(data.nextQuestions || []);
      }
    } catch (error) {
      console.error('Failed to submit responses:', error);
      setMessages(prev => [...prev, { id: 'error-' + Date.now(), type: 'bot', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const completeAssessment = async (sid?: string) => {
    const targetSessionId = sid || sessionId;
    if (!targetSessionId) return;
    setIsLoading(true);
    try {
      const response = await symptomCheckerApi.complete(targetSessionId);
      const apiResult = response.data.data;

      // Map backend response to TriageResult format
      const urgencyMap: Record<string, 'self-care' | 'schedule-appointment' | 'urgent-care' | 'emergency'> = {
        'SELF_CARE': 'self-care',
        'ROUTINE': 'schedule-appointment',
        'URGENT': 'urgent-care',
        'EMERGENCY': 'emergency',
      };

      const result: TriageResult = {
        session_id: targetSessionId,
        urgency: urgencyMap[apiResult.triageLevel] || 'schedule-appointment',
        urgency_level: Math.min(4, Math.max(1, Math.ceil((apiResult.urgencyScore || 5) / 2.5))) as 1 | 2 | 3 | 4,
        urgency_color: apiResult.triageLevel === 'EMERGENCY' ? 'red' : apiResult.triageLevel === 'URGENT' ? 'orange' : apiResult.triageLevel === 'SELF_CARE' ? 'green' : 'blue',
        primary_concern: apiResult.symptomsSummary?.[0] || 'General symptoms',
        body_part: apiResult.bodyPart || 'General',
        severity: apiResult.severity || 'moderate',
        symptoms_summary: apiResult.symptomsSummary || [],
        possible_conditions: (apiResult.possibleConditions || []).map((c: any) => ({
          name: c.name || c,
          likelihood: c.likelihood || c.confidence ? `${Math.round((c.confidence || 0.5) * 100)}%` : 'Possible',
          note: c.note || c.description || c.severity || '',
        })),
        recommended_department: apiResult.recommendedDepartment || 'General Medicine',
        follow_up_questions: apiResult.followUpQuestions || [],
        self_care_advice: apiResult.selfCareAdvice || [],
        when_to_seek_help: apiResult.whenToSeekHelp || [],
        red_flags_present: (apiResult.redFlags && apiResult.redFlags.length > 0) || false,
        red_flag_symptoms: apiResult.redFlags || [],
        disclaimer: apiResult.disclaimer || 'This is for informational purposes only and does not replace professional medical advice.',
      };

      setTriageResult(result);
      setMessages(prev => [...prev, {
        id: 'result-' + Date.now(),
        type: 'bot',
        content: 'Here is your assessment:',
        timestamp: new Date(),
        triageResult: result
      }]);
      onComplete?.(result);
    } catch (error) {
      console.error('Failed to complete assessment:', error);
      setMessages(prev => [...prev, { id: 'error-' + Date.now(), type: 'bot', content: 'Failed to generate results. Please try again.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    if (isRecording) stopRecording();
    clearRecording();
    setVoiceError(null);
    setMessages([]);
    setSessionId(null);
    setCurrentQuestions([]);
    setAnswers({});
    setProgress(0);
    setIsComplete(false);
    setTriageResult(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitResponses();
    }
  };

  const renderQuestion = (question: Question, isFirst: boolean) => {
    switch (question.type) {
      case 'text':
      case 'multitext':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{question.question}</label>
            {question.helpText && <p className="text-xs text-gray-500 mb-2">{question.helpText}</p>}
            <div className="flex items-start gap-2">
              <textarea
                ref={isFirst ? textInputRef : undefined}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-800"
                rows={3}
                placeholder={isRecording ? "Recording... speak now" : (question.placeholder || "Type your symptoms or click the mic to speak...")}
                value={answers[question.id] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                onKeyDown={handleKeyPress}
                disabled={isRecording || isTranscribing}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVoiceError(null);
                  if (isRecording) {
                    stopRecording();
                  } else if (!isTranscribing) {
                    startRecording();
                  }
                }}
                disabled={isTranscribing}
                className={`flex-shrink-0 p-3 rounded-xl transition-all border-2 ${
                  isTranscribing
                    ? 'bg-yellow-500 text-white border-yellow-600 cursor-wait'
                    : isRecording
                    ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-lg cursor-pointer'
                    : 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600 hover:shadow-lg cursor-pointer'
                }`}
                title={isTranscribing ? "Transcribing..." : isRecording ? "Click to stop" : "Click to speak"}
              >
                {isTranscribing ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : isRecording ? (
                  <StopIcon className="w-5 h-5" />
                ) : (
                  <MicrophoneIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            {isRecording && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Recording {formatDuration(duration)}</span> - Speak clearly. Click stop when done.
              </div>
            )}
            {isTranscribing && (
              <div className="mt-2 flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span>Transcribing with AI...</span>
              </div>
            )}
            {voiceError && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {voiceError}
              </div>
            )}
          </div>
        );
      case 'select':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{question.question}</label>
            <div className="grid grid-cols-1 gap-2">
              {question.options?.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    answers[question.id] === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                  onClick={() => setAnswers(prev => ({ ...prev, [question.id]: option.value }))}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      answers[question.id] === option.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {answers[question.id] === option.value && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <span className="text-sm">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      case 'multiselect':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{question.question}</label>
            <p className="text-xs text-gray-500 mb-2">Select all that apply</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {question.options?.map((option) => {
                const selectedValues = answers[question.id] || [];
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`text-left px-4 py-3 rounded-xl border transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                    onClick={() => {
                      const current = answers[question.id] || [];
                      const updated = isSelected
                        ? current.filter((v: string) => v !== option.value)
                        : [...current, option.value];
                      setAnswers(prev => ({ ...prev, [question.id]: updated }));
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {isSelected && <CheckCircleIcon className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm">{option.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'scale':
        const scaleValue = answers[question.id] || question.min || 1;
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{question.question}</label>
            <div className="bg-gray-50 rounded-xl p-4">
              <input
                type="range"
                min={question.min || 1}
                max={question.max || 10}
                value={scaleValue}
                onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gradient-to-r from-green-300 via-yellow-300 to-red-400 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-sm mt-3">
                <span className="text-green-600 font-medium">{question.labels?.['1'] || 'Mild'}</span>
                <span className={`text-2xl font-bold ${scaleValue <= 3 ? 'text-green-600' : scaleValue <= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {scaleValue}
                </span>
                <span className="text-red-600 font-medium">{question.labels?.['10'] || 'Severe'}</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTriageResult = (result: TriageResult) => {
    const triageLevel = urgencyToTriageLevel[result.urgency] || 'ROUTINE';
    const config = triageLevelConfig[triageLevel];
    const TriageIcon = config.icon;

    return (
      <div className="space-y-4 mt-4">
        <div className={`rounded-2xl border-2 p-5 ${config.borderColor} ${config.bgColor}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-xl ${config.color}`}>
              <TriageIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className={`text-xl font-bold ${config.textColor}`}>{config.label}</h3>
              <p className="text-sm text-gray-600">{config.description}</p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${config.textColor}`}>{result.urgency_level * 2.5}/10</div>
              <p className="text-xs text-gray-500">Urgency</p>
            </div>
          </div>

          {result.red_flags_present && result.red_flag_symptoms.length > 0 && (
            <div className="bg-red-100 border border-red-200 rounded-xl p-3 mb-3">
              <h4 className="font-semibold text-red-700 flex items-center gap-2 text-sm mb-1">
                <ExclamationTriangleIcon className="w-4 h-4" />Warning Signs
              </h4>
              <ul className="space-y-1">
                {result.red_flag_symptoms.map((flag, i) => <li key={i} className="text-xs text-red-600">• {flag}</li>)}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-xl p-3 border border-gray-200">
            <h4 className="font-semibold text-gray-800 text-sm mb-1">Recommended Department</h4>
            <p className="text-sm text-blue-600 font-medium">{result.recommended_department}</p>
          </div>
        </div>

        {result.possible_conditions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-800 text-sm mb-2">Possible Conditions</h4>
            <div className="space-y-2">
              {result.possible_conditions.slice(0, 3).map((condition, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{condition.name}</span>
                  <span className="text-gray-500 text-xs">{condition.likelihood}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.self_care_advice.length > 0 && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <h4 className="font-semibold text-green-800 text-sm mb-2">Self-Care Advice</h4>
            <ul className="space-y-1">
              {result.self_care_advice.slice(0, 4).map((advice, i) => (
                <li key={i} className="text-xs text-green-700 flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {advice}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          {result.urgency !== 'self-care' && (
            <button
              onClick={() => onBookAppointment?.(result.recommended_department)}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              <CalendarDaysIcon className="w-4 h-4" />Book Appointment
            </button>
          )}
          {result.urgency === 'emergency' && (
            <a
              href="tel:911"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              <PhoneIcon className="w-4 h-4" />Call 911
            </a>
          )}
          <button
            onClick={resetChat}
            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <ArrowPathIcon className="w-4 h-4" />New Check
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <div className="flex items-start gap-2">
            <InformationCircleIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">{result.disclaimer}</p>
          </div>
        </div>
      </div>
    );
  };

  // Initial welcome screen - if no session started yet
  if (!sessionId && messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="inline-flex p-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl mb-6 shadow-lg shadow-purple-500/25">
            <SparklesIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">AI Symptom Checker</h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Describe your symptoms using text or voice, and I'll help you understand what might be causing them and what to do next.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 text-sm">
              <MicrophoneIcon className="w-4 h-4" />
              Voice Input
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-green-700 text-sm">
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              Text Input
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full text-purple-700 text-sm">
              <SparklesIcon className="w-4 h-4" />
              AI Analysis
            </div>
          </div>

          <button
            onClick={startSession}
            disabled={isLoading}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium text-lg hover:shadow-xl transition-all inline-flex items-center gap-3 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <ArrowPathIcon className="w-6 h-6 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <ChatBubbleLeftRightIcon className="w-6 h-6" />
                Start Symptom Check
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/25">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">AI Symptom Checker</h1>
            <p className="text-xs text-gray-500">Voice & Text Input Available</p>
          </div>
        </div>
        <button
          onClick={resetChat}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all flex items-center gap-1"
        >
          <ArrowPathIcon className="w-4 h-4" />Start Over
        </button>
      </div>

      {/* Progress */}
      {!isComplete && progress > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${
              message.type === 'user'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3'
                : message.type === 'system'
                ? 'bg-red-100 border-2 border-red-200 text-red-700 rounded-2xl px-4 py-3'
                : 'bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm'
            }`}>
              {message.type === 'bot' && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 bg-blue-100 rounded-md">
                    <SparklesIcon className="w-3 h-3 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-blue-600">AI Assistant</span>
                </div>
              )}
              {message.type === 'user' && (
                <div className="flex items-center gap-1 mb-1">
                  <UserIcon className="w-3 h-3 text-blue-100" />
                  <span className="text-xs text-blue-100">You</span>
                </div>
              )}
              {message.type === 'system' && (
                <div className="flex items-center gap-2 mb-2">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  <span className="font-semibold text-sm">Warning</span>
                </div>
              )}
              <p className={`text-sm ${message.type === 'bot' ? 'text-gray-700' : ''}`}>{message.content}</p>
              {message.triageResult && renderTriageResult(message.triageResult)}
            </div>
          </div>
        ))}

        {/* Questions */}
        {!isComplete && currentQuestions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            {currentQuestions.map((q, i) => renderQuestion(q, i === 0))}
            <button
              onClick={submitResponses}
              disabled={isLoading || Object.keys(answers).length === 0}
              className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-4 h-4" />
                  Continue
                </>
              )}
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && messages.length > 0 && currentQuestions.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600">Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
