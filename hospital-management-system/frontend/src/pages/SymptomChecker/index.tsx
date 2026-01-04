import { useState, useRef, useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
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
  ShieldCheckIcon,
  PhoneIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  MicrophoneIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { symptomCheckerApi } from '../../services/api';

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

interface TriageResult {
  triageLevel: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'SELF_CARE';
  recommendedDepartment: string;
  urgencyScore: number;
  redFlags: string[];
  possibleConditions: Array<{ name: string; confidence: number; severity: string }>;
  recommendedAction: string;
  selfCareAdvice: string[];
  whenToSeekHelp: string[];
  symptomsSummary: string[];
  disclaimer: string;
}

const triageLevelConfig = {
  EMERGENCY: { color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: ExclamationTriangleIcon, label: 'Emergency', description: 'Seek immediate medical attention' },
  URGENT: { color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', icon: ClockIcon, label: 'Urgent', description: 'See a doctor within a few hours' },
  ROUTINE: { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: CheckCircleIcon, label: 'Routine', description: 'Schedule an appointment' },
  SELF_CARE: { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200', icon: HeartIcon, label: 'Self-Care', description: 'Monitor at home' },
};

export default function SymptomChecker() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Voice recognition
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // Update text input when voice transcript changes
  useEffect(() => {
    if (transcript && currentQuestions.length > 0) {
      const firstQuestion = currentQuestions[0];
      if (firstQuestion.type === 'text' || firstQuestion.type === 'multitext') {
        setAnswers(prev => ({ ...prev, [firstQuestion.id]: transcript }));
      }
    }
  }, [transcript, currentQuestions]);

  const startVoiceInput = useCallback(() => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
  }, [resetTranscript]);

  const stopVoiceInput = useCallback(() => {
    SpeechRecognition.stopListening();
  }, []);

  const startSession = async () => {
    setHasStarted(true);
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
          content: data.message || "Hi! I'm your AI health assistant. Tell me what's bothering you today - you can type or use voice input.",
          timestamp: new Date(),
          questions: data.nextQuestions
        }]);
        setCurrentQuestions(data.nextQuestions || []);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      setMessages([{ id: '1', type: 'bot', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitResponses = async () => {
    if (!sessionId || Object.keys(answers).length === 0) return;

    // Stop voice if recording
    if (listening) {
      stopVoiceInput();
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
      resetTranscript();

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
        const botMessage = data.message || "Thanks! Just a few more questions...";
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
      const result = response.data.data;
      setMessages(prev => [...prev, {
        id: 'result-' + Date.now(),
        type: 'bot',
        content: 'Here is your assessment:',
        timestamp: new Date(),
        triageResult: result
      }]);
    } catch (error) {
      console.error('Failed to complete assessment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    if (listening) stopVoiceInput();
    setMessages([]);
    setSessionId(null);
    setCurrentQuestions([]);
    setAnswers({});
    setProgress(0);
    setIsComplete(false);
    setHasStarted(false);
    resetTranscript();
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
            <div className="relative">
              <textarea
                ref={isFirst ? textInputRef : undefined}
                className="w-full px-4 py-3 pr-16 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={2}
                placeholder={listening ? "Listening... speak now" : (question.placeholder || "Type your symptoms or click the blue mic button →")}
                value={answers[question.id] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                onKeyDown={handleKeyPress}
              />
              {browserSupportsSpeechRecognition && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (listening) {
                      stopVoiceInput();
                    } else {
                      startVoiceInput();
                    }
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all cursor-pointer z-10 border-2 ${
                    listening
                      ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-lg'
                      : 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600 hover:shadow-lg'
                  }`}
                  title={listening ? "Stop recording" : "Click to speak"}
                >
                  {listening ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
                </button>
              )}
            </div>
            {listening && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Listening... speak clearly
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
    const config = triageLevelConfig[result.triageLevel];
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
              <div className={`text-2xl font-bold ${config.textColor}`}>{result.urgencyScore}/10</div>
              <p className="text-xs text-gray-500">Urgency</p>
            </div>
          </div>

          {result.redFlags.length > 0 && (
            <div className="bg-red-100 border border-red-200 rounded-xl p-3 mb-3">
              <h4 className="font-semibold text-red-700 flex items-center gap-2 text-sm mb-1">
                <ExclamationTriangleIcon className="w-4 h-4" />Warning Signs
              </h4>
              <ul className="space-y-1">
                {result.redFlags.map((flag, i) => <li key={i} className="text-xs text-red-600">• {flag}</li>)}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-xl p-3 border border-gray-200">
            <h4 className="font-semibold text-gray-800 text-sm mb-1">Recommended Action</h4>
            <p className="text-sm text-gray-600">{result.recommendedAction}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4 text-blue-500" />Department
            </h4>
            <div className="px-3 py-2 bg-blue-50 rounded-lg text-blue-700 font-medium text-center text-sm">
              {result.recommendedDepartment}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-800 text-sm mb-2">Possible Conditions</h4>
            <div className="space-y-1">
              {result.possibleConditions.slice(0, 2).map((condition, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate">{condition.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    condition.severity === 'severe' ? 'bg-red-100 text-red-700' :
                    condition.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>{condition.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {result.triageLevel !== 'SELF_CARE' && (
            <button
              onClick={() => {
                // Store triage result for booking form
                sessionStorage.setItem('triageResult', JSON.stringify({
                  department: result.recommendedDepartment,
                  urgency: result.triageLevel,
                  symptoms: result.possibleConditions?.map(c => c.name).join(', '),
                }));
                // Redirect to homepage booking section (public booking for patients)
                window.location.href = `/#booking?department=${encodeURIComponent(result.recommendedDepartment || '')}`;
              }}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              <CalendarDaysIcon className="w-4 h-4" />Book Appointment
            </button>
          )}
          {result.triageLevel === 'EMERGENCY' && (
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

  // Landing page
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl mb-6 shadow-lg">
              <SparklesIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">AI Symptom Checker</h1>
            <p className="text-lg text-gray-600">Get instant guidance with voice or text input</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
              <div className="p-2 bg-blue-100 rounded-lg w-fit mx-auto mb-3">
                <MicrophoneIcon className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm mb-1">Voice Input</h3>
              <p className="text-xs text-gray-600">Speak your symptoms naturally</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
              <div className="p-2 bg-green-100 rounded-lg w-fit mx-auto mb-3">
                <SparklesIcon className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm mb-1">AI Analysis</h3>
              <p className="text-xs text-gray-600">Smart symptom assessment</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
              <div className="p-2 bg-purple-100 rounded-lg w-fit mx-auto mb-3">
                <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm mb-1">Safe Triage</h3>
              <p className="text-xs text-gray-600">Priority-based guidance</p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={startSession}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium text-lg hover:shadow-xl transition-all inline-flex items-center gap-3"
            >
              <ChatBubbleLeftRightIcon className="w-6 h-6" />
              Start Symptom Check
            </button>
            <p className="text-sm text-gray-500 mt-3">Quick 1-2 minute assessment</p>
          </div>

          <div className="mt-10 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 text-sm">Important</h4>
                <p className="text-xs text-amber-700 mt-1">
                  This is for guidance only. For emergencies, call 911 immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">AI Symptom Checker</h1>
              <p className="text-xs text-gray-500">
                {browserSupportsSpeechRecognition ? 'Voice & Text Input' : 'Text Input'}
              </p>
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
          <div className="mb-4">
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
        <div className="space-y-4 mb-4">
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
    </div>
  );
}
