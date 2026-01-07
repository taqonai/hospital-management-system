import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  HeartIcon,
  ShieldCheckIcon,
  CalendarDaysIcon,
  BeakerIcon,
  DocumentTextIcon,
  ClockIcon,
  ArrowPathIcon,
  UserCircleIcon,
  XMarkIcon,
  MicrophoneIcon,
  PlusCircleIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'action';
  actions?: Array<{
    label: string;
    route: string;
    icon?: string;
  }>;
}

const QUICK_ACTIONS = [
  { label: 'Check Symptoms', route: '/patient-portal/symptom-checker', icon: HeartIcon },
  { label: 'Book Appointment', route: '/patient-portal/appointments', icon: CalendarDaysIcon },
  { label: 'View Lab Results', route: '/patient-portal/labs', icon: BeakerIcon },
  { label: 'My Prescriptions', route: '/patient-portal/prescriptions', icon: DocumentTextIcon },
];

const SUGGESTED_QUESTIONS = [
  "What do my recent lab results mean?",
  "How should I take my medications?",
  "When should I see a doctor?",
  "What are common cold symptoms?",
  "How can I improve my sleep?",
  "What foods should I avoid with diabetes?",
];

export default function HealthAssistant() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add initial greeting
    const greeting: Message = {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI Health Assistant. I can help you with health questions, understand your medical information, and guide you to the right resources. How can I help you today?",
      timestamp: new Date(),
      type: 'text',
    };
    setMessages([greeting]);
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setShowSuggestions(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const patientToken = localStorage.getItem('patientPortalToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (patientToken) {
        headers['Authorization'] = `Bearer ${patientToken}`;
      }

      const response = await fetch(`${API_URL}/patient-portal/ai-chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: content,
          context: 'health_assistant',
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const result = data.data || data;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response || result.message || "I apologize, but I couldn't process your request. Please try again.",
        timestamp: new Date(),
        type: 'text',
        actions: result.suggestedActions,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);

      // Provide a helpful fallback response
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getLocalResponse(content),
        timestamp: new Date(),
        type: 'text',
      };

      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getLocalResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('appointment') || lowerQuery.includes('book') || lowerQuery.includes('schedule')) {
      return "I can help you book an appointment! You can use our Symptom Checker for AI-guided booking recommendations, or book directly if you know which department you need. Would you like me to guide you to the booking page?";
    }

    if (lowerQuery.includes('symptom') || lowerQuery.includes('feel') || lowerQuery.includes('pain') || lowerQuery.includes('sick')) {
      return "I understand you're experiencing symptoms. For a proper assessment, I recommend using our AI Symptom Checker. It will ask you detailed questions and provide personalized recommendations. Would you like to start a symptom check?";
    }

    if (lowerQuery.includes('lab') || lowerQuery.includes('test') || lowerQuery.includes('result')) {
      return "You can view your lab results in the Lab Results section. Each result includes reference ranges and explanations. If you have specific questions about your results, I recommend discussing them with your doctor.";
    }

    if (lowerQuery.includes('medication') || lowerQuery.includes('prescription') || lowerQuery.includes('medicine') || lowerQuery.includes('drug')) {
      return "Your current prescriptions are available in the Prescriptions section. Always take medications as prescribed and consult your doctor before making any changes. If you're experiencing side effects, please contact your healthcare provider.";
    }

    if (lowerQuery.includes('emergency') || lowerQuery.includes('urgent') || lowerQuery.includes('serious')) {
      return "If you're experiencing a medical emergency, please call 911 immediately. Signs of emergency include severe chest pain, difficulty breathing, severe bleeding, or signs of stroke. Don't delay seeking emergency care.";
    }

    if (lowerQuery.includes('billing') || lowerQuery.includes('payment') || lowerQuery.includes('invoice') || lowerQuery.includes('bill')) {
      return "You can view and manage your bills in the Billing section. There you'll find your invoices, payment history, and options for online payment.";
    }

    return "I'm here to help with your health questions. You can ask me about:\n\n• Understanding symptoms and when to seek care\n• Your medications and prescriptions\n• Lab results and what they mean\n• Booking appointments\n• General health and wellness tips\n\nWhat would you like to know more about?";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleQuickAction = (route: string) => {
    navigate(route);
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const startNewChat = () => {
    const greeting: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "Hello! I'm your AI Health Assistant. How can I help you today?",
      timestamp: new Date(),
      type: 'text',
    };
    setMessages([greeting]);
    setShowSuggestions(true);
    setInputValue('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto p-4 lg:p-6 h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white shadow-lg">
                <SparklesIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Health Assistant</h1>
                <p className="text-sm text-gray-500">Your personal health guide</p>
              </div>
            </div>
            <button
              onClick={startNewChat}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <PlusCircleIcon className="h-5 w-5" />
              New Chat
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.route}
              onClick={() => handleQuickAction(action.route)}
              className="flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-md transition-all"
            >
              <action.icon className="h-4 w-4 text-blue-600" />
              {action.label}
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <SparklesIcon className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">AI Assistant</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* Action buttons if provided */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
                      {message.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => navigate(action.route)}
                          className="px-3 py-1.5 bg-white rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="block text-xs mt-2 opacity-60">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <SparklesIcon className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {showSuggestions && messages.length <= 1 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                <LightBulbIcon className="h-4 w-4 text-amber-500" />
                Suggested questions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_QUESTIONS.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="text-left p-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  >
                    <QuestionMarkCircleIcon className="h-4 w-4 text-blue-500 inline mr-2" />
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about your health..."
                  rows={1}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || isLoading}
                className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              This AI assistant provides general health information and is not a substitute for professional medical advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
