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
  ShieldCheckIcon,
  PhoneIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
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

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const startSession = async () => {
    setHasStarted(true);
    setIsLoading(true);
    try {
      const response = await symptomCheckerApi.startSession();
      const data = response.data.data;
      setSessionId(data.sessionId);
      setProgress(data.progress || 0);
      if (data.redFlagDetected && data.redFlagMessage) {
        setMessages([{ id: '1', type: 'bot', content: data.message || 'Welcome to the Symptom Checker.', timestamp: new Date() }, { id: '2', type: 'system', content: data.redFlagMessage, timestamp: new Date() }]);
      } else {
        setMessages([{ id: '1', type: 'bot', content: data.message || "Hello! I'm your AI health assistant. Let's get started!", timestamp: new Date(), questions: data.nextQuestions }]);
        setCurrentQuestions(data.nextQuestions || []);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      setMessages([{ id: '1', type: 'bot', content: 'Sorry, I encountered an error. Please try again later.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitResponses = async () => {
    if (!sessionId || Object.keys(answers).length === 0) return;
    setIsLoading(true);
    const userResponses = Object.entries(answers).map(([id, answer]) => {
      const question = currentQuestions.find((q) => q.id === id);
      if (Array.isArray(answer)) return answer.join(', ');
      if (question?.type === 'select' && question.options) {
        const option = question.options.find((o) => o.value === answer);
        return option?.label || answer;
      }
      return String(answer);
    }).join('; ');
    setMessages((prev) => [...prev, { id: 'user-' + Date.now(), type: 'user', content: userResponses, timestamp: new Date() }]);
    try {
      const response = await symptomCheckerApi.respond({ sessionId, responses: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })) });
      const data = response.data.data;
      setProgress(data.progress || 0);
      setAnswers({});
      if (data.redFlagDetected && data.redFlagMessage) {
        setMessages((prev) => [...prev, { id: 'system-' + Date.now(), type: 'system', content: data.redFlagMessage, timestamp: new Date() }]);
        setIsComplete(true);
        await completeAssessment();
        return;
      }
      if (data.isComplete) {
        setIsComplete(true);
        await completeAssessment();
      } else {
        setMessages((prev) => [...prev, { id: 'bot-' + Date.now(), type: 'bot', content: data.message || "Thanks! Here are more questions:", timestamp: new Date(), questions: data.nextQuestions }]);
        setCurrentQuestions(data.nextQuestions || []);
      }
    } catch (error) {
      console.error('Failed to submit responses:', error);
      setMessages((prev) => [...prev, { id: 'error-' + Date.now(), type: 'bot', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() }]);
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
      setMessages((prev) => [...prev, { id: 'result-' + Date.now(), type: 'bot', content: 'Based on your symptoms, here is my assessment:', timestamp: new Date(), triageResult: result }]);
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
    setHasStarted(false);
  };

  const renderQuestion = (question: Question) => {
    switch (question.type) {
      case 'text':
      case 'multitext':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{question.question}</label>
            {question.helpText && <p className="text-xs text-gray-500 mb-2">{question.helpText}</p>}
            <textarea className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" rows={3} placeholder={question.placeholder} value={answers[question.id] || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))} />
          </div>
        );
      case 'select':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{question.question}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {question.options?.map((option) => (
                <button key={option.value} className={'text-left px-4 py-3 rounded-xl border transition-all ' + (answers[question.id] === option.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')} onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.value }))}>{option.label}</button>
              ))}
            </div>
          </div>
        );
      case 'multiselect':
        return (
          <div key={question.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{question.question}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {question.options?.map((option) => {
                const selectedValues = answers[question.id] || [];
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button key={option.value} className={'text-left px-4 py-3 rounded-xl border transition-all ' + (isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')} onClick={() => { const current = answers[question.id] || []; const updated = isSelected ? current.filter((v: string) => v !== option.value) : [...current, option.value]; setAnswers((prev) => ({ ...prev, [question.id]: updated })); }}>
                    <div className="flex items-center gap-3">
                      <div className={'w-5 h-5 rounded border-2 flex items-center justify-center ' + (isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300')}>{isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}</div>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{question.question}</label>
            <div className="px-4">
              <input type="range" min={question.min || 1} max={question.max || 10} value={scaleValue} onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: parseInt(e.target.value) }))} className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              <div className="flex justify-between text-sm text-gray-500 mt-3">
                <span>{question.labels?.['1'] || 'Low'}</span>
                <span className="text-2xl font-bold text-blue-600">{scaleValue}</span>
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
      <div className="space-y-6 mt-4">
        <div className={'rounded-2xl border-2 p-6 ' + config.borderColor + ' ' + config.bgColor}>
          <div className="flex items-center gap-4 mb-4">
            <div className={'p-4 rounded-2xl ' + config.color}><TriageIcon className="w-8 h-8 text-white" /></div>
            <div>
              <h3 className={'text-2xl font-bold ' + config.textColor}>{config.label}</h3>
              <p className="text-gray-600">{config.description}</p>
            </div>
            <div className="ml-auto text-right">
              <div className={'text-3xl font-bold ' + config.textColor}>{result.urgencyScore}/10</div>
              <p className="text-xs text-gray-500">Urgency Score</p>
            </div>
          </div>
          {result.redFlags.length > 0 && (
            <div className="bg-red-100 border border-red-200 rounded-xl p-4 mb-4">
              <h4 className="font-semibold text-red-700 flex items-center gap-2 mb-2"><ExclamationTriangleIcon className="w-5 h-5" />Warning Signs Detected</h4>
              <ul className="space-y-1">{result.redFlags.map((flag, i) => <li key={i} className="text-sm text-red-600">• {flag}</li>)}</ul>
            </div>
          )}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-2">Recommended Action</h4>
            <p className="text-gray-600">{result.recommendedAction}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><CalendarDaysIcon className="w-5 h-5 text-blue-500" />Recommended Department</h4>
            <div className="px-4 py-3 bg-blue-50 rounded-xl text-blue-700 font-medium text-center text-lg">{result.recommendedDepartment}</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-800 mb-4">Possible Conditions</h4>
            <div className="space-y-2">
              {result.possibleConditions.slice(0, 3).map((condition, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="font-medium text-gray-700">{condition.name}</span>
                  <span className={'text-xs px-2 py-1 rounded-full ' + (condition.severity === 'severe' ? 'bg-red-100 text-red-700' : condition.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}>{condition.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          {result.triageLevel !== 'SELF_CARE' && (
            <button onClick={() => window.location.href = '/appointments?action=new'} className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"><CalendarDaysIcon className="w-5 h-5" />Book an Appointment</button>
          )}
          {result.triageLevel === 'EMERGENCY' && (
            <a href="tel:911" className="flex-1 px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"><PhoneIcon className="w-5 h-5" />Call Emergency (911)</a>
          )}
          <button onClick={resetChat} className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2"><ArrowPathIcon className="w-5 h-5" />Start Over</button>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-start gap-3"><InformationCircleIcon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" /><p className="text-xs text-gray-500">{result.disclaimer}</p></div>
        </div>
      </div>
    );
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="inline-flex p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl mb-6"><SparklesIcon className="w-12 h-12 text-white" /></div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">AI Symptom Checker</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Get instant guidance on your symptoms with our AI-powered health assistant.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="p-3 bg-blue-100 rounded-xl w-fit mb-4"><ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-600" /></div>
              <h3 className="font-semibold text-gray-800 mb-2">Easy Conversation</h3>
              <p className="text-sm text-gray-600">Answer simple questions about your symptoms.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="p-3 bg-green-100 rounded-xl w-fit mb-4"><ShieldCheckIcon className="w-6 h-6 text-green-600" /></div>
              <h3 className="font-semibold text-gray-800 mb-2">Safe Triage</h3>
              <p className="text-sm text-gray-600">Get urgency level recommendations.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="p-3 bg-purple-100 rounded-xl w-fit mb-4"><CalendarDaysIcon className="w-6 h-6 text-purple-600" /></div>
              <h3 className="font-semibold text-gray-800 mb-2">Book Appointments</h3>
              <p className="text-sm text-gray-600">Schedule appointments based on results.</p>
            </div>
          </div>
          <div className="text-center">
            <button onClick={startSession} className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium text-lg hover:shadow-lg transition-all inline-flex items-center gap-3"><SparklesIcon className="w-6 h-6" />Start Symptom Check</button>
            <p className="text-sm text-gray-500 mt-4">Takes about 2-3 minutes</p>
          </div>
          <div className="mt-12 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3"><ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" /><div><h4 className="font-medium text-amber-800">Important Disclaimer</h4><p className="text-sm text-amber-700 mt-1">This symptom checker is for informational purposes only and is not a substitute for professional medical advice.</p></div></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl"><SparklesIcon className="w-6 h-6 text-white" /></div>
            <div><h1 className="text-2xl font-bold text-gray-900">AI Symptom Checker</h1><p className="text-sm text-gray-500">Powered by Medical AI</p></div>
          </div>
          <button onClick={resetChat} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all flex items-center gap-2"><ArrowPathIcon className="w-5 h-5" />Start Over</button>
        </div>
        {!isComplete && progress > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2"><span>Progress</span><span>{progress}%</span></div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300" style={{ width: progress + '%' }} /></div>
          </div>
        )}
        <div className="space-y-4 mb-6">
          {messages.map((message) => (
            <div key={message.id} className={'flex ' + (message.type === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={'max-w-[80%] ' + (message.type === 'user' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl rounded-br-md px-6 py-4' : message.type === 'system' ? 'bg-red-100 border-2 border-red-200 text-red-700 rounded-2xl px-6 py-4' : 'bg-white border border-gray-200 rounded-2xl rounded-bl-md px-6 py-4 shadow-sm')}>
                {message.type === 'bot' && <div className="flex items-center gap-2 mb-3"><div className="p-1.5 bg-blue-100 rounded-lg"><SparklesIcon className="w-4 h-4 text-blue-600" /></div><span className="text-sm font-medium text-blue-600">AI Assistant</span></div>}
                {message.type === 'user' && <div className="flex items-center gap-2 mb-2"><UserIcon className="w-4 h-4 text-blue-100" /><span className="text-sm text-blue-100">You</span></div>}
                {message.type === 'system' && <div className="flex items-center gap-2 mb-2"><ExclamationTriangleIcon className="w-5 h-5" /><span className="font-semibold">Warning</span></div>}
                <p className={message.type === 'bot' ? 'text-gray-700' : ''}>{message.content}</p>
                {message.triageResult && renderTriageResult(message.triageResult)}
              </div>
            </div>
          ))}
          {!isComplete && currentQuestions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              {currentQuestions.map(renderQuestion)}
              <button onClick={submitResponses} disabled={isLoading || Object.keys(answers).length === 0} className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isLoading ? <><ArrowPathIcon className="w-5 h-5 animate-spin" />Processing...</> : <><PaperAirplaneIcon className="w-5 h-5" />Continue</>}
              </button>
            </div>
          )}
          {isLoading && messages.length > 0 && !currentQuestions.length && (
            <div className="flex justify-start"><div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-sm"><div className="flex items-center gap-3"><ArrowPathIcon className="w-5 h-5 animate-spin text-blue-500" /><span className="text-gray-600">Analyzing your responses...</span></div></div></div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
