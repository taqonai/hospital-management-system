import { useState, useEffect, useRef } from 'react';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  HeartIcon,
  ShieldExclamationIcon,
  ClockIcon,
  PhoneIcon,
  CalendarDaysIcon,
  UserCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface Question {
  id: string;
  type: 'text' | 'select' | 'multiselect' | 'scale';
  question: string;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  help_text?: string;
  min?: number;
  max?: number;
  labels?: Record<string, string>;
}

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  question?: Question;
  isRedFlag?: boolean;
}

interface TriageResult {
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

interface SymptomCheckerChatProps {
  patientId?: string;
  patientAge?: number;
  patientGender?: string;
  onComplete?: (result: TriageResult) => void;
  onBookAppointment?: (department: string) => void;
}

export default function SymptomCheckerChat({
  patientId,
  patientAge,
  patientGender,
  onComplete,
  onBookAppointment,
}: SymptomCheckerChatProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [scaleValue, setScaleValue] = useState(5);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState('');
  const [redFlagMessage, setRedFlagMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    startSession();
  }, []);

  const addMessage = (type: 'bot' | 'user', content: string, question?: Question, isRedFlag = false) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      question,
      isRedFlag,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const startSession = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/patient-portal/symptom-check/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientAge,
          patientGender,
        }),
      });

      if (!response.ok) throw new Error('Failed to start session');

      const data = await response.json();
      const result = data.data;

      setSessionId(result.session_id);
      setProgress(result.progress);

      addMessage('bot', result.message);

      if (result.question) {
        setCurrentQuestion(result.question);
        addMessage('bot', result.question.question, result.question);
      }
    } catch (err) {
      console.error('Error starting session:', err);
      setError('Failed to start symptom checker. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer: any) => {
    if (!sessionId || !currentQuestion) return;

    // Add user message
    let displayAnswer = answer;
    if (currentQuestion.type === 'select' || currentQuestion.type === 'multiselect') {
      const labels = Array.isArray(answer)
        ? answer.map((a) => currentQuestion.options?.find((o) => o.value === a)?.label || a).join(', ')
        : currentQuestion.options?.find((o) => o.value === answer)?.label || answer;
      displayAnswer = labels;
    } else if (currentQuestion.type === 'scale') {
      displayAnswer = `${answer}/10`;
    }

    addMessage('user', displayAnswer);
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/patient-portal/symptom-check/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          answer,
          questionId: currentQuestion.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit answer');

      const data = await response.json();
      const result = data.data;

      setProgress(result.progress);

      // Check for red flags
      if (result.red_flag_detected) {
        setRedFlagMessage(result.red_flag_message);
        addMessage('bot', result.red_flag_message || 'Emergency symptoms detected.', undefined, true);
      }

      // Add bot message if present
      if (result.message && !result.red_flag_detected) {
        addMessage('bot', result.message);
      }

      if (result.is_complete) {
        setIsComplete(true);
        setCurrentQuestion(null);
        // Automatically complete the assessment
        await completeAssessment();
      } else if (result.question) {
        setCurrentQuestion(result.question);
        addMessage('bot', result.question.question, result.question);
      }

      // Reset inputs
      setInputValue('');
      setSelectedOptions([]);
      setScaleValue(5);
    } catch (err) {
      console.error('Error submitting answer:', err);
      setError('Failed to process your answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeAssessment = async () => {
    if (!sessionId) return;

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/patient-portal/symptom-check/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) throw new Error('Failed to complete assessment');

      const data = await response.json();
      const result = data.data as TriageResult;

      setTriageResult(result);
      onComplete?.(result);
    } catch (err) {
      console.error('Error completing assessment:', err);
      setError('Failed to generate results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentQuestion) return;

    if (currentQuestion.type === 'text') {
      if (inputValue.trim()) {
        submitAnswer(inputValue.trim());
      }
    } else if (currentQuestion.type === 'scale') {
      submitAnswer(scaleValue);
    } else if (currentQuestion.type === 'select') {
      if (selectedOptions.length > 0) {
        submitAnswer(selectedOptions[0]);
      }
    } else if (currentQuestion.type === 'multiselect') {
      if (selectedOptions.length > 0) {
        submitAnswer(selectedOptions);
      }
    }
  };

  const toggleOption = (value: string) => {
    if (currentQuestion?.type === 'select') {
      setSelectedOptions([value]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    }
  };

  const getUrgencyStyles = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return {
          bg: 'bg-red-50',
          border: 'border-red-300',
          text: 'text-red-800',
          badge: 'bg-red-600 text-white',
          icon: ShieldExclamationIcon,
        };
      case 'urgent-care':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-300',
          text: 'text-orange-800',
          badge: 'bg-orange-500 text-white',
          icon: ExclamationTriangleIcon,
        };
      case 'schedule-appointment':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-300',
          text: 'text-blue-800',
          badge: 'bg-blue-600 text-white',
          icon: CalendarDaysIcon,
        };
      default:
        return {
          bg: 'bg-green-50',
          border: 'border-green-300',
          text: 'text-green-800',
          badge: 'bg-green-600 text-white',
          icon: CheckCircleIcon,
        };
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return 'Emergency - Seek Immediate Care';
      case 'urgent-care':
        return 'Urgent - Visit Urgent Care';
      case 'schedule-appointment':
        return 'Schedule an Appointment';
      default:
        return 'Self-Care at Home';
    }
  };

  const renderInput = () => {
    if (!currentQuestion || loading || isComplete) return null;

    const { type, options, placeholder, help_text, min = 1, max = 10, labels } = currentQuestion;

    if (type === 'text') {
      return (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder || 'Type your answer...'}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
      );
    }

    if (type === 'scale') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{labels?.[String(min)] || 'Low'}</span>
            <input
              type="range"
              min={min}
              max={max}
              value={scaleValue}
              onChange={(e) => setScaleValue(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-sm text-gray-500">{labels?.[String(max)] || 'High'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-blue-600">{scaleValue}</span>
            <button
              onClick={() => submitAnswer(scaleValue)}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      );
    }

    if (type === 'select' || type === 'multiselect') {
      return (
        <div className="space-y-3">
          <div className="grid gap-2">
            {options?.map((option) => (
              <button
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`w-full px-4 py-3 text-left rounded-xl border transition-all ${
                  selectedOptions.includes(option.value)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedOptions.includes(option.value)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedOptions.includes(option.value) && (
                      <CheckCircleIcon className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <span>{option.label}</span>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={selectedOptions.length === 0}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Continue
          </button>
          {help_text && <p className="text-sm text-gray-500 text-center">{help_text}</p>}
        </div>
      );
    }

    return null;
  };

  const renderTriageResult = () => {
    if (!triageResult) return null;

    const styles = getUrgencyStyles(triageResult.urgency);
    const UrgencyIcon = styles.icon;

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Urgency Banner */}
        <div
          className={`p-6 rounded-2xl border-2 ${styles.bg} ${styles.border}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${styles.badge}`}>
              <UrgencyIcon className="h-8 w-8" />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${styles.text}`}>
                {getUrgencyLabel(triageResult.urgency)}
              </h3>
              <p className="text-gray-600 mt-1">
                Based on your symptoms: {triageResult.primary_concern}
              </p>
            </div>
          </div>

          {triageResult.urgency === 'emergency' && (
            <div className="mt-4 p-4 bg-red-100 rounded-xl">
              <div className="flex items-center gap-3">
                <PhoneIcon className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-bold text-red-800">Call Emergency Services (911)</p>
                  <p className="text-sm text-red-700">Or go to the nearest emergency room immediately</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Symptom Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Body Area:</span>
              <p className="font-medium">{triageResult.body_part}</p>
            </div>
            <div>
              <span className="text-gray-500">Severity:</span>
              <p className="font-medium capitalize">{triageResult.severity}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Symptoms:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {triageResult.symptoms_summary.map((symptom, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {symptom}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Department */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <UserCircleIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">Recommended Department</h4>
              <p className="text-blue-700 font-medium">{triageResult.recommended_department}</p>
            </div>
            {triageResult.urgency !== 'self-care' && triageResult.urgency !== 'emergency' && (
              <button
                onClick={() => onBookAppointment?.(triageResult.recommended_department)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
              >
                <CalendarDaysIcon className="h-5 w-5" />
                Book Appointment
              </button>
            )}
          </div>
        </div>

        {/* Self-Care Advice */}
        {triageResult.self_care_advice.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <HeartIcon className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-gray-900">Self-Care Recommendations</h4>
            </div>
            <ul className="space-y-2">
              {triageResult.self_care_advice.map((advice, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{advice}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* When to Seek Help */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
            <h4 className="font-semibold text-amber-900">When to Seek Medical Help</h4>
          </div>
          <ul className="space-y-2">
            {triageResult.when_to_seek_help.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <ClockIcon className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-amber-800">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Possible Conditions */}
        {triageResult.possible_conditions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Possible Conditions</h4>
            <div className="space-y-3">
              {triageResult.possible_conditions.map((condition, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-gray-50 rounded-xl"
                >
                  <p className="font-medium text-gray-900">{condition.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{condition.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="p-4 bg-gray-100 rounded-xl text-center">
          <p className="text-sm text-gray-600">{triageResult.disclaimer}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              setSessionId(null);
              setMessages([]);
              setCurrentQuestion(null);
              setIsComplete(false);
              setTriageResult(null);
              setProgress(0);
              startSession();
            }}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Start New Check
          </button>
          {triageResult.urgency !== 'self-care' && triageResult.urgency !== 'emergency' && (
            <button
              onClick={() => onBookAppointment?.(triageResult.recommended_department)}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <CalendarDaysIcon className="h-5 w-5" />
              Book Appointment
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <ChatBubbleLeftRightIcon className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">AI Symptom Checker</h2>
            <p className="text-blue-100 text-sm">Answer a few questions to get care recommendations</p>
          </div>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <SparklesIcon className="h-4 w-4" />
            <span>AI-Powered</span>
          </div>
        </div>

        {/* Progress Bar */}
        {!triageResult && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-white/80 mb-2">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : message.isRedFlag
                  ? 'bg-red-100 border border-red-300 text-red-800 rounded-bl-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
              }`}
            >
              {message.isRedFlag && (
                <div className="flex items-center gap-2 mb-2">
                  <ShieldExclamationIcon className="h-5 w-5 text-red-600" />
                  <span className="font-semibold text-red-700">Important Warning</span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p
                className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <ArrowPathIcon className="h-5 w-5 text-blue-600 animate-spin" />
                <span className="text-gray-500">Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Triage Result */}
      {triageResult && (
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {renderTriageResult()}
        </div>
      )}

      {/* Input Area */}
      {!triageResult && (
        <div className="p-4 bg-white border-t border-gray-200 rounded-b-2xl">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5" />
              {error}
            </div>
          )}

          {redFlagMessage && triageResult?.urgency === 'emergency' && (
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-xl">
              <div className="flex items-center gap-3">
                <ShieldExclamationIcon className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-bold text-red-800">Emergency Detected</p>
                  <p className="text-sm text-red-700">{redFlagMessage}</p>
                </div>
              </div>
            </div>
          )}

          {renderInput()}
        </div>
      )}
    </div>
  );
}
