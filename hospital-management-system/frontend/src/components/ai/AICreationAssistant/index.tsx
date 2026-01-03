import { useState, useEffect, useRef } from 'react';
import {
  MicrophoneIcon,
  XMarkIcon,
  StopIcon,
  UserPlusIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import { PlusIcon } from '@heroicons/react/24/solid';
import { api, patientApi, doctorApi, appointmentApi } from '../../../services/api';
import { useVoiceRecognition, useSpeechSynthesis } from '../../../hooks/useVoiceRecognition';
import {
  EntityType,
  ExtractedPatientData,
  ExtractedDoctorData,
  ExtractedAppointmentData,
} from './types';

type Step = 'idle' | 'listening' | 'processing' | 'confirming' | 'creating' | 'success' | 'error' | 'symptoms';
type ActionType = EntityType | 'symptoms';

interface ConversationMessage {
  role: 'ai' | 'user';
  text: string;
  timestamp: Date;
  data?: any;
}

interface SymptomResult {
  urgency: string;
  recommendations: string[];
  possibleConditions: string[];
  department: string;
  shouldSeekCare: boolean;
}

export default function AICreationAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [entityType, setEntityType] = useState<EntityType>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [confidence, setConfidence] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [symptomResult, setSymptomResult] = useState<SymptomResult | null>(null);

  // Form data states
  const [patientData, setPatientData] = useState<ExtractedPatientData>({});
  const [doctorData, setDoctorData] = useState<ExtractedDoctorData>({});
  const [appointmentData, setAppointmentData] = useState<ExtractedAppointmentData>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  });

  // Text-to-speech
  const { speak, stop: stopSpeaking, speaking, supported: ttsSupported } = useSpeechSynthesis();

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Update text input with transcript
  useEffect(() => {
    if (transcript && listening) {
      setTextInput(transcript);
    }
  }, [transcript, listening]);

  // Process transcript when user stops speaking
  useEffect(() => {
    if (transcript && !listening && step === 'listening') {
      processInput(transcript);
    }
  }, [listening]);

  const addMessage = (role: 'ai' | 'user', text: string, data?: any) => {
    setConversation(prev => [...prev, { role, text, timestamp: new Date(), data }]);
  };

  const speakAndAdd = (text: string, data?: any) => {
    addMessage('ai', text, data);
    if (ttsSupported) {
      speak(text, { rate: 1.1 });
    }
  };

  const resetState = () => {
    setStep('idle');
    setEntityType(null);
    setActionType(null);
    setConfidence(0);
    setErrorMessage('');
    setPatientData({});
    setDoctorData({});
    setAppointmentData({});
    setSymptomResult(null);
    setTextInput('');
    resetTranscript();
  };

  const handleOpen = () => {
    setIsOpen(true);
    resetState();
    setConversation([]);
    setTimeout(() => {
      speakAndAdd("Hi! I'm your AI health assistant. I can help you create patients, doctors, appointments, or check symptoms. What would you like to do?");
      inputRef.current?.focus();
    }, 300);
  };

  const handleClose = () => {
    setIsOpen(false);
    stopSpeaking();
    if (listening) stopListening();
    setTimeout(resetState, 300);
  };

  const startVoiceInput = () => {
    setStep('listening');
    resetTranscript();
    setTextInput('');
    startListening();
  };

  const stopVoiceInput = () => {
    stopListening();
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    processInput(textInput.trim());
    setTextInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const processInput = async (text: string) => {
    if (!text.trim()) {
      setStep('idle');
      return;
    }

    addMessage('user', text);
    setStep('processing');
    resetTranscript();

    // Check if it's a symptom check request
    const lowerText = text.toLowerCase();
    const isSymptomCheck = lowerText.includes('symptom') ||
                          lowerText.includes('feeling') ||
                          lowerText.includes('pain') ||
                          lowerText.includes('sick') ||
                          lowerText.includes('hurt') ||
                          lowerText.includes('ache') ||
                          lowerText.includes('fever') ||
                          lowerText.includes('headache') ||
                          lowerText.includes('cough') ||
                          lowerText.includes('check symptom') ||
                          actionType === 'symptoms';

    if (isSymptomCheck || (actionType as string) === 'symptoms') {
      await processSymptoms(text);
      return;
    }

    try {
      // Parse intent and extract data
      const intentResponse = await api.post('/ai/entity/parse-intent', { text });
      const intentData = intentResponse.data.data;

      if (intentData.intent !== 'create' || !intentData.entityType) {
        speakAndAdd("I can help you with: adding patients, registering doctors, booking appointments, or checking symptoms. Please try something like 'Add patient John Smith' or 'I have a headache and fever'.");
        setStep('idle');
        return;
      }

      const detectedType = intentData.entityType as EntityType;
      setEntityType(detectedType);
      setActionType(detectedType);
      setConfidence(intentData.confidence);

      // Extract detailed data based on entity type
      let extractResponse;
      let extractedData: any = {};

      switch (detectedType) {
        case 'patient':
          extractResponse = await api.post('/ai/entity/extract-patient', { text });
          extractedData = extractResponse.data.data.data || {};
          setPatientData(extractedData);
          break;
        case 'doctor':
          extractResponse = await api.post('/ai/entity/extract-doctor', { text });
          extractedData = extractResponse.data.data.data || {};
          setDoctorData(extractedData);
          break;
        case 'appointment':
          extractResponse = await api.post('/ai/entity/extract-appointment', { text });
          extractedData = extractResponse.data.data.data || {};
          setAppointmentData(extractedData);
          break;
      }

      const missingFields = extractResponse?.data.data.missingFields || [];
      const dataConfidence = extractResponse?.data.data.confidence || 0;

      // Build confirmation message
      let confirmMessage = buildConfirmationMessage(detectedType, extractedData, missingFields);

      setStep('confirming');
      speakAndAdd(confirmMessage);

      // If high confidence, auto-create after delay
      if (dataConfidence >= 0.8 && missingFields.length === 0) {
        setTimeout(() => {
          speakAndAdd("Creating now...");
          handleCreate(detectedType, extractedData);
        }, 2500);
      }
    } catch (error: any) {
      console.error('AI processing error:', error);
      speakAndAdd("Sorry, I had trouble understanding that. Could you try again?");
      setStep('idle');
    }
  };

  const processSymptoms = async (text: string) => {
    setActionType('symptoms');

    try {
      // Extract symptoms as array from text
      const symptomWords = text.toLowerCase()
        .replace(/i have|i feel|i am|i'm|feeling|experiencing|suffering from/gi, '')
        .split(/[,\s]+and\s+|[,\s]+/)
        .map(s => s.trim())
        .filter(s => s.length > 2);

      // Call symptom checker API with array
      const response = await api.post('/ai/symptom-checker/quick-check', {
        symptoms: symptomWords.length > 0 ? symptomWords : ['general discomfort'],
        age: 30,
        gender: 'unknown'
      });

      const result = response.data.data;
      const department = result.recommendedDepartment || 'General Medicine';

      setSymptomResult({
        urgency: result.triageLevel || 'Moderate',
        department: department,
        recommendations: [result.recommendedAction || 'Consult a doctor'],
        possibleConditions: [],
        shouldSeekCare: result.urgencyScore > 5
      });
      setStep('symptoms');

      // Build response message
      let message = `Based on your symptoms, here's my assessment:\n\n`;
      message += `**Urgency Level:** ${result.triageLevel || 'Routine'}\n`;
      message += `**Urgency Score:** ${result.urgencyScore || 5}/10\n`;
      message += `**Recommended Department:** ${department}\n\n`;
      message += `**Recommendation:** ${result.recommendedAction || 'Please consult a doctor'}\n`;

      if (result.redFlagsDetected) {
        message += `\n⚠️ **Red flags detected - seek immediate care!**`;
      }

      message += `\n\nWould you like me to book an appointment with ${department}?`;

      speakAndAdd(message, result);

    } catch (error: any) {
      console.error('Symptom check error:', error);

      // Fallback response
      const fallbackResult = {
        urgency: 'Moderate',
        department: 'General Medicine',
        recommendations: [
          'Rest and stay hydrated',
          'Monitor your symptoms',
          'Consult a doctor if symptoms persist'
        ],
        possibleConditions: ['Further evaluation needed'],
        shouldSeekCare: true
      };

      setSymptomResult(fallbackResult);
      setStep('symptoms');

      speakAndAdd(`I've noted your symptoms. Based on what you described, I recommend consulting with **General Medicine**. Would you like me to book an appointment?`, fallbackResult);
    }
  };

  const buildConfirmationMessage = (type: EntityType, data: any, missing: string[]): string => {
    let message = '';

    switch (type) {
      case 'patient':
        const pName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'the patient';
        message = `Creating patient: **${pName}**`;
        if (data.gender) message += `, ${data.gender.toLowerCase()}`;
        if (data.dateOfBirth) message += `, born ${formatDate(data.dateOfBirth)}`;
        if (data.phone) message += `, phone ${data.phone}`;
        if (data.email) message += `, email ${data.email}`;
        break;

      case 'doctor':
        const dName = `Dr. ${data.firstName || ''} ${data.lastName || ''}`.trim();
        message = `Registering **${dName}**`;
        if (data.specialization) message += `, ${data.specialization}`;
        if (data.department) message += ` in ${data.department}`;
        if (data.experience) message += `, ${data.experience} years experience`;
        break;

      case 'appointment':
        message = `Booking appointment`;
        if (data.patientName) message += ` for **${data.patientName}**`;
        if (data.doctorName) message += ` with **${data.doctorName}**`;
        if (data.appointmentDate) message += ` on ${formatDate(data.appointmentDate)}`;
        if (data.appointmentTime) message += ` at ${formatTime(data.appointmentTime)}`;
        if (data.reason) message += ` - ${data.reason}`;
        break;
    }

    if (missing.length > 0) {
      message += `\n\n⚠️ Missing: ${missing.join(', ')}`;
    }

    message += `\n\nSay **"confirm"** to create or **"cancel"** to start over.`;

    return message;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string): string => {
    try {
      const [hours, minutes] = timeStr.split(':');
      const h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const handleCreate = async (type: EntityType = entityType, data?: any) => {
    setStep('creating');

    const createData = data || (type === 'patient' ? patientData : type === 'doctor' ? doctorData : appointmentData);

    try {
      switch (type) {
        case 'patient':
          // Include all required fields with defaults for missing address info
          await patientApi.create({
            firstName: createData.firstName || 'Unknown',
            lastName: createData.lastName || 'Patient',
            dateOfBirth: createData.dateOfBirth ? new Date(createData.dateOfBirth).toISOString() : new Date('1990-01-01').toISOString(),
            gender: createData.gender || 'OTHER',
            phone: createData.phone || '0000000000',
            email: createData.email || '',
            // Address fields with defaults (can be updated later)
            address: createData.address || 'To be updated',
            city: createData.city || 'Unknown',
            state: createData.state || 'Unknown',
            zipCode: createData.zipCode || '00000',
          });
          break;
        case 'doctor':
          // Doctor creation requires admin privileges and department setup
          // Show helpful message instead of failing silently
          throw new Error('Doctor registration requires administrator access. Please use the Admin Panel → Doctors section to register new doctors.');

        case 'appointment':
          // Look up patient and doctor by name
          let patientId = createData.patientId;
          let doctorId = createData.doctorId;

          if (!patientId && createData.patientName) {
            // Try to find patient by name
            const patientSearch = await patientApi.getAll({
              search: createData.patientName,
              limit: 1
            });
            if (patientSearch.data?.data?.patients?.length > 0) {
              patientId = patientSearch.data.data.patients[0].id;
            } else {
              throw new Error(`Patient "${createData.patientName}" not found. Please register the patient first.`);
            }
          }

          if (!doctorId && createData.doctorName) {
            // Try to find doctor by name
            const doctorSearch = await doctorApi.getAll({
              search: createData.doctorName.replace(/^Dr\.?\s*/i, ''),
              limit: 1
            });
            if (doctorSearch.data?.data?.length > 0) {
              doctorId = doctorSearch.data.data[0].id;
            } else {
              throw new Error(`Doctor "${createData.doctorName}" not found. Please check the doctor's name.`);
            }
          }

          if (!patientId || !doctorId) {
            throw new Error('Both patient and doctor must be specified for an appointment.');
          }

          await appointmentApi.create({
            patientId,
            doctorId,
            appointmentDate: createData.appointmentDate || new Date().toISOString().split('T')[0],
            startTime: createData.appointmentTime || '09:00',
            type: createData.appointmentType || 'CONSULTATION',
            notes: createData.reason || '',
          });
          break;
      }

      setStep('success');
      const entityName = (type as string) === 'patient' ? 'Patient' : (type as string) === 'doctor' ? 'Doctor' : 'Appointment';
      speakAndAdd(`✅ ${entityName} created successfully! What else can I help you with?`);

    } catch (error: any) {
      console.error('Create error:', error);

      // Get error details
      const status = error.response?.status;
      const apiMessage = error.response?.data?.message;
      const message = apiMessage || error.message || '';

      // Handle different error types
      if (status === 401 || message.toLowerCase().includes('token') || message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('session')) {
        setErrorMessage('Your session has expired. Please log in again.');
        setStep('error');
        speakAndAdd("Your session has expired. Please close this assistant and log in again to continue.");
      } else if (message.includes('not found') || message.includes('Please register') || message.includes('Please check')) {
        // Custom errors from our logic (patient/doctor not found)
        setErrorMessage(message);
        setStep('error');
        speakAndAdd(message);
      } else if (message.includes('requires administrator') || message.includes('Admin Panel')) {
        // Doctor creation limitation
        setErrorMessage(message);
        setStep('error');
        speakAndAdd(message);
      } else if (status === 400) {
        setErrorMessage(message || 'Invalid data provided. Please check the information.');
        setStep('error');
        speakAndAdd(`There was an issue with the data: ${message || 'Please check the information and try again.'}`);
      } else if (status === 403) {
        setErrorMessage('You do not have permission to perform this action.');
        setStep('error');
        speakAndAdd("Sorry, you don't have permission to perform this action. Please contact an administrator.");
      } else {
        setErrorMessage(message || 'Failed to create. Please try again.');
        setStep('error');
        speakAndAdd(message || "Sorry, there was an error creating the record. Please try again.");
      }
    }
  };

  const handleBookFromSymptoms = () => {
    const dept = symptomResult?.department || 'General Medicine';
    setActionType('appointment');
    setEntityType('appointment');
    setAppointmentData({
      reason: `Symptom check - ${dept}`,
      appointmentType: 'Consultation'
    });
    speakAndAdd(`Let's book an appointment with ${dept}. Please tell me the patient name, preferred date and time.`);
    setStep('idle');
  };

  // Handle voice commands during confirmation
  useEffect(() => {
    const lower = textInput.toLowerCase();
    if (step === 'confirming') {
      if (lower.includes('confirm') || lower.includes('yes') || lower.includes('create')) {
        handleCreate();
        setTextInput('');
      } else if (lower.includes('cancel') || lower.includes('no')) {
        speakAndAdd("Cancelled. What would you like to do?");
        resetState();
      }
    }
  }, [textInput]);

  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case 'patient': return <UserPlusIcon className="h-5 w-5" />;
      case 'doctor': return <UserGroupIcon className="h-5 w-5" />;
      case 'appointment': return <CalendarDaysIcon className="h-5 w-5" />;
      case 'symptoms': return <HeartIcon className="h-5 w-5" />;
      default: return <SparklesIcon className="h-5 w-5" />;
    }
  };

  const getActionColor = (type: ActionType) => {
    switch (type) {
      case 'patient': return 'from-emerald-500 to-teal-600';
      case 'doctor': return 'from-blue-500 to-indigo-600';
      case 'appointment': return 'from-purple-500 to-pink-600';
      case 'symptoms': return 'from-rose-500 to-red-600';
      default: return 'from-violet-600 to-indigo-700';
    }
  };

  const getActionTitle = () => {
    switch (actionType) {
      case 'patient': return 'Add Patient';
      case 'doctor': return 'Add Doctor';
      case 'appointment': return 'Book Appointment';
      case 'symptoms': return 'Symptom Checker';
      default: return 'AI Health Assistant';
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        className={`fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-2xl shadow-violet-500/40 flex items-center justify-center hover:scale-110 hover:shadow-violet-500/60 transition-all duration-300 group ${
          isOpen ? 'hidden' : ''
        }`}
        title="AI Health Assistant"
      >
        <SparklesIcon className="h-7 w-7 group-hover:rotate-12 transition-transform duration-300" />
        <span className="absolute -top-1 -right-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-[10px] font-bold shadow-lg animate-pulse">
          AI
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50">
            {/* Header */}
            <div className={`bg-gradient-to-r ${getActionColor(actionType)} p-5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    {getActionIcon(actionType)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{getActionTitle()}</h3>
                    <p className="text-sm text-white/90">
                      {step === 'idle' && 'Voice & Text enabled'}
                      {step === 'listening' && '🎤 Listening...'}
                      {step === 'processing' && '⏳ Processing...'}
                      {step === 'confirming' && `✓ ${Math.round(confidence * 100)}% confident`}
                      {step === 'creating' && '⏳ Creating...'}
                      {step === 'success' && '✅ Success!'}
                      {step === 'symptoms' && '🩺 Assessment ready'}
                      {step === 'error' && '❌ Error'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
            </div>

            {/* Conversation Area */}
            <div className="h-72 overflow-y-auto p-4 space-y-3 bg-slate-900/50">
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                        : 'bg-slate-800 text-white border border-slate-700'
                    }`}
                  >
                    {msg.role === 'ai' && (
                      <div className="flex items-center gap-2 mb-2">
                        <SparklesIcon className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-400">AI Assistant</span>
                      </div>
                    )}
                    <div
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: msg.text
                          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-300">$1</strong>')
                          .replace(/\n/g, '<br/>')
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Live transcript */}
              {listening && transcript && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-violet-600/50 text-white border border-violet-500/50">
                    <p className="text-sm italic">{transcript}...</p>
                  </div>
                </div>
              )}

              {/* Processing indicator */}
              {step === 'processing' && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <ArrowPathIcon className="h-5 w-5 text-violet-400 animate-spin" />
                      <span className="text-sm text-white">Analyzing...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Action Buttons Area */}
            <div className="px-4 py-3 bg-slate-800/80 border-t border-slate-700/50">
              {/* Quick Action Chips */}
              {step === 'idle' && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => {
                      setActionType('patient');
                      setEntityType('patient');
                      speakAndAdd("Let's add a new patient! Please provide the patient details.\n\n**Example:** \"John Smith, male, born January 15 1990, phone 5551234567\"\n\nYou can also include email if available.");
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/40 transition-all text-sm font-semibold"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    Patient
                  </button>
                  <button
                    onClick={() => {
                      setActionType('doctor');
                      setEntityType('doctor');
                      speakAndAdd("To register a new doctor, please use the **Admin Panel → Doctors** section.\n\nDoctor registration requires:\n• Department selection\n• Login credentials setup\n• License verification\n\nThis ensures proper access control and security.");
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/40 transition-all text-sm font-semibold"
                  >
                    <UserGroupIcon className="h-4 w-4" />
                    Doctor
                  </button>
                  <button
                    onClick={() => {
                      setActionType('appointment');
                      setEntityType('appointment');
                      speakAndAdd("Let's book an appointment! Please provide the details.\n\n**Example:** \"Book appointment for John Smith with Dr. Wilson tomorrow at 2pm for checkup\"\n\nMake sure the patient and doctor are already registered in the system.");
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/40 transition-all text-sm font-semibold"
                  >
                    <CalendarDaysIcon className="h-4 w-4" />
                    Appointment
                  </button>
                  <button
                    onClick={() => { setActionType('symptoms'); speakAndAdd("Tell me about your symptoms. What are you experiencing?\n\n**Example:** \"I have headache, fever, and feeling tired\"\n\nI'll analyze your symptoms and recommend the appropriate department."); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/40 transition-all text-sm font-semibold"
                  >
                    <HeartIcon className="h-4 w-4" />
                    Check Symptoms
                  </button>
                </div>
              )}

              {/* Confirm/Cancel buttons */}
              {step === 'confirming' && (
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={() => handleCreate()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    Confirm & Create
                  </button>
                  <button
                    onClick={() => { speakAndAdd("Cancelled. What would you like to do?"); resetState(); }}
                    className="px-4 py-3 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Book appointment from symptoms */}
              {step === 'symptoms' && (
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={handleBookFromSymptoms}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                  >
                    <CalendarDaysIcon className="h-5 w-5" />
                    Book Appointment
                  </button>
                  <button
                    onClick={resetState}
                    className="px-4 py-3 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Success/Error actions */}
              {(step === 'success' || step === 'error') && (
                <div className="flex justify-center mb-3">
                  <button
                    onClick={resetState}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-700 text-white font-bold hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                  >
                    {step === 'success' ? <PlusIcon className="h-5 w-5" /> : <ArrowPathIcon className="h-5 w-5" />}
                    {step === 'success' ? 'Create Another' : 'Try Again'}
                  </button>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900 border-t border-slate-700/50">
              <div className="flex items-center gap-3">
                {/* Voice Button */}
                {voiceSupported && (
                  <button
                    onClick={listening ? stopVoiceInput : startVoiceInput}
                    disabled={step === 'processing' || step === 'creating'}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      listening
                        ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/40 animate-pulse'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                    } disabled:opacity-50`}
                  >
                    {listening ? (
                      <StopIcon className="h-6 w-6 text-white" />
                    ) : (
                      <MicrophoneIcon className="h-6 w-6" />
                    )}
                  </button>
                )}

                {/* Text Input */}
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={listening ? "Listening..." : "Type or speak your request..."}
                    disabled={step === 'processing' || step === 'creating'}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all disabled:opacity-50"
                  />
                </div>

                {/* Send Button */}
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || step === 'processing' || step === 'creating'}
                  className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center hover:shadow-lg hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Speaking indicator */}
              {speaking && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-violet-400">Speaking...</span>
                  <button onClick={stopSpeaking} className="text-xs text-slate-500 hover:text-white">
                    Stop
                  </button>
                </div>
              )}

              {/* Listening indicator */}
              {listening && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-400 font-medium">Listening... tap mic to stop</span>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center mt-3">
                💡 Try: "Add patient John Smith male born Jan 15 1990" or "I have headache and fever"
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
