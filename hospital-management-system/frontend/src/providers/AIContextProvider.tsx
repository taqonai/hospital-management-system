import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  action?: AIAction;
}

export interface AIAction {
  type: string;
  payload?: Record<string, unknown>;
  executed?: boolean;
  result?: unknown;
}

export interface AIContext {
  currentPage: string;
  currentPatient?: {
    id: string;
    name: string;
    mrn: string;
  };
  currentModule?: string;
  additionalContext?: Record<string, unknown>;
}

export interface AIContextValue {
  // State
  isOpen: boolean;
  isListening: boolean;
  messages: AIMessage[];
  context: AIContext;
  isProcessing: boolean;

  // Actions
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  setListening: (listening: boolean) => void;
  addMessage: (message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setContext: (context: Partial<AIContext>) => void;
  setCurrentPatient: (patient: AIContext['currentPatient']) => void;
  setProcessing: (processing: boolean) => void;

  // Quick Actions based on context
  getQuickActions: () => QuickAction[];
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  command: string;
  module?: string;
}

const AIContextContext = createContext<AIContextValue | null>(null);

// Module-specific quick actions
const moduleQuickActions: Record<string, QuickAction[]> = {
  dashboard: [
    { id: 'new-patient', label: 'Register Patient', icon: 'user-plus', command: 'Register a new patient' },
    { id: 'new-appointment', label: 'Book Appointment', icon: 'calendar', command: 'Book a new appointment' },
    { id: 'show-critical', label: 'Critical Alerts', icon: 'alert', command: 'Show critical alerts' },
  ],
  patients: [
    { id: 'search-patient', label: 'Search Patient', icon: 'search', command: 'Search for patient' },
    { id: 'new-patient', label: 'New Patient', icon: 'user-plus', command: 'Register a new patient' },
    { id: 'high-risk', label: 'High Risk Patients', icon: 'alert', command: 'Show high risk patients' },
  ],
  laboratory: [
    { id: 'order-test', label: 'Order Lab Test', icon: 'beaker', command: 'Order a lab test' },
    { id: 'critical-values', label: 'Critical Values', icon: 'alert', command: 'Show critical lab values' },
    { id: 'pending-tests', label: 'Pending Tests', icon: 'clock', command: 'Show pending lab tests' },
  ],
  pharmacy: [
    { id: 'check-interactions', label: 'Drug Interactions', icon: 'warning', command: 'Check drug interactions' },
    { id: 'dispense', label: 'Dispense Medication', icon: 'pill', command: 'Dispense medication' },
    { id: 'low-stock', label: 'Low Stock Alerts', icon: 'alert', command: 'Show low stock medications' },
  ],
  ipd: [
    { id: 'admit-patient', label: 'Admit Patient', icon: 'bed', command: 'Admit a patient' },
    { id: 'bed-status', label: 'Bed Availability', icon: 'grid', command: 'Show bed availability' },
    { id: 'discharge', label: 'Discharge Ready', icon: 'check', command: 'Show patients ready for discharge' },
  ],
  emergency: [
    { id: 'triage', label: 'Triage Patient', icon: 'alert', command: 'Triage a patient' },
    { id: 'critical', label: 'Critical Patients', icon: 'heart', command: 'Show critical patients' },
    { id: 'wait-time', label: 'Wait Times', icon: 'clock', command: 'Show current wait times' },
  ],
  radiology: [
    { id: 'worklist', label: 'My Worklist', icon: 'list', command: 'Show my worklist' },
    { id: 'analyze', label: 'AI Analysis', icon: 'cpu', command: 'Analyze current study' },
    { id: 'urgent', label: 'Urgent Studies', icon: 'alert', command: 'Show urgent studies' },
  ],
  billing: [
    { id: 'generate-invoice', label: 'Generate Invoice', icon: 'receipt', command: 'Generate an invoice' },
    { id: 'pending-claims', label: 'Pending Claims', icon: 'clock', command: 'Show pending claims' },
    { id: 'estimate-cost', label: 'Cost Estimate', icon: 'calculator', command: 'Estimate procedure cost' },
  ],
  surgery: [
    { id: 'schedule-surgery', label: 'Schedule Surgery', icon: 'calendar', command: 'Schedule a surgery' },
    { id: 'ot-availability', label: 'OT Availability', icon: 'grid', command: 'Show OT availability' },
    { id: 'todays-surgeries', label: "Today's Surgeries", icon: 'list', command: "Show today's surgeries" },
  ],
  hr: [
    { id: 'new-employee', label: 'Add Employee', icon: 'user-plus', command: 'Add a new employee' },
    { id: 'attendance-today', label: "Today's Attendance", icon: 'clock', command: "Show today's attendance" },
    { id: 'pending-leave', label: 'Pending Leaves', icon: 'calendar', command: 'Show pending leave requests' },
    { id: 'payroll', label: 'Payroll', icon: 'currency', command: 'Show payroll status' },
  ],
  housekeeping: [
    { id: 'new-task', label: 'Create Task', icon: 'plus', command: 'Create a housekeeping task' },
    { id: 'pending-tasks', label: 'Pending Tasks', icon: 'clock', command: 'Show pending housekeeping tasks' },
    { id: 'urgent-tasks', label: 'Urgent Tasks', icon: 'alert', command: 'Show urgent housekeeping tasks' },
    { id: 'low-stock', label: 'Low Stock', icon: 'warning', command: 'Show low stock housekeeping supplies' },
  ],
};

const defaultQuickActions: QuickAction[] = [
  { id: 'help', label: 'Help', icon: 'question', command: 'What can you help me with?' },
  { id: 'navigate', label: 'Go to...', icon: 'arrow-right', command: 'Navigate to' },
  { id: 'search', label: 'Search', icon: 'search', command: 'Search for' },
];

export function AIContextProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [context, setContextState] = useState<AIContext>({
    currentPage: location.pathname,
  });

  // Update current page when location changes
  const currentModule = location.pathname.split('/')[1] || 'dashboard';

  const openAssistant = useCallback(() => setIsOpen(true), []);
  const closeAssistant = useCallback(() => setIsOpen(false), []);
  const toggleAssistant = useCallback(() => setIsOpen(prev => !prev), []);
  const setListening = useCallback((listening: boolean) => setIsListening(listening), []);
  const setProcessing = useCallback((processing: boolean) => setIsProcessing(processing), []);

  const addMessage = useCallback((message: Omit<AIMessage, 'id' | 'timestamp'>) => {
    const newMessage: AIMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  const setContext = useCallback((newContext: Partial<AIContext>) => {
    setContextState(prev => ({ ...prev, ...newContext }));
  }, []);

  const setCurrentPatient = useCallback((patient: AIContext['currentPatient']) => {
    setContextState(prev => ({ ...prev, currentPatient: patient }));
  }, []);

  const getQuickActions = useCallback((): QuickAction[] => {
    const moduleActions = moduleQuickActions[currentModule] || [];
    return [...moduleActions, ...defaultQuickActions];
  }, [currentModule]);

  const value: AIContextValue = {
    isOpen,
    isListening,
    messages,
    context: { ...context, currentPage: location.pathname, currentModule },
    isProcessing,
    openAssistant,
    closeAssistant,
    toggleAssistant,
    setListening,
    addMessage,
    clearMessages,
    setContext,
    setCurrentPatient,
    setProcessing,
    getQuickActions,
  };

  return (
    <AIContextContext.Provider value={value}>
      {children}
    </AIContextContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContextContext);
  if (!context) {
    throw new Error('useAIContext must be used within an AIContextProvider');
  }
  return context;
}
