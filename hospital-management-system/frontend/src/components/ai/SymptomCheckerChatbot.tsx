import { useState, useRef, useEffect } from 'react';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  SparklesIcon,
  UserIcon,
  ArrowPathIcon,
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
  possibleConditions: Array<{
    name: string;
    confidence: number;
    severity: string;
  }>;
  recommendedAction: string;
  selfCareAdvice: string[];
  whenToSeekHelp: string[];
  symptomsSummary: string[];
  disclaimer: string;
}

const triageLevelConfig = {
  EMERGENCY: {
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: ExclamationTriangleIcon,
    label: 'Emergency',
    description: 'Seek immediate medical attention',
  },
  URGENT: {
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: ClockIcon,
    label: 'Urgent',
    description: 'See a doctor within a few hours',
  },
  ROUTINE: {
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: CheckCircleIcon,
    label: 'Routine',
    description: 'Schedule an appointment',
  },
  SELF_CARE: {
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: HeartIcon,
    label: 'Self-Care',
    description: 'Monitor at home',
  },
};

export default function SymptomCheckerChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startSession = async () => {
    setIsLoading(true);
    try {
      const response = await symptomCheckerApi.startSession();
      const data = response.data.data;

      setSessionId(data.sessionId);
      setProgress(data.progress || 0);

      // Check for emergency red flags
      if (data.redFlagDetected && data.redFlagMessage) {
        setMessages([
          {
            id: '1',
            type: 'bot',
            content: data.message || 'Welcome to the Symptom Checker.',
            timestamp: new Date(),
          },
          {
            id: '2',
            type: 'system',
            content: data.redFlagMessage,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages([
          {
            id: '1',
            type: 'bot',
            content:
              data.message ||
              "Hello! I'm your AI health assistant. I'll help you understand your symptoms and guide you to the right care. Let's start by describing what you're experiencing.",
            timestamp: new Date(),
            questions: data.nextQuestions,
          },
        ]);
        setCurrentQuestions(data.nextQuestions || []);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      setMessages([
        {
          id: '1',
          type: 'bot',
          content:
            'Sorry, I encountered an error starting the symptom checker. Please try again later.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitResponses = async () => {
    if (!sessionId || Object.keys(answers).length === 0) return;

    setIsLoading(true);

    // Add user response to messages
    const userResponses = Object.entries(answers)
      .map(([id, answer]) => {
        const question = currentQuestions.find((q) => q.id === id);
        if (Array.isArray(answer)) {
          return answer.join(', ');
        }
        if (question?.type === 'select' && question.options) {
          const option = question.options.find((o) => o.value === answer);
          return option?.label || answer;
        }
        return String(answer);
      })
      .join('; ');

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        type: 'user',
        content: userResponses,
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await symptomCheckerApi.respond({
        sessionId,
        responses: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
      });

      const data = response.data.data;
      setProgress(data.progress || 0);
      setAnswers({});

      if (data.redFlagDetected && data.redFlagMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            type: 'system',
            content: data.redFlagMessage,
            timestamp: new Date(),
          },
        ]);
        setIsComplete(true);
        await completeAssessment();
        return;
      }

      if (data.isComplete) {
        setIsComplete(true);
        await completeAssessment();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            type: 'bot',
            content: data.message || "Thanks! Here are a few more questions:",
            timestamp: new Date(),
            questions: data.nextQuestions,
          },
        ]);
        setCurrentQuestions(data.nextQuestions || []);
      }
    } catch (error) {
      console.error('Failed to submit responses:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: 'bot',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const completeAssessment = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const response = await symptomCheckerApi.complete(sessionId);
      const result = response.data.data;

      setTriageResult(result);
      setMessages((prev) => [
        ...prev,
        {
          id: `result-${Date.now()}`,
          type: 'bot',
          content: 'Based on your symptoms, here is my assessment:',
          timestamp: new Date(),
          triageResult: result,
        },
      ]);
    } catch (error) {
      console.error('Failed to complete assessment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setSessionId(null);
    setCurrentQuestions([]);
    setAnswers({});
    setProgress(0);
    setIsComplete(false);
    setTriageResult(null);
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      startSession();
    }
  };

  const renderQuestion = (question: Question) => {
    switch (question.type) {
      case 'text':
      case 'multitext':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {question.question}
            </label>
            {question.helpText && (
              <p className="text-xs text-gray-500 mb-2">{question.helpText}</p>
            )}
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder={question.placeholder}
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
            />
          </div>
        );

      case 'select':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {question.question}
            </label>
            <div className="space-y-2">
              {question.options?.map((option) => (
                <button
                  key={option.value}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    answers[question.id] === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: option.value,
                    }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        );

      case 'multiselect':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {question.question}
            </label>
            <div className="space-y-2">
              {question.options?.map((option) => {
                const selectedValues = answers[question.id] || [];
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      const current = answers[question.id] || [];
                      const updated = isSelected
                        ? current.filter((v: string) => v !== option.value)
                        : [...current, option.value];
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: updated,
                      }));
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && (
                          <CheckCircleIcon className="w-4 h-4 text-white" />
                        )}
                      </div>
                      {option.label}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {question.question}
            </label>
            <div className="px-2">
              <input
                type="range"
                min={question.min || 1}
                max={question.max || 10}
                value={scaleValue}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [question.id]: parseInt(e.target.value),
                  }))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{question.labels?.['1'] || 'Low'}</span>
                <span className="text-lg font-bold text-blue-600">
                  {scaleValue}
                </span>
                <span>{question.labels?.['10'] || 'High'}</span>
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
      <div className={`rounded-2xl border-2 ${config.borderColor} ${config.bgColor} p-4 space-y-4`}>
        {/* Triage Level Badge */}
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${config.color}`}>
            <TriageIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${config.textColor}`}>
              {config.label}
            </h3>
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>
        </div>

        {/* Red Flags Warning */}
        {result.redFlags.length > 0 && (
          <div className="bg-red-100 border border-red-200 rounded-xl p-3">
            <h4 className="font-semibold text-red-700 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5" />
              Warning Signs Detected
            </h4>
            <ul className="mt-2 space-y-1">
              {result.redFlags.map((flag, i) => (
                <li key={i} className="text-sm text-red-600">
                  • {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Action */}
        <div className="bg-white rounded-xl p-3 border border-gray-200">
          <h4 className="font-semibold text-gray-800">Recommended Action</h4>
          <p className="text-sm text-gray-600 mt-1">{result.recommendedAction}</p>
        </div>

        {/* Department */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">Recommended Department:</span>
          <span className="px-3 py-1 bg-white rounded-full border border-gray-200">
            {result.recommendedDepartment}
          </span>
        </div>

        {/* Possible Conditions */}
        {result.possibleConditions.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Possible Conditions</h4>
            <div className="space-y-2">
              {result.possibleConditions.slice(0, 3).map((condition, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-200"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {condition.name}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    condition.severity === 'severe'
                      ? 'bg-red-100 text-red-700'
                      : condition.severity === 'moderate'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {condition.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Self-Care Advice */}
        {result.triageLevel === 'SELF_CARE' && result.selfCareAdvice.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Self-Care Tips</h4>
            <ul className="space-y-1">
              {result.selfCareAdvice.slice(0, 4).map((advice, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  {advice}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* When to Seek Help */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">When to Seek Help</h4>
          <ul className="space-y-1">
            {result.whenToSeekHelp.slice(0, 3).map((item, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-gray-500 italic border-t border-gray-200 pt-3">
          {result.disclaimer}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
      >
        <ChatBubbleLeftRightIcon className="w-7 h-7" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <SparklesIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold">AI Symptom Checker</h3>
                <p className="text-xs text-blue-100">Powered by Medical AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetChat}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Start Over"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {!isComplete && progress > 0 && (
            <div className="h-1 bg-gray-200">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3'
                      : message.type === 'system'
                      ? 'bg-red-100 border border-red-200 text-red-700 rounded-2xl px-4 py-3'
                      : 'bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm'
                  }`}
                >
                  {message.type === 'bot' && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 bg-blue-100 rounded-lg">
                        <SparklesIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-xs font-medium text-blue-600">
                        AI Assistant
                      </span>
                    </div>
                  )}
                  {message.type === 'user' && (
                    <div className="flex items-center gap-2 mb-2">
                      <UserIcon className="w-4 h-4 text-blue-100" />
                      <span className="text-xs text-blue-100">You</span>
                    </div>
                  )}
                  <p className={`text-sm ${message.type === 'bot' ? 'text-gray-700' : ''}`}>
                    {message.content}
                  </p>
                  {message.triageResult && renderTriageResult(message.triageResult)}
                </div>
              </div>
            ))}

            {/* Current Questions */}
            {!isComplete && currentQuestions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                {currentQuestions.map(renderQuestion)}
                <button
                  onClick={submitResponses}
                  disabled={isLoading || Object.keys(answers).length === 0}
                  className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-5 h-5" />
                      Continue
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Complete Button */}
            {isComplete && !triageResult && (
              <button
                onClick={completeAssessment}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Get My Assessment
                  </>
                )}
              </button>
            )}

            {/* Book Appointment Button */}
            {triageResult && triageResult.triageLevel !== 'SELF_CARE' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <button
                  onClick={() => window.location.href = '/appointments?action=new'}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  Book an Appointment
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Based on your symptoms, we recommend scheduling an appointment
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </>
  );
}
