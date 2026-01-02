import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';

// Types
export interface SymptomQuestion {
  id: string;
  type: 'text' | 'select' | 'multiselect' | 'scale' | 'body-part';
  question: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  placeholder?: string;
  help_text?: string;
  min?: number;
  max?: number;
  labels?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  question?: SymptomQuestion;
  isRedFlag?: boolean;
  isTyping?: boolean;
}

export interface TriageResult {
  session_id: string;
  urgency: 'self-care' | 'routine' | 'urgent' | 'emergency';
  urgency_level: 1 | 2 | 3 | 4;
  urgency_color: 'green' | 'yellow' | 'orange' | 'red';
  primary_concern: string;
  body_part: string;
  severity: string;
  symptoms_summary: string[];
  possible_conditions: Array<{ name: string; likelihood: string; note: string }>;
  recommended_department: string;
  estimated_wait_time?: string;
  follow_up_questions: string[];
  self_care_advice: string[];
  when_to_seek_help: string[];
  red_flags_present: boolean;
  red_flag_symptoms: string[];
  disclaimer: string;
}

export interface SessionResponse {
  session_id: string;
  message: string;
  question?: SymptomQuestion;
  progress: number;
  is_complete?: boolean;
  red_flag_detected?: boolean;
  red_flag_message?: string;
}

export interface AnswerResponse extends SessionResponse {
  transition_message?: string;
}

