import { useState, useRef, useEffect } from 'react';
import {
  MicrophoneIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  SparklesIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { SparklesIcon as SparklesSolid } from '@heroicons/react/24/solid';
import { publicApi } from '../../services/api';
import { useVoiceRecognition, useSpeechSynthesis } from '../../hooks/useVoiceRecognition';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  formUpdates?: Record<string, string>;
}

interface AIBookingAssistantProps {
  onFormUpdate: (updates: Record<string, string>) => void;
  currentFormData: Record<string, string>;
}

export default function AIBookingAssistant({ onFormUpdate, currentFormData }: AIBookingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI booking assistant. I can help you schedule an appointment. Just tell me about your symptoms or what kind of doctor you need to see, and I'll guide you through the booking process. You can also use voice input!",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice recognition
  const {
    transcript,
    listening,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceRecognition({
    continuous: true,
    language: 'en-US',
    onResult: (result) => {
      setInputValue(result.transcript);
    },
  });

  // Text-to-speech
  const { speak, stop: stopSpeaking, speaking, supported: ttsSupported } = useSpeechSynthesis();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update input when transcript changes
  useEffect(() => {
    if (transcript) {
      setInputValue(transcript);
    }
  }, [transcript]);

  const handleSendMessage = async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    resetTranscript();
    setIsLoading(true);

    try {
      const response = await publicApi.aiChat({
        message,
        context: { currentForm: currentFormData },
      });

      const data = response.data.data;

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        formUpdates: data.formUpdates,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Apply form updates if any
      if (data.formUpdates) {
        onFormUpdate(data.formUpdates);
      }

      // Speak the response
      if (ttsSupported && data.message) {
        // Clean markdown from message for speech
        const cleanMessage = data.message
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/#{1,6}\s/g, '')
          .replace(/\n/g, ' ');
        speak(cleanMessage, { rate: 1.1 });
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an issue processing your request. Please try again or fill out the form manually.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoice = () => {
    if (listening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const quickPrompts = [
    "I have a headache",
    "Schedule for tomorrow",
    "Morning appointment",
    "I need a checkup",
  ];

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-2xl shadow-purple-500/30 flex items-center justify-center hover:scale-110 transition-all duration-300 group ${
          isOpen ? 'hidden' : ''
        }`}
      >
        <SparklesSolid className="h-7 w-7 group-hover:animate-pulse" />
        <span className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-xs font-bold animate-bounce">
          AI
        </span>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-scale-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <SparklesIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Booking Assistant</h3>
                  <p className="text-xs text-white/80">Voice & Text enabled</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white'
                      : 'bg-white shadow-sm border border-gray-100'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                      <SparklesSolid className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-medium text-purple-600">AI Assistant</span>
                    </div>
                  )}
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap ${
                      message.role === 'user' ? '' : 'text-gray-700'
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: message.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                  {message.formUpdates && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-emerald-600 font-medium">Form updated with suggestions</p>
                    </div>
                  )}
                  <span
                    className={`text-xs mt-2 block ${
                      message.role === 'user' ? 'text-white/70' : 'text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 bg-white border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Quick prompts:</p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInputValue(prompt);
                    }}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded-full transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            {/* Voice Status */}
            {listening && (
              <div className="mb-3 p-2 bg-red-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-700">Listening...</span>
                </div>
                <button
                  onClick={stopListening}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Stop
                </button>
              </div>
            )}

            {speaking && (
              <div className="mb-3 p-2 bg-purple-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                  <span className="text-sm text-purple-700">Speaking...</span>
                </div>
                <button
                  onClick={stopSpeaking}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  Stop
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Voice Button */}
              {voiceSupported && (
                <button
                  onClick={toggleVoice}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                    listening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600'
                  }`}
                >
                  {listening ? (
                    <StopIcon className="h-5 w-5" />
                  ) : (
                    <MicrophoneIcon className="h-5 w-5" />
                  )}
                </button>
              )}

              {/* Text Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe your symptoms or ask me..."
                  className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                />
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-2">
              Powered by AI for smart appointment booking
            </p>
          </div>
        </div>
      )}
    </>
  );
}
