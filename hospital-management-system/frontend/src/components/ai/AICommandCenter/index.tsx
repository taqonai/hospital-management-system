import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MicrophoneIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  StopIcon,
  ArrowPathIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { MicrophoneIcon as MicrophoneSolidIcon } from '@heroicons/react/24/solid';
import { useAIContext } from '../../../providers/AIContextProvider';
import { useSpeechSynthesis } from '../../../hooks/useVoiceRecognition';
import { useHybridVoice } from '../../../hooks/useHybridVoice';
import { formatDuration } from '../../../hooks/useAudioRecorder';
import { useAIHealth } from '../../../hooks/useAI';
import { aiApi } from '../../../services/api';
import clsx from 'clsx';

export default function AICommandCenter() {
  const navigate = useNavigate();
  const {
    isOpen,
    messages,
    context,
    isProcessing,
    toggleAssistant,
    closeAssistant,
    setListening,
    addMessage,
    clearMessages,
    setProcessing,
    getQuickActions,
  } = useAIContext();

  const { data: healthStatus } = useAIHealth();
  const { speak } = useSpeechSynthesis();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAIOnline = healthStatus?.status === 'connected';

  // Hybrid voice recognition (Web Speech + Whisper)
  const handleVoiceResult = useCallback((result: { transcript: string; source: string }) => {
    if (result.transcript) {
      setInputValue(result.transcript);
      // Auto-submit after voice input
      handleSubmit(result.transcript);
    }
  }, []);

  const {
    transcript,
    interimTranscript,
    isListening: listening,
    isProcessing: voiceProcessing,
    recordingDuration,
    webSpeechSupported,
    whisperAvailable,
    startListening,
    stopListening,
    reset: resetVoice,
  } = useHybridVoice({
    confidenceThreshold: 0.75,
    onResult: handleVoiceResult,
    context: {
      currentModule: context.currentModule,
      currentPatient: context.currentPatient,
    },
  });

  const voiceSupported = webSpeechSupported || whisperAvailable;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Update listening state in context
  useEffect(() => {
    setListening(listening);
  }, [listening, setListening]);

  // Process AI command
  const processCommand = async (command: string): Promise<string> => {
    // Navigation commands
    const navPatterns: Record<string, string> = {
      'dashboard': '/dashboard',
      'patients': '/patients',
      'appointments': '/appointments',
      'doctors': '/doctors',
      'laboratory': '/laboratory',
      'lab': '/laboratory',
      'pharmacy': '/pharmacy',
      'ipd': '/ipd',
      'inpatient': '/ipd',
      'opd': '/opd',
      'outpatient': '/opd',
      'emergency': '/emergency',
      'radiology': '/radiology',
      'imaging': '/radiology',
      'surgery': '/surgery',
      'billing': '/billing',
      'ai assistant': '/ai-assistant',
      // HR Module
      'hr': '/hr',
      'human resources': '/hr',
      'employees': '/hr',
      'staff': '/hr',
      'payroll': '/hr',
      'attendance': '/hr',
      'leave': '/hr',
      // Housekeeping Module
      'housekeeping': '/housekeeping',
      'cleaning': '/housekeeping',
      'maintenance': '/housekeeping',
      'janitorial': '/housekeeping',
    };

    const lowerCommand = command.toLowerCase();

    // Check for navigation intent
    if (lowerCommand.includes('go to') || lowerCommand.includes('navigate to') || lowerCommand.includes('open') || lowerCommand.includes('show me')) {
      for (const [key, path] of Object.entries(navPatterns)) {
        if (lowerCommand.includes(key)) {
          navigate(path);
          return `Navigating to ${key}...`;
        }
      }
    }

    // ==================== HR MODULE COMMANDS ====================

    // Employee commands
    if (lowerCommand.includes('employee') || lowerCommand.includes('staff')) {
      if (lowerCommand.includes('new') || lowerCommand.includes('add') || lowerCommand.includes('create')) {
        navigate('/hr?tab=employees&action=new');
        return 'Opening new employee form...';
      }
      if (lowerCommand.includes('list') || lowerCommand.includes('all') || lowerCommand.includes('show')) {
        navigate('/hr?tab=employees');
        return 'Showing all employees...';
      }
    }

    // Attendance commands
    if (lowerCommand.includes('attendance')) {
      if (lowerCommand.includes('today')) {
        navigate('/hr?tab=attendance&filter=today');
        return 'Showing today\'s attendance records...';
      }
      if (lowerCommand.includes('absent')) {
        navigate('/hr?tab=attendance&filter=absent');
        return 'Showing absent employees...';
      }
      if (lowerCommand.includes('late')) {
        navigate('/hr?tab=attendance&filter=late');
        return 'Showing late arrivals...';
      }
      navigate('/hr?tab=attendance');
      return 'Opening attendance records...';
    }

    // Leave commands
    if (lowerCommand.includes('leave')) {
      if (lowerCommand.includes('pending') || lowerCommand.includes('approve') || lowerCommand.includes('request')) {
        navigate('/hr?tab=leave&filter=pending');
        return 'Showing pending leave requests...';
      }
      if (lowerCommand.includes('apply') || lowerCommand.includes('new')) {
        navigate('/hr?tab=leave&action=apply');
        return 'Opening leave application form...';
      }
      if (lowerCommand.includes('balance')) {
        navigate('/hr?tab=leave&view=balance');
        return 'Showing leave balances...';
      }
      navigate('/hr?tab=leave');
      return 'Opening leave management...';
    }

    // Payroll commands
    if (lowerCommand.includes('payroll') || lowerCommand.includes('salary') || lowerCommand.includes('payment')) {
      if (lowerCommand.includes('generate') || lowerCommand.includes('process')) {
        navigate('/hr?tab=payroll&action=generate');
        return 'Opening payroll generation...';
      }
      if (lowerCommand.includes('pending') || lowerCommand.includes('unpaid')) {
        navigate('/hr?tab=payroll&filter=pending');
        return 'Showing pending payroll...';
      }
      navigate('/hr?tab=payroll');
      return 'Opening payroll management...';
    }

    // Shift commands
    if (lowerCommand.includes('shift')) {
      if (lowerCommand.includes('new') || lowerCommand.includes('create') || lowerCommand.includes('add')) {
        navigate('/hr?tab=shifts&action=new');
        return 'Opening new shift form...';
      }
      if (lowerCommand.includes('assign')) {
        navigate('/hr?tab=shifts&action=assign');
        return 'Opening shift assignment...';
      }
      navigate('/hr?tab=shifts');
      return 'Showing shift schedules...';
    }

    // HR Dashboard
    if (lowerCommand.includes('hr') && (lowerCommand.includes('dashboard') || lowerCommand.includes('overview') || lowerCommand.includes('summary'))) {
      navigate('/hr');
      return 'Opening HR dashboard with overview...';
    }

    // ==================== HOUSEKEEPING MODULE COMMANDS ====================

    // Task commands
    if (lowerCommand.includes('task') && (lowerCommand.includes('clean') || lowerCommand.includes('housekeep') || context.currentModule === 'housekeeping')) {
      if (lowerCommand.includes('new') || lowerCommand.includes('create') || lowerCommand.includes('add')) {
        navigate('/housekeeping?tab=tasks&action=new');
        return 'Opening new cleaning task form...';
      }
      if (lowerCommand.includes('pending') || lowerCommand.includes('unassigned')) {
        navigate('/housekeeping?tab=tasks&filter=pending');
        return 'Showing pending cleaning tasks...';
      }
      if (lowerCommand.includes('urgent') || lowerCommand.includes('priority') || lowerCommand.includes('critical')) {
        navigate('/housekeeping?tab=tasks&filter=urgent');
        return 'Showing urgent cleaning tasks...';
      }
      if (lowerCommand.includes('today')) {
        navigate('/housekeeping?tab=tasks&filter=today');
        return 'Showing today\'s cleaning tasks...';
      }
      if (lowerCommand.includes('completed') || lowerCommand.includes('done')) {
        navigate('/housekeeping?tab=tasks&filter=completed');
        return 'Showing completed tasks...';
      }
      if (lowerCommand.includes('assign')) {
        navigate('/housekeeping?tab=tasks&action=assign');
        return 'Opening task assignment...';
      }
      navigate('/housekeeping?tab=tasks');
      return 'Showing cleaning tasks...';
    }

    // Zone commands
    if (lowerCommand.includes('zone') || lowerCommand.includes('area')) {
      if (lowerCommand.includes('new') || lowerCommand.includes('add') || lowerCommand.includes('create')) {
        navigate('/housekeeping?tab=zones&action=new');
        return 'Opening new zone form...';
      }
      navigate('/housekeeping?tab=zones');
      return 'Showing housekeeping zones...';
    }

    // Inventory commands (housekeeping supplies)
    if ((lowerCommand.includes('inventory') || lowerCommand.includes('supplies') || lowerCommand.includes('stock')) &&
        (lowerCommand.includes('clean') || lowerCommand.includes('housekeep') || context.currentModule === 'housekeeping')) {
      if (lowerCommand.includes('low') || lowerCommand.includes('reorder') || lowerCommand.includes('shortage')) {
        navigate('/housekeeping?tab=inventory&filter=low-stock');
        return 'Showing low stock cleaning supplies...';
      }
      if (lowerCommand.includes('add') || lowerCommand.includes('new')) {
        navigate('/housekeeping?tab=inventory&action=new');
        return 'Opening new inventory item form...';
      }
      navigate('/housekeeping?tab=inventory');
      return 'Showing cleaning inventory...';
    }

    // Quality audit commands
    if (lowerCommand.includes('audit') || lowerCommand.includes('inspection') || lowerCommand.includes('quality')) {
      if (lowerCommand.includes('new') || lowerCommand.includes('create') || lowerCommand.includes('start')) {
        navigate('/housekeeping?tab=audits&action=new');
        return 'Starting new quality audit...';
      }
      if (lowerCommand.includes('pending') || lowerCommand.includes('action')) {
        navigate('/housekeeping?tab=audits&filter=requires-action');
        return 'Showing audits requiring action...';
      }
      navigate('/housekeeping?tab=audits');
      return 'Showing quality audits...';
    }

    // Schedule commands
    if (lowerCommand.includes('schedule') && (lowerCommand.includes('clean') || lowerCommand.includes('housekeep') || context.currentModule === 'housekeeping')) {
      if (lowerCommand.includes('new') || lowerCommand.includes('create') || lowerCommand.includes('add')) {
        navigate('/housekeeping?tab=schedules&action=new');
        return 'Opening new cleaning schedule form...';
      }
      navigate('/housekeeping?tab=schedules');
      return 'Showing cleaning schedules...';
    }

    // Housekeeping Dashboard
    if (lowerCommand.includes('housekeep') && (lowerCommand.includes('dashboard') || lowerCommand.includes('overview') || lowerCommand.includes('summary'))) {
      navigate('/housekeeping');
      return 'Opening housekeeping dashboard...';
    }

    // Discharge cleaning
    if (lowerCommand.includes('discharge') && lowerCommand.includes('clean')) {
      navigate('/housekeeping?tab=tasks&filter=discharge');
      return 'Showing discharge cleaning tasks...';
    }

    // Terminal cleaning
    if (lowerCommand.includes('terminal') && lowerCommand.includes('clean')) {
      navigate('/housekeeping?tab=tasks&filter=terminal');
      return 'Showing terminal cleaning tasks...';
    }

    // ==================== GENERAL ACTIONS ====================

    // Check for specific actions
    if (lowerCommand.includes('new patient') || lowerCommand.includes('register patient')) {
      navigate('/patients?action=new');
      return 'Opening patient registration form...';
    }

    if (lowerCommand.includes('new appointment') || lowerCommand.includes('book appointment')) {
      navigate('/appointments?action=new');
      return 'Opening appointment booking form...';
    }

    if (lowerCommand.includes('critical') && lowerCommand.includes('lab')) {
      navigate('/laboratory?filter=critical');
      return 'Showing critical lab values...';
    }

    if (lowerCommand.includes('high risk') || lowerCommand.includes('high-risk')) {
      navigate('/patients?filter=high-risk');
      return 'Showing high-risk patients...';
    }

    // Try AI chat endpoint
    try {
      const response = await aiApi.chat({
        message: command,
        context: {
          currentPage: context.currentPage,
          currentModule: context.currentModule,
          patientId: context.currentPatient?.id,
        },
      });

      if (response.data?.data?.response) {
        return response.data.data.response;
      }
    } catch {
      // AI service not available, use fallback
    }

    // Default helpful response
    return `I understand you said: "${command}". I can help you with:

**Navigation:** "Go to HR", "Open housekeeping", "Show laboratory"

**HR Commands:**
- "Show employees" / "Show attendance"
- "Pending leave requests" / "Apply for leave"
- "Generate payroll" / "Show shifts"

**Housekeeping Commands:**
- "Show cleaning tasks" / "Pending tasks"
- "Low stock supplies" / "Show zones"
- "Quality audits" / "Discharge cleaning"

**Other:** "New patient", "Book appointment", "Critical lab values"

What would you like to do?`;
  };

  const handleSubmit = async (text?: string) => {
    const command = text || inputValue.trim();
    if (!command) return;

    // Add user message
    addMessage({ role: 'user', content: command });
    setInputValue('');
    resetVoice();
    setProcessing(true);

    try {
      const response = await processCommand(command);
      addMessage({ role: 'assistant', content: response });

      // Speak the response if it's short
      if (response.length < 200) {
        speak(response);
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleVoiceToggle = async () => {
    if (listening) {
      await stopListening();
    } else {
      resetVoice();
      await startListening();
    }
  };

  const quickActions = getQuickActions();

  if (!isOpen) {
    // Floating Action Button
    return (
      <button
        onClick={toggleAssistant}
        className={clsx(
          'fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110',
          isAIOnline
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
            : 'bg-gray-400 text-white'
        )}
        title={isAIOnline ? 'AI Assistant' : 'AI Offline'}
      >
        <SparklesIcon className="h-6 w-6" />
        {isAIOnline && (
          <span className="absolute top-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-white" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5" />
          <span className="font-semibold">AI Assistant</span>
          {isAIOnline ? (
            <span className="text-xs bg-green-500 px-2 py-0.5 rounded-full">Online</span>
          ) : (
            <span className="text-xs bg-red-500 px-2 py-0.5 rounded-full">Offline</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="p-1 hover:bg-white/20 rounded"
            title="Clear chat"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
          <button
            onClick={closeAssistant}
            className="p-1 hover:bg-white/20 rounded"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Context Bar */}
      <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-500">
        <span>Context: </span>
        <span className="font-medium text-gray-700 capitalize">
          {context.currentModule || 'Dashboard'}
        </span>
        {context.currentPatient && (
          <span className="ml-2">
            | Patient: <span className="font-medium text-gray-700">{context.currentPatient.name}</span>
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[300px]">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <SparklesIcon className="h-12 w-12 mx-auto text-purple-300 mb-3" />
            <p className="font-medium">How can I help you?</p>
            <p className="text-sm mt-1">Try voice or type a command</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'max-w-[85%] p-3 rounded-xl text-sm',
                msg.role === 'user'
                  ? 'ml-auto bg-purple-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              )}
            >
              {msg.content}
            </div>
          ))
        )}
        {isProcessing && (
          <div className="bg-gray-100 p-3 rounded-xl rounded-bl-sm max-w-[85%]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {quickActions.slice(0, 4).map((action) => (
              <button
                key={action.id}
                onClick={() => handleSubmit(action.command)}
                className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice Status */}
      {(listening || voiceProcessing) && (
        <div className={clsx(
          "px-4 py-2 border-t",
          voiceProcessing ? "bg-purple-50 border-purple-100" : "bg-red-50 border-red-100"
        )}>
          <div className={clsx(
            "flex items-center justify-center gap-2",
            voiceProcessing ? "text-purple-600" : "text-red-600"
          )}>
            {voiceProcessing ? (
              <>
                <SignalIcon className="h-4 w-4 animate-pulse" />
                <span className="text-sm font-medium">
                  {whisperAvailable ? 'Processing with Whisper...' : 'Processing...'}
                </span>
              </>
            ) : (
              <>
                <MicrophoneSolidIcon className="h-4 w-4 animate-pulse" />
                <span className="text-sm font-medium">
                  Listening... {formatDuration(recordingDuration)}
                </span>
              </>
            )}
            {(interimTranscript || transcript) && (
              <span className="text-xs truncate max-w-[180px]">
                "{interimTranscript || transcript}"
              </span>
            )}
          </div>
          {whisperAvailable && listening && (
            <div className="text-center mt-1">
              <span className="text-xs text-gray-500">
                Whisper AI backup enabled
              </span>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-white">
        <div className="flex items-center gap-2">
          {voiceSupported && (
            <button
              onClick={handleVoiceToggle}
              disabled={!isAIOnline || voiceProcessing}
              className={clsx(
                'p-2 rounded-full transition-colors',
                listening
                  ? 'bg-red-500 text-white animate-pulse'
                  : voiceProcessing
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              title={
                listening
                  ? 'Stop listening'
                  : voiceProcessing
                    ? 'Processing...'
                    : whisperAvailable
                      ? 'Voice input (Whisper enhanced)'
                      : 'Start voice input'
              }
            >
              {listening ? (
                <StopIcon className="h-5 w-5" />
              ) : voiceProcessing ? (
                <SignalIcon className="h-5 w-5 animate-pulse" />
              ) : (
                <MicrophoneIcon className="h-5 w-5" />
              )}
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={
              listening
                ? 'Listening...'
                : voiceProcessing
                  ? 'Processing voice...'
                  : 'Type or speak...'
            }
            className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={listening || isProcessing || voiceProcessing}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!inputValue.trim() || isProcessing || voiceProcessing}
            className={clsx(
              'p-2 rounded-full transition-colors',
              inputValue.trim()
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-100 text-gray-400'
            )}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
        {/* Whisper indicator */}
        {whisperAvailable && !listening && !voiceProcessing && (
          <div className="text-center mt-1">
            <span className="text-xs text-green-600">Whisper AI enabled</span>
          </div>
        )}
      </div>
    </div>
  );
}