// API Base URL
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Symptom Checker Session Hook
export function useSymptomCheckerSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<SymptomQuestion | null>(null);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [redFlagDetected, setRedFlagDetected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Add message helper with typing animation support
  const addMessage = useCallback((
    type: 'bot' | 'user',
    content: string,
    question?: SymptomQuestion,
    isRedFlag = false
  ) => {
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      question,
      isRedFlag,
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // Simulate typing delay for bot messages
  const addBotMessageWithTyping = useCallback(async (
    content: string,
    question?: SymptomQuestion,
    isRedFlag = false,
    delay = 800
  ) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, delay));
    setIsTyping(false);
    addMessage('bot', content, question, isRedFlag);
  }, [addMessage]);

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async (data?: { patientId?: string; patientAge?: number; patientGender?: string }) => {
      try {
        const response = await fetch(`${API_URL}/patient-portal/symptom-check/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data || {}),
        });

        if (!response.ok) throw new Error('Failed to start session');

        const result = await response.json();
        return result.data as SessionResponse;
      } catch (error) {
        // Fallback for development/testing
        return {
          session_id: `local-${Date.now()}`,
          message: "Welcome to the Symptom Checker. I'm here to help you understand your symptoms and provide guidance on the best next steps for your care.",
          progress: 5,
        } as SessionResponse;
      }
    },
    onSuccess: async (data) => {
      setSessionId(data.session_id);
      setProgress(data.progress);
      setIsComplete(false);
      setTriageResult(null);
      setRedFlagDetected(false);

      await addBotMessageWithTyping(data.message);

      if (data.question) {
        setCurrentQuestion(data.question);
        await addBotMessageWithTyping(data.question.question, data.question, false, 500);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start symptom checker');
    },
  });

  // Reset session
  const resetSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setCurrentQuestion(null);
    setProgress(0);
    setIsComplete(false);
    setTriageResult(null);
    setIsTyping(false);
    setRedFlagDetected(false);
  }, []);

  // Start new session
  const startSession = useCallback((data?: { patientId?: string; patientAge?: number; patientGender?: string }) => {
    resetSession();
    startSessionMutation.mutate(data);
  }, [resetSession, startSessionMutation]);

  return {
    sessionId,
    messages,
    setMessages,
    currentQuestion,
    setCurrentQuestion,
    progress,
    setProgress,
    isComplete,
    setIsComplete,
    triageResult,
    setTriageResult,
    isTyping,
    setIsTyping,
    redFlagDetected,
    setRedFlagDetected,
    messagesEndRef,
    addMessage,
    addBotMessageWithTyping,
    startSession,
    resetSession,
    isStarting: startSessionMutation.isPending,
    startError: startSessionMutation.error,
  };
}

// Symptom Response Hook
export function useSymptomResponse() {
  const submitAnswerMutation = useMutation({
    mutationFn: async (data: {
      sessionId: string;
      questionId: string;
      answer: string | string[] | number;
    }) => {
      try {
        const response = await fetch(`${API_URL}/patient-portal/symptom-check/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Failed to submit answer');

        const result = await response.json();
        return result.data as AnswerResponse;
      } catch (error) {
        // Return mock response for development
        throw error;
      }
    },
  });

  const completeAssessmentMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      try {
        const response = await fetch(`${API_URL}/patient-portal/symptom-check/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) throw new Error('Failed to complete assessment');

        const result = await response.json();
        return result.data as TriageResult;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Symptom assessment complete');
    },
    onError: () => {
      toast.error('Failed to generate results');
    },
  });

  return {
    submitAnswer: submitAnswerMutation.mutate,
    submitAnswerAsync: submitAnswerMutation.mutateAsync,
    isSubmitting: submitAnswerMutation.isPending,
    submitError: submitAnswerMutation.error,
    completeAssessment: completeAssessmentMutation.mutate,
    completeAssessmentAsync: completeAssessmentMutation.mutateAsync,
    isCompleting: completeAssessmentMutation.isPending,
    completeError: completeAssessmentMutation.error,
  };
}

// Body parts data
export const BODY_PARTS = [
  { id: 'head', name: 'Head', icon: 'brain', description: 'Headache, dizziness, vision issues', emoji: '' },
  { id: 'eyes', name: 'Eyes', icon: 'eye', description: 'Vision changes, pain, redness', emoji: '' },
  { id: 'ears', name: 'Ears', icon: 'ear', description: 'Pain, hearing issues, discharge', emoji: '' },
  { id: 'nose_sinuses', name: 'Nose/Sinuses', icon: 'nose', description: 'Congestion, bleeding, smell loss', emoji: '' },
  { id: 'throat_neck', name: 'Throat/Neck', icon: 'neck', description: 'Sore throat, swelling, stiffness', emoji: '' },
  { id: 'chest', name: 'Chest', icon: 'heart', description: 'Pain, breathing issues, palpitations', emoji: '' },
  { id: 'abdomen', name: 'Abdomen', icon: 'stomach', description: 'Pain, nausea, digestive issues', emoji: '' },
  { id: 'back', name: 'Back', icon: 'spine', description: 'Pain, stiffness, numbness', emoji: '' },
  { id: 'arms_hands', name: 'Arms/Hands', icon: 'arm', description: 'Pain, weakness, numbness', emoji: '' },
  { id: 'legs_feet', name: 'Legs/Feet', icon: 'leg', description: 'Pain, swelling, weakness', emoji: '' },
  { id: 'skin', name: 'Skin', icon: 'skin', description: 'Rash, itching, wounds', emoji: '' },
  { id: 'general', name: 'General/Whole Body', icon: 'body', description: 'Fever, fatigue, weight changes', emoji: '' },
];

// Common symptoms for quick selection
export const COMMON_SYMPTOMS = [
  { id: 'headache', label: 'Headache', category: 'head' },
  { id: 'fever', label: 'Fever', category: 'general' },
  { id: 'cough', label: 'Cough', category: 'chest' },
  { id: 'sore_throat', label: 'Sore Throat', category: 'throat_neck' },
  { id: 'fatigue', label: 'Fatigue', category: 'general' },
  { id: 'nausea', label: 'Nausea', category: 'abdomen' },
  { id: 'dizziness', label: 'Dizziness', category: 'head' },
  { id: 'body_aches', label: 'Body Aches', category: 'general' },
  { id: 'shortness_of_breath', label: 'Shortness of Breath', category: 'chest' },
  { id: 'chest_pain', label: 'Chest Pain', category: 'chest' },
  { id: 'abdominal_pain', label: 'Abdominal Pain', category: 'abdomen' },
  { id: 'back_pain', label: 'Back Pain', category: 'back' },
];

// Duration options
export const DURATION_OPTIONS = [
  { value: 'less_than_24h', label: 'Less than 24 hours' },
  { value: '1_3_days', label: '1-3 days' },
  { value: '4_7_days', label: '4-7 days' },
  { value: '1_2_weeks', label: '1-2 weeks' },
  { value: '2_4_weeks', label: '2-4 weeks' },
  { value: 'more_than_month', label: 'More than a month' },
];

// Severity options
export const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', description: 'Noticeable but not affecting daily activities', color: 'green' },
  { value: 'moderate', label: 'Moderate', description: 'Affecting some daily activities', color: 'yellow' },
  { value: 'severe', label: 'Severe', description: 'Significantly impacting daily life', color: 'orange' },
  { value: 'very_severe', label: 'Very Severe', description: 'Unable to perform normal activities', color: 'red' },
];

// Helper function to get triage level styling
export function getTriageLevelStyles(urgency: string) {
  switch (urgency) {
    case 'emergency':
      return {
        bg: 'bg-red-50',
        border: 'border-red-300',
        text: 'text-red-800',
        badge: 'bg-red-600 text-white',
        gradient: 'from-red-500 to-red-600',
        color: 'red',
        label: 'Emergency',
        description: 'Seek Immediate Medical Care',
        waitTime: 'Immediate',
      };
    case 'urgent':
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-300',
        text: 'text-orange-800',
        badge: 'bg-orange-500 text-white',
        gradient: 'from-orange-500 to-orange-600',
        color: 'orange',
        label: 'Urgent Care',
        description: 'Visit Urgent Care Today',
        waitTime: '1-4 hours',
      };
    case 'routine':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-300',
        text: 'text-yellow-800',
        badge: 'bg-yellow-500 text-white',
        gradient: 'from-yellow-500 to-yellow-600',
        color: 'yellow',
        label: 'Routine Care',
        description: 'Schedule an Appointment',
        waitTime: '1-3 days',
      };
    default:
      return {
        bg: 'bg-green-50',
        border: 'border-green-300',
        text: 'text-green-800',
        badge: 'bg-green-600 text-white',
        gradient: 'from-green-500 to-green-600',
        color: 'green',
        label: 'Self-Care',
        description: 'Manage at Home',
        waitTime: 'As needed',
      };
  }
}

// Map urgency to color
export function getUrgencyColor(urgency: string): 'red' | 'orange' | 'yellow' | 'green' {
  switch (urgency) {
    case 'emergency':
      return 'red';
    case 'urgent':
    case 'urgent-care':
      return 'orange';
    case 'routine':
    case 'schedule-appointment':
      return 'yellow';
    default:
      return 'green';
  }
}

// Generate mock triage result for development/fallback
export function generateMockTriageResult(params: {
  bodyPart: string;
  symptoms: string[];
  duration?: string;
  severity?: string;
}): TriageResult {
  const { bodyPart, symptoms, duration, severity } = params;

  // Determine urgency based on severity
  let urgency: TriageResult['urgency'] = 'self-care';
  let urgencyLevel: 1 | 2 | 3 | 4 = 1;

  if (severity === 'very_severe' || symptoms.some(s =>
    s.toLowerCase().includes('chest pain') ||
    s.toLowerCase().includes('difficulty breathing')
  )) {
    urgency = 'emergency';
    urgencyLevel = 4;
  } else if (severity === 'severe') {
    urgency = 'urgent';
    urgencyLevel = 3;
  } else if (severity === 'moderate') {
    urgency = 'routine';
    urgencyLevel = 2;
  }

  const bodyPartName = BODY_PARTS.find(p => p.id === bodyPart)?.name || bodyPart;

  return {
    session_id: `mock-${Date.now()}`,
    urgency,
    urgency_level: urgencyLevel,
    urgency_color: getUrgencyColor(urgency),
    primary_concern: symptoms[0] || 'General discomfort',
    body_part: bodyPartName,
    severity: severity || 'moderate',
    symptoms_summary: symptoms,
    possible_conditions: [
      { name: 'Common condition related to symptoms', likelihood: 'Moderate', note: 'Based on symptoms described' },
      { name: 'Alternative condition', likelihood: 'Low', note: 'Less likely based on presentation' },
    ],
    recommended_department: bodyPart === 'chest' ? 'Cardiology' :
                            bodyPart === 'head' ? 'Neurology' :
                            bodyPart === 'abdomen' ? 'Gastroenterology' : 'General Medicine',
    estimated_wait_time: getTriageLevelStyles(urgency).waitTime,
    follow_up_questions: [
      'Have you taken any medications for this?',
      'Is this a recurring issue?',
    ],
    self_care_advice: [
      'Get adequate rest',
      'Stay hydrated',
      'Monitor your symptoms',
      'Avoid strenuous activities',
    ],
    when_to_seek_help: [
      'If symptoms worsen significantly',
      'If you develop fever above 101F (38.3C)',
      'If symptoms persist for more than a week',
      'If you experience severe pain',
    ],
    red_flags_present: urgency === 'emergency',
    red_flag_symptoms: urgency === 'emergency' ? ['Severe symptoms detected'] : [],
    disclaimer: 'This is a general health guidance tool. Please consult a healthcare professional for proper diagnosis and treatment. If you experience a medical emergency, call 911 or go to the nearest emergency room.',
  };
}
