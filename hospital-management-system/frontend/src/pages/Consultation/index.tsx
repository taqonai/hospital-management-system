import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCircleIcon,
  UserGroupIcon,
  BeakerIcon,
  DocumentTextIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  PlusIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ExclamationCircleIcon,
  ShieldExclamationIcon,
  LightBulbIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  BoltIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  CalendarIcon,
  MicrophoneIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { patientApi, aiApi, smartOrderApi, medSafetyApi, ipdApi, appointmentApi, opdApi, insuranceCodingApi, aiConsultationApi } from '../../services/api';
import { useAIHealth } from '../../hooks/useAI';
import { useWhisperRecorder, formatDuration } from '../../hooks/useWhisperRecorder';
import {
  CodeSuggestionPanel,
  ICD10Picker,
  CPTCodePicker,
  AcceptanceMeter,
  PayerRulesAlert,
} from '../../components/insurance';
import { useBookingData, usePatientHistory } from '../../hooks/useBookingData';
import DrugPicker, { DrugSelection } from '../../components/consultation/DrugPicker';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// =============== Type Definitions ===============
interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  bloodGroup?: string;
  allergies?: Array<{ allergen: string; severity: string; reaction?: string }>;
  // MedicalHistory is a single object (1-to-1 relation), not an array
  medicalHistory?: {
    chronicConditions?: string[];
    pastSurgeries?: string[];
    familyHistory?: string[];
    currentMedications?: string[];
    immunizations?: string[];
    currentTreatment?: string | null;
    isPregnant?: boolean | null;
    expectedDueDate?: string | null;
    lifestyle?: {
      smoking?: string;
      alcohol?: string;
      exercise?: string;
      diet?: string;
    } | null;
    notes?: string | null;
  } | null;
}

interface CurrentMedication {
  name: string;
  dosage?: string;
  frequency?: string;
}

interface Vitals {
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  heartRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  weight?: number;
  height?: number;
  painLevel?: number;
  consciousness?: string;
  // Patient details from vital recording
  isPregnant?: boolean;
  expectedDueDate?: string;
  currentMedications?: CurrentMedication[];
  currentTreatment?: string;
}

interface NEWS2Result {
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  clinicalResponse: string;
  breakdown?: Record<string, number>;
}

interface Symptom {
  id: string;
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  duration?: string;
  extractedByAI?: boolean;
}

interface Diagnosis {
  icd10: string;
  name: string;
  confidence: number;
  category?: string;
  severity?: string;
  isPrimary?: boolean;
}

interface Prescription {
  id: string;
  drugId?: string;  // Links to pharmacy drug inventory
  medication: string;
  genericName?: string;
  dosageForm?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  warnings?: string[];
  interactions?: string[];
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'low' | 'moderate' | 'high' | 'contraindicated';
  description: string;
}

interface AIInsight {
  type: 'warning' | 'suggestion' | 'info' | 'critical';
  title: string;
  description: string;
  action?: string;
}

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// =============== Constants ===============
const CONSULTATION_STEPS = [
  { id: 1, name: 'Patient', description: 'Selection & Context' },
  { id: 2, name: 'Vitals', description: 'Entry & Interpretation' },
  { id: 3, name: 'Symptoms', description: 'Chief Complaint' },
  { id: 4, name: 'Diagnosis', description: 'AI-Assisted' },
  { id: 5, name: 'Treatment', description: 'Prescription' },
  { id: 6, name: 'Summary', description: 'Notes & SOAP' },
];

const COMMON_SYMPTOMS = [
  'headache', 'fever', 'cough', 'fatigue', 'nausea', 'vomiting',
  'chest pain', 'shortness of breath', 'abdominal pain', 'diarrhea',
  'dizziness', 'back pain', 'joint pain', 'sore throat', 'runny nose',
];

const MEDICATION_ROUTES = ['oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical', 'inhalation', 'sublingual'];
const FREQUENCIES = ['once daily', 'twice daily', 'three times daily', 'four times daily', 'every 4 hours', 'every 6 hours', 'every 8 hours', 'as needed'];

const CONSULTANT_SPECIALTIES = [
  'Cardiology',
  'Neurology',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Nephrology',
  'Rheumatology',
  'Oncology',
  'Dermatology',
  'Ophthalmology',
  'ENT (Otolaryngology)',
  'Orthopedics',
  'Urology',
  'Psychiatry',
  'General Surgery',
  'Pediatrics',
  'Obstetrics & Gynecology',
  'Infectious Disease',
  'Hematology',
  'Allergy & Immunology',
  'Physical Medicine & Rehabilitation',
  'Pain Management',
  'Other',
];

// =============== Helper Functions ===============
const calculateAge = (dob: string): number => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const getNEWS2Color = (score: number): string => {
  if (score <= 4) return 'text-green-700 bg-green-100 border-green-300';
  if (score <= 6) return 'text-amber-700 bg-amber-100 border-amber-300';
  return 'text-red-700 bg-red-100 border-red-300';
};

const getRiskLevelColor = (level: string): string => {
  switch (level?.toUpperCase()) {
    case 'LOW': return 'text-green-700 bg-green-100';
    case 'MEDIUM':
    case 'MODERATE': return 'text-amber-700 bg-amber-100';
    case 'HIGH': return 'text-orange-700 bg-orange-100';
    case 'CRITICAL': return 'text-red-700 bg-red-100';
    default: return 'text-gray-700 bg-gray-100';
  }
};

const getInteractionSeverityColor = (severity: string): string => {
  switch (severity?.toLowerCase()) {
    case 'contraindicated': return 'text-red-800 bg-red-100 border-red-300';
    case 'high': return 'text-red-700 bg-red-50 border-red-200';
    case 'moderate': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'low': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    default: return 'text-gray-700 bg-gray-50 border-gray-200';
  }
};

// Map backend risk level (LOW, MODERATE, HIGH, CRITICAL) to NEWS2 display format
// Backend uses MODERATE for medium risk, we normalize to MEDIUM for display
const mapRiskLevelToNEWS2 = (level: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH': return 'HIGH';
    case 'MODERATE':
    case 'MEDIUM': return 'MEDIUM';
    case 'LOW':
    default: return 'LOW';
  }
};

// =============== Main Component ===============
export default function Consultation() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [searchParams] = useSearchParams();
  const patientIdFromQuery = searchParams.get('patientId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State Management
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patientIdFromQuery);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [consultationStartTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // Form State
  const [vitals, setVitals] = useState<Vitals>({});
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');

  // Voice-to-text for Chief Complaint using Whisper
  const {
    isRecording: isRecordingChiefComplaint,
    isProcessing: isProcessingVoice,
    isAvailable: whisperAvailable,
    duration: recordingDuration,
    error: voiceError,
    toggleRecording: toggleChiefComplaintRecording,
    cancelRecording: cancelChiefComplaintRecording,
  } = useWhisperRecorder({
    maxDuration: 60000, // 60 seconds max
    onTranscript: (transcript) => {
      // Append transcribed text to existing chief complaint
      setChiefComplaint((prev) => {
        const separator = prev.trim() ? ' ' : '';
        return prev + separator + transcript;
      });
      toast.success('Voice transcription complete');
    },
    onError: (error) => {
      toast.error(`Voice transcription failed: ${error}`);
    },
  });

  // Voice-to-text for Prescription, Clinical Notes, and Referral Reason
  const [activeVoiceField, setActiveVoiceField] = useState<{
    type: 'prescription' | 'clinicalNotes' | 'referralReason';
    prescriptionId?: string;
    field?: 'medication' | 'dosage' | 'instructions';
  } | null>(null);

  const {
    isRecording: isRecordingField,
    isProcessing: isProcessingField,
    duration: fieldRecordingDuration,
    startRecording: startFieldRecording,
    stopRecording: stopFieldRecording,
    cancelRecording: cancelFieldRecording,
  } = useWhisperRecorder({
    maxDuration: 30000, // 30 seconds max for prescription/notes fields
    context: { field: 'prescription', type: 'medical', currentModule: 'pharmacy' }, // Pharmacy context for medication names
    onTranscript: (transcript) => {
      if (activeVoiceField) {
        if (activeVoiceField.type === 'prescription' && activeVoiceField.prescriptionId && activeVoiceField.field) {
          // Update prescription field
          setPrescriptions((prev) =>
            prev.map((rx) => {
              if (rx.id === activeVoiceField.prescriptionId) {
                const field = activeVoiceField.field!;
                const currentValue = rx[field] || '';
                const separator = currentValue.trim() ? ' ' : '';
                return { ...rx, [field]: currentValue + separator + transcript };
              }
              return rx;
            })
          );
        } else if (activeVoiceField.type === 'clinicalNotes') {
          // Update clinical notes
          setClinicalNotes((prev) => {
            const separator = prev.trim() ? ' ' : '';
            return prev + separator + transcript;
          });
        } else if (activeVoiceField.type === 'referralReason') {
          // Update referral reason
          setReferralReason((prev) => {
            const separator = prev.trim() ? ' ' : '';
            return prev + separator + transcript;
          });
        }
        toast.success('Voice transcription complete');
      }
      setActiveVoiceField(null);
    },
    onError: (error) => {
      toast.error(`Voice transcription failed: ${error}`);
      setActiveVoiceField(null);
    },
  });

  // Start voice input for a prescription field
  const startPrescriptionVoice = useCallback(
    async (prescriptionId: string, field: 'medication' | 'dosage' | 'instructions') => {
      setActiveVoiceField({ type: 'prescription', prescriptionId, field });
      await startFieldRecording();
    },
    [startFieldRecording]
  );

  // Start voice input for clinical notes
  const startClinicalNotesVoice = useCallback(async () => {
    setActiveVoiceField({ type: 'clinicalNotes' });
    await startFieldRecording();
  }, [startFieldRecording]);

  // Start voice input for referral reason
  const startReferralReasonVoice = useCallback(async () => {
    setActiveVoiceField({ type: 'referralReason' });
    await startFieldRecording();
  }, [startFieldRecording]);

  // Stop voice recording
  const stopVoiceInput = useCallback(async () => {
    await stopFieldRecording();
  }, [stopFieldRecording]);

  // Cancel voice recording
  const cancelVoiceInput = useCallback(() => {
    cancelFieldRecording();
    setActiveVoiceField(null);
  }, [cancelFieldRecording]);

  // Check if a prescription field is recording
  const isPrescriptionFieldRecording = useCallback(
    (prescriptionId: string, field: 'medication' | 'dosage' | 'instructions') => {
      return (
        isRecordingField &&
        activeVoiceField?.type === 'prescription' &&
        activeVoiceField?.prescriptionId === prescriptionId &&
        activeVoiceField?.field === field
      );
    },
    [isRecordingField, activeVoiceField]
  );

  // Check if a prescription field is processing
  const isPrescriptionFieldProcessing = useCallback(
    (prescriptionId: string, field: 'medication' | 'dosage' | 'instructions') => {
      return (
        isProcessingField &&
        activeVoiceField?.type === 'prescription' &&
        activeVoiceField?.prescriptionId === prescriptionId &&
        activeVoiceField?.field === field
      );
    },
    [isProcessingField, activeVoiceField]
  );

  // Check if clinical notes is recording
  const isClinicalNotesRecording = isRecordingField && activeVoiceField?.type === 'clinicalNotes';
  const isClinicalNotesProcessing = isProcessingField && activeVoiceField?.type === 'clinicalNotes';

  // Check if referral reason is recording
  const isReferralReasonRecording = isRecordingField && activeVoiceField?.type === 'referralReason';
  const isReferralReasonProcessing = isProcessingField && activeVoiceField?.type === 'referralReason';

  const [selectedDiagnoses, setSelectedDiagnoses] = useState<Diagnosis[]>([]);
  // Insurance Coding State
  const [showInsuranceCoding, setShowInsuranceCoding] = useState(false);
  const [selectedIcdCodes, setSelectedIcdCodes] = useState<Array<{
    id: string;
    code: string;
    description: string;
    category?: string;
    specificityLevel?: string;
    dhaApproved?: boolean;
  }>>([]);
  const [selectedCptCodes, setSelectedCptCodes] = useState<Array<{
    id: string;
    code: string;
    description: string;
    modifiers?: string[];
    units?: number;
    price?: number;
    basePrice?: number;
    dhaPrice?: number;
    requiresPreAuth?: boolean;
  }>>([]);
  const [payerAlerts, setPayerAlerts] = useState<Array<{
    type: 'preauth' | 'coverage' | 'documentation' | 'limit' | 'exclusion' | 'modifier';
    severity: 'critical' | 'warning' | 'info';
    code?: string;
    codeType?: 'icd10' | 'cpt';
    message: string;
    action?: string;
  }>>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [soapNotes, setSoapNotes] = useState<SOAPNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  // AI State
  const [news2Result, setNews2Result] = useState<NEWS2Result | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([]);
  const [recommendedTests, setRecommendedTests] = useState<string[]>([]);
  const [newTestInput, setNewTestInput] = useState('');

  // Custom Diagnosis State
  const [customDiagnoses, setCustomDiagnoses] = useState<Array<{ id: string; name: string; icd10?: string; isPrimary?: boolean }>>([]);
  const [customDiagnosisInput, setCustomDiagnosisInput] = useState('');
  const [customDiagnosisIcd, setCustomDiagnosisIcd] = useState('');

  // Consultant Referral State
  const [needsConsultantReferral, setNeedsConsultantReferral] = useState(false);
  const [consultantSpecialty, setConsultantSpecialty] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [referralUrgency, setReferralUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');

  // Allergy Conflict State
  const [allergyConflicts, setAllergyConflicts] = useState<{medication: string; allergen: string}[]>([]);
  const [acknowledgedConflicts, setAcknowledgedConflicts] = useState<string[]>([]);

  // AI Health Check
  const { data: aiHealth } = useAIHealth();
  const isAIOnline = aiHealth?.status === 'connected';

  // Timer Effect
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date().getTime() - consultationStartTime.getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [consultationStartTime]);

  // =============== API Queries ===============

  // Fetch appointment data to auto-populate patient
  const { data: appointmentData } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null;
      const response = await appointmentApi.getById(appointmentId);
      return response.data.data;
    },
    enabled: !!appointmentId,
  });

  // Auto-set patient from appointment
  useEffect(() => {
    if (appointmentData?.patientId && !selectedPatientId) {
      setSelectedPatientId(appointmentData.patientId);
    }
  }, [appointmentData, selectedPatientId]);

  // Fetch unified booking data with nurse-recorded vitals (polls every 30s for lab results)
  const { data: bookingData, refetch: refetchBookingData } = useBookingData(
    appointmentId || null,
    30000, // Poll every 30 seconds for lab result updates
    !!appointmentId
  );

  // Force refetch booking data on mount to ensure fresh data
  useEffect(() => {
    if (appointmentId) {
      refetchBookingData();
    }
  }, [appointmentId, refetchBookingData]);

  // State to track if vitals were pre-filled by nurse
  const [vitalsPrefilledByNurse, setVitalsPrefilledByNurse] = useState(false);
  const [showPatientHistory, setShowPatientHistory] = useState(false);

  // Doctor vitals override state (for emergencies when nurse vitals need modification)
  const [vitalsEditOverride, setVitalsEditOverride] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  // Pre-populate vitals from nurse-recorded data
  useEffect(() => {
    // Check if booking data has actual vitals (has an id) and we haven't pre-filled yet
    if (bookingData?.vitals?.id && !vitalsPrefilledByNurse) {
      const nurseVitals = bookingData.vitals;
      console.log('Pre-filling vitals from nurse recording:', nurseVitals);
      setVitals({
        bloodPressureSys: nurseVitals.bloodPressureSys || undefined,
        bloodPressureDia: nurseVitals.bloodPressureDia || undefined,
        heartRate: nurseVitals.heartRate || undefined,
        temperature: nurseVitals.temperature ? Number(nurseVitals.temperature) : undefined,
        oxygenSaturation: nurseVitals.oxygenSaturation ? Number(nurseVitals.oxygenSaturation) : undefined,
        respiratoryRate: nurseVitals.respiratoryRate || undefined,
        weight: nurseVitals.weight ? Number(nurseVitals.weight) : undefined,
        height: nurseVitals.height ? Number(nurseVitals.height) : undefined,
        painLevel: nurseVitals.painLevel || undefined,
      });
      setVitalsPrefilledByNurse(true);
      toast.success('Vitals pre-filled from nurse recording');
    }
  }, [bookingData, vitalsPrefilledByNurse]);

  // Pre-populate NEWS2 result from nurse-recorded vitals risk assessment
  useEffect(() => {
    // If booking data has risk prediction with NEWS2 score, pre-fill the news2Result
    if (bookingData?.riskPrediction?.news2Score !== undefined && !news2Result) {
      const riskLevel = mapRiskLevelToNEWS2(bookingData.riskPrediction.riskLevel);
      setNews2Result({
        score: bookingData.riskPrediction.news2Score,
        riskLevel: riskLevel,
        clinicalResponse: bookingData.riskPrediction.clinicalResponse || 'Risk assessment from nurse vitals recording',
        breakdown: bookingData.riskPrediction.breakdown || undefined,
      });
      console.log('Pre-filled NEWS2 result from nurse recording:', bookingData.riskPrediction);
    }
  }, [bookingData, news2Result]);

  // Fetch patient booking history for follow-up context
  const { data: patientHistoryData } = usePatientHistory(
    selectedPatientId,
    10,
    !!selectedPatientId && showPatientHistory
  );

  // Patient Search Query
  const { data: searchResults, isLoading: searchingPatients } = useQuery({
    queryKey: ['patient-search', patientSearchQuery],
    queryFn: async () => {
      if (!patientSearchQuery || patientSearchQuery.length < 2) return { data: [] };
      const response = await patientApi.getAll({ search: patientSearchQuery, limit: 10 });
      return response.data;
    },
    enabled: patientSearchQuery.length >= 2,
  });

  // Selected Patient Data
  const { data: patientData, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return null;
      const response = await patientApi.getById(selectedPatientId);
      return response.data.data as Patient;
    },
    enabled: !!selectedPatientId,
  });

  // Patient Vitals History
  const { data: vitalsHistory } = useQuery({
    queryKey: ['patient-vitals', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      const response = await patientApi.getVitals(selectedPatientId, 5);
      return response.data.data || [];
    },
    enabled: !!selectedPatientId,
  });

  // Patient Context from AI
  const { data: patientContext, refetch: refetchPatientContext } = useQuery({
    queryKey: ['patient-ai-context', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return null;
      // This would call a dedicated AI consultation context endpoint
      // For now, we'll aggregate from existing endpoints
      const insights = await aiApi.getInsights(selectedPatientId);
      return insights.data?.data || null;
    },
    enabled: !!selectedPatientId && isAIOnline,
  });

  // =============== AI Mutations ===============

  // Calculate NEWS2 Score
  const news2Mutation = useMutation({
    mutationFn: async (vitalData: Vitals) => {
      const response = await ipdApi.calculateNEWS2({
        respiratoryRate: vitalData.respiratoryRate,
        oxygenSaturation: vitalData.oxygenSaturation,
        supplementalOxygen: false,
        bloodPressureSys: vitalData.bloodPressureSys,
        heartRate: vitalData.heartRate,
        temperature: vitalData.temperature,
        consciousness: vitalData.consciousness || 'alert',
      });
      return response.data.data as NEWS2Result;
    },
    onSuccess: (data) => {
      setNews2Result(data);
      if (data.score >= 5) {
        setAiInsights(prev => [...prev.filter(i => i.title !== 'NEWS2 Alert'), {
          type: 'critical',
          title: 'NEWS2 Alert',
          description: `High NEWS2 score (${data.score}): ${data.clinicalResponse}`,
          action: 'Consider urgent clinical review',
        }]);
      }
    },
  });

  // AI Diagnosis
  const diagnosisMutation = useMutation({
    mutationFn: async (data: { symptoms: string[]; patientAge: number; gender: string }) => {
      // Extract medical history from MedicalHistory model (chronic conditions)
      const medicalHistory = patientData?.medicalHistory?.chronicConditions || [];

      // Safely extract allergies - ensure it's an array before mapping
      const allergies = Array.isArray(patientData?.allergies)
        ? patientData.allergies.map(a => a?.allergen).filter(Boolean)
        : [];

      const response = await aiApi.analyzeDiagnosis({
        symptoms: data.symptoms,
        patientAge: data.patientAge,
        gender: data.gender,
        medicalHistory,
        currentMedications: [],
        allergies,
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      if (data.diagnoses && data.diagnoses.length > 0) {
        // Set primary diagnosis
        const primaryDiagnosis = { ...data.diagnoses[0], isPrimary: true };
        setSelectedDiagnoses([primaryDiagnosis]);
      }
      if (data.recommendedTests) {
        setRecommendedTests(data.recommendedTests);
      }
      if (data.drugInteractions) {
        setDrugInteractions(data.drugInteractions);
      }
      toast.success('AI diagnosis analysis complete');
    },
    onError: (error: any) => {
      console.error('AI diagnosis error:', error);
      const message = error?.response?.data?.message || error?.message || 'Unknown error';
      if (message.includes('timeout') || error?.code === 'ECONNABORTED') {
        toast.error('AI diagnosis timed out. Please try again.');
      } else if (message.includes('401') || message.includes('Unauthorized')) {
        toast.error('Session expired. Please refresh the page and try again.');
      } else {
        toast.error(`Failed to get AI diagnosis: ${message}`);
      }
    },
  });

  // Validate Prescription
  const validatePrescriptionMutation = useMutation({
    mutationFn: async (medications: string[]) => {
      const response = await medSafetyApi.checkInteractions(medications);
      return response.data.data;
    },
    onSuccess: (data) => {
      if (data.interactions && data.interactions.length > 0) {
        setDrugInteractions(data.interactions);
        setAiInsights(prev => [...prev.filter(i => i.type !== 'warning' || !i.title.includes('Drug')), {
          type: 'warning',
          title: 'Drug Interactions Detected',
          description: `${data.interactions.length} potential interaction(s) found`,
          action: 'Review prescription carefully',
        }]);
      }
    },
  });

  // Generate SOAP Notes
  const generateSOAPMutation = useMutation({
    mutationFn: async () => {
      // Build SOAP notes from consultation data
      const subjective = `Chief Complaint: ${chiefComplaint}\nSymptoms: ${symptoms.map(s => s.name).join(', ')}`;
      const objective = vitals ?
        `Vitals: BP ${vitals.bloodPressureSys || '-'}/${vitals.bloodPressureDia || '-'} mmHg, HR ${vitals.heartRate || '-'} bpm, Temp ${vitals.temperature || '-'}C, SpO2 ${vitals.oxygenSaturation || '-'}%, RR ${vitals.respiratoryRate || '-'}/min` +
        (news2Result ? `\nNEWS2 Score: ${news2Result.score} (${news2Result.riskLevel})` : '') : '';
      const aiDiagnoses = selectedDiagnoses.map(d => `${d.name} (${d.icd10}) - ${Math.round(d.confidence * 100)}% confidence${d.isPrimary ? ' [PRIMARY]' : ''}`);
      const customDx = customDiagnoses.map(d => `${d.name}${d.icd10 ? ` (${d.icd10})` : ''}${d.isPrimary ? ' [PRIMARY]' : ''} [Custom]`);
      const assessment = [...aiDiagnoses, ...customDx].join('\n');
      const plan = prescriptions.map(p => `${p.medication} ${p.dosage} ${p.route} ${p.frequency} for ${p.duration}`).join('\n') +
        (recommendedTests.length > 0 ? `\n\nRecommended Tests: ${recommendedTests.join(', ')}` : '');

      return {
        subjective,
        objective,
        assessment,
        plan,
      };
    },
    onSuccess: (data) => {
      setSoapNotes(data);
      toast.success('SOAP notes generated');
    },
  });

  // =============== Debounced Functions ===============

  // Debounced vitals interpretation
  const interpretVitals = useCallback((newVitals: Vitals) => {
    const timeoutId = setTimeout(() => {
      if (newVitals.heartRate || newVitals.bloodPressureSys || newVitals.respiratoryRate) {
        news2Mutation.mutate(newVitals);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [news2Mutation]);

  // Debounced prescription validation
  const validatePrescriptions = useCallback((meds: Prescription[]) => {
    const timeoutId = setTimeout(() => {
      const medicationNames = meds.map(p => p.medication).filter(Boolean);
      if (medicationNames.length >= 2) {
        validatePrescriptionMutation.mutate(medicationNames);
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [validatePrescriptionMutation]);

  // Effect for vitals interpretation
  useEffect(() => {
    const cleanup = interpretVitals(vitals);
    return cleanup;
  }, [vitals, interpretVitals]);

  // Effect for prescription validation
  useEffect(() => {
    const cleanup = validatePrescriptions(prescriptions);
    return cleanup;
  }, [prescriptions, validatePrescriptions]);

  // =============== Allergy Check ===============

  // Check if a medication conflicts with patient allergies
  const checkMedicationAllergies = useCallback((medication: string) => {
    if (!patientData?.allergies || !medication) return null;

    const medLower = medication.toLowerCase();
    for (const allergy of patientData.allergies) {
      const allergenLower = allergy.allergen.toLowerCase();
      // Check for direct match or partial match (e.g., "penicillin" in "amoxicillin")
      if (medLower.includes(allergenLower) || allergenLower.includes(medLower)) {
        return allergy;
      }
    }
    return null;
  }, [patientData?.allergies]);

  // Acknowledge allergy conflict and allow proceeding
  const acknowledgeAllergyConflict = (medication: string) => {
    setAcknowledgedConflicts(prev => [...prev, medication]);
    toast.success(`Allergy warning acknowledged for ${medication}`);
  };

  // =============== Event Handlers ===============

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setPatientSearchQuery('');
    toast.success(`Selected patient: ${patient.firstName} ${patient.lastName}`);

    // Update AI insights with patient context
    if (patient.allergies && patient.allergies.length > 0) {
      setAiInsights(prev => [...prev, {
        type: 'warning',
        title: 'Allergy Alert',
        description: `Patient has ${patient.allergies!.length} known allergies: ${patient.allergies!.map(a => a.allergen).join(', ')}`,
        action: 'Verify medications against allergy list',
      }]);
    }
  };

  const handleVitalsChange = (field: keyof Vitals, value: number | string) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const addSymptom = (symptomName: string, severity: 'mild' | 'moderate' | 'severe' = 'moderate') => {
    if (!symptomName.trim()) return;
    const newSymptom: Symptom = {
      id: Date.now().toString(),
      name: symptomName.toLowerCase().trim(),
      severity,
    };
    setSymptoms(prev => [...prev.filter(s => s.name !== newSymptom.name), newSymptom]);
    setSymptomInput('');
  };

  const removeSymptom = (id: string) => {
    setSymptoms(prev => prev.filter(s => s.id !== id));
  };

  const runAIDiagnosis = () => {
    if (symptoms.length === 0) {
      toast.error('Please add at least one symptom');
      return;
    }
    if (!patientData) {
      toast.error('Please select a patient first');
      return;
    }
    if (!patientData.dateOfBirth) {
      toast.error('Patient date of birth is missing');
      return;
    }
    const age = calculateAge(patientData.dateOfBirth);
    if (isNaN(age) || age < 0 || age > 150) {
      toast.error('Invalid patient age. Please check patient details.');
      return;
    }
    diagnosisMutation.mutate({
      symptoms: symptoms.map(s => s.name),
      patientAge: age,
      gender: patientData.gender || 'unknown',
    });
  };

  const addPrescription = () => {
    const newRx: Prescription = {
      id: Date.now().toString(),
      medication: '',
      dosage: '',
      frequency: 'twice daily',
      duration: '7 days',
      route: 'oral',
      instructions: '',
    };
    setPrescriptions(prev => [...prev, newRx]);
  };

  const updatePrescription = (id: string, field: keyof Prescription, value: string) => {
    // Get OLD medication name BEFORE updating state
    const oldRx = prescriptions.find(rx => rx.id === id);
    const oldMedication = oldRx?.medication || '';

    setPrescriptions(prev => prev.map(rx =>
      rx.id === id ? { ...rx, [field]: value } : rx
    ));

    // Check for allergy conflicts when medication name changes
    if (field === 'medication') {
      // First, clear conflict for OLD medication name (if it had one)
      if (oldMedication) {
        setAllergyConflicts(prev =>
          prev.filter(c => c.medication.toLowerCase() !== oldMedication.toLowerCase())
        );
        setAcknowledgedConflicts(prev =>
          prev.filter(m => m.toLowerCase() !== oldMedication.toLowerCase())
        );
      }

      // Then, check if NEW value has a conflict
      if (value) {
        const allergyMatch = checkMedicationAllergies(value);
        if (allergyMatch) {
          setAllergyConflicts(prev => [
            ...prev.filter(c => c.medication.toLowerCase() !== value.toLowerCase()),
            { medication: value, allergen: allergyMatch.allergen }
          ]);
          toast.error(`ALLERGY ALERT: ${value} may conflict with patient allergy to ${allergyMatch.allergen}!`, {
            duration: 5000,
          });
        }
      }
    }
  };

  // Handle drug selection from DrugPicker
  const handleDrugSelection = (id: string, drug: DrugSelection) => {
    const oldRx = prescriptions.find(rx => rx.id === id);
    const oldMedication = oldRx?.medication || '';

    // Update prescription with drug details
    setPrescriptions(prev => prev.map(rx => {
      if (rx.id === id) {
        return {
          ...rx,
          drugId: drug.id,
          medication: drug.name,
          genericName: drug.genericName,
          dosageForm: drug.dosageForm,
          // Auto-fill dosage from strength if available and dosage is empty
          dosage: drug.strength && !rx.dosage ? drug.strength : rx.dosage,
        };
      }
      return rx;
    }));

    // Check for allergy conflicts
    if (oldMedication && oldMedication !== drug.name) {
      setAllergyConflicts(prev =>
        prev.filter(c => c.medication.toLowerCase() !== oldMedication.toLowerCase())
      );
      setAcknowledgedConflicts(prev =>
        prev.filter(m => m.toLowerCase() !== oldMedication.toLowerCase())
      );
    }

    if (drug.name) {
      const allergyMatch = checkMedicationAllergies(drug.name);
      if (allergyMatch) {
        setAllergyConflicts(prev => [
          ...prev.filter(c => c.medication.toLowerCase() !== drug.name.toLowerCase()),
          { medication: drug.name, allergen: allergyMatch.allergen }
        ]);
        toast.error(`ALLERGY ALERT: ${drug.name} may conflict with patient allergy to ${allergyMatch.allergen}!`, {
          duration: 5000,
        });
      }
    }
  };

  const removePrescription = (id: string) => {
    // Get the medication name BEFORE removing to clear its conflict
    const rxToRemove = prescriptions.find(rx => rx.id === id);
    if (rxToRemove?.medication) {
      // Clear allergy conflict for this medication
      setAllergyConflicts(prev =>
        prev.filter(c => c.medication.toLowerCase() !== rxToRemove.medication.toLowerCase())
      );
      // Clear acknowledged status for this medication
      setAcknowledgedConflicts(prev =>
        prev.filter(m => m.toLowerCase() !== rxToRemove.medication.toLowerCase())
      );
    }
    setPrescriptions(prev => prev.filter(rx => rx.id !== id));
  };

  const selectDiagnosis = (diagnosis: Diagnosis) => {
    setSelectedDiagnoses(prev => {
      const exists = prev.find(d => d.icd10 === diagnosis.icd10);
      if (exists) {
        return prev.filter(d => d.icd10 !== diagnosis.icd10);
      }
      // If this is the first AI diagnosis and no custom diagnoses, set as primary
      const isPrimary = prev.length === 0 && customDiagnoses.length === 0;
      if (isPrimary) {
        // Clear any existing primary from custom diagnoses
        setCustomDiagnoses(current => current.map(cd => ({ ...cd, isPrimary: false })));
      }
      return [...prev, { ...diagnosis, isPrimary }];
    });
  };

  const completeConsultation = async () => {
    if (!selectedPatientId) {
      toast.error('No patient selected');
      return;
    }

    if (!appointmentId) {
      toast.error('No appointment selected');
      return;
    }

    // Validation: Require at least one diagnosis before completing
    if (selectedDiagnoses.length === 0 && customDiagnoses.length === 0) {
      toast.error('Cannot complete consultation without a diagnosis. Please add at least one diagnosis.');
      // Navigate to diagnosis step
      setCurrentStep(4);
      return;
    }

    // Check for unacknowledged allergy conflicts
    const unacknowledged = allergyConflicts.filter(
      c => !acknowledgedConflicts.some(m => m.toLowerCase() === c.medication.toLowerCase())
    );
    if (unacknowledged.length > 0) {
      toast.error('Please acknowledge all allergy warnings before completing consultation');
      return;
    }

    try {
      // Generate final SOAP notes
      const soapData = await generateSOAPMutation.mutateAsync();

      // Combine all diagnoses (AI-suggested + custom)
      const allDiagnoses = [
        ...selectedDiagnoses.map(d => d.name),
        ...customDiagnoses.map(d => d.name),
      ];
      const allIcdCodes = [
        ...selectedDiagnoses.map(d => d.icd10).filter(Boolean),
        ...customDiagnoses.map(d => d.icd10).filter(Boolean),
      ];

      // Build treatment plan from prescriptions
      const treatmentPlan = prescriptions.length > 0
        ? prescriptions.map(p => `${p.medication} ${p.dosage} ${p.route} ${p.frequency} for ${p.duration}`).join('\n')
        : undefined;

      // Build history from symptoms
      const historyOfIllness = symptoms.length > 0
        ? symptoms.map(s => `${s.name} (${s.severity}${s.duration ? `, ${s.duration}` : ''})`).join(', ')
        : undefined;

      // Save and complete consultation via new API endpoint
      await aiConsultationApi.complete({
        appointmentId,
        patientId: selectedPatientId,
        chiefComplaint: chiefComplaint || symptoms.map(s => s.name).join(', ') || 'General consultation',
        diagnosis: allDiagnoses,
        icdCodes: allIcdCodes,
        historyOfIllness,
        treatmentPlan,
        notes: soapData ? `SOAP Notes:\nS: ${soapData.subjective}\nO: ${soapData.objective}\nA: ${soapData.assessment}\nP: ${soapData.plan}` : undefined,
      });

      toast.success('Consultation completed successfully');

      // Invalidate appointment queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });

      navigate('/opd');
    } catch (error: any) {
      console.error('Failed to complete consultation:', error);
      const errorMsg = error.response?.data?.message || 'Failed to complete consultation';
      toast.error(errorMsg);
    }
  };

  // =============== Memoized Values ===============
  const patientAge = useMemo(() =>
    patientData ? calculateAge(patientData.dateOfBirth) : 0,
    [patientData]
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1: return !!selectedPatientId;
      case 2: return Object.keys(vitals).length > 0;
      case 3: return symptoms.length > 0 || chiefComplaint.length > 0;
      case 4: return selectedDiagnoses.length > 0 || customDiagnoses.length > 0;
      case 5: return true; // Prescriptions are optional
      case 6: return true;
      default: return false;
    }
  }, [currentStep, selectedPatientId, vitals, symptoms, chiefComplaint, selectedDiagnoses, customDiagnoses]);

  // =============== Render Functions ===============

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {CONSULTATION_STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              onClick={() => setCurrentStep(step.id)}
              className={clsx(
                'flex items-center cursor-pointer',
                currentStep === step.id && 'scale-105',
              )}
            >
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all',
                currentStep === step.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                  : currentStep > step.id
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              )}>
                {currentStep > step.id ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </div>
              <div className="ml-3 hidden md:block">
                <p className={clsx(
                  'text-sm font-medium',
                  currentStep === step.id ? 'text-blue-600' : 'text-gray-500'
                )}>{step.name}</p>
                <p className="text-xs text-gray-400">{step.description}</p>
              </div>
            </div>
            {index < CONSULTATION_STEPS.length - 1 && (
              <ChevronRightIcon className={clsx(
                'h-5 w-5 mx-2 md:mx-4',
                currentStep > step.id ? 'text-green-500' : 'text-gray-300'
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderPatientStep = () => (
    <div className="space-y-6">
      {/* Patient Search */}
      {!selectedPatientId && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MagnifyingGlassIcon className="h-5 w-5 text-blue-500" />
            Select Patient
          </h3>
          <div className="relative">
            <input
              type="text"
              value={patientSearchQuery}
              onChange={(e) => setPatientSearchQuery(e.target.value)}
              placeholder="Search by name or MRN..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchingPatients && (
              <ArrowPathIcon className="h-5 w-5 animate-spin absolute right-4 top-4 text-gray-400" />
            )}
            {searchResults?.data && searchResults.data.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {searchResults.data.map((patient: Patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handlePatientSelect(patient)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {calculateAge(patient.dateOfBirth)} yrs | {patient.gender}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Patient Summary */}
      {patientData && (
        <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <span className="text-2xl font-bold">
                  {patientData.firstName?.[0]}{patientData.lastName?.[0]}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold">{patientData.firstName} {patientData.lastName}</h2>
                <p className="text-blue-100">
                  {patientAge} yrs | {patientData.gender} | {patientData.bloodGroup || 'Blood group N/A'}
                </p>
                <p className="text-sm text-blue-200">MRN: {patientData.mrn}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPatientHistory(true)}
                className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors flex items-center gap-1"
              >
                <ClockIcon className="w-4 h-4" />
                Past Visits
              </button>
            </div>
          </div>

          {/* Nurse Vitals Pre-filled Indicator */}
          {vitalsPrefilledByNurse && bookingData?.vitals && (
            <div className="mt-3 p-2 bg-green-500/30 backdrop-blur border border-green-300/30 rounded-xl">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircleIcon className="h-5 w-5 text-green-100" />
                <span>Vitals recorded by nurse at {new Date(bookingData.vitals.recordedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          )}

          {/* Allergies */}
          {patientData.allergies && patientData.allergies.length > 0 && (
            <div className="mt-4 p-3 bg-red-500/30 backdrop-blur border border-red-300/30 rounded-xl">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-100" />
                <span className="font-medium">Allergies:</span>
                {patientData.allergies.map((a, i) => (
                  <span key={i} className="px-2 py-0.5 bg-red-200/30 rounded text-sm">
                    {a.allergen} ({a.severity})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comprehensive Medical History from MedicalHistory Model */}
          {patientData.medicalHistory && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* Chronic Conditions */}
              {patientData.medicalHistory.chronicConditions?.length > 0 && (
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <span className="text-xs uppercase text-red-200">Chronic Conditions</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {patientData.medicalHistory.chronicConditions.map((c: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-red-200/30 text-white rounded text-sm">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Surgeries */}
              {patientData.medicalHistory.pastSurgeries?.length > 0 && (
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <span className="text-xs uppercase text-blue-200">Past Surgeries</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {patientData.medicalHistory.pastSurgeries.map((s: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-200/30 text-white rounded text-sm">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Family History */}
              {patientData.medicalHistory.familyHistory?.length > 0 && (
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <span className="text-xs uppercase text-purple-200">Family History</span>
                  <div className="mt-1 text-sm text-white/80">
                    {patientData.medicalHistory.familyHistory.join(', ')}
                  </div>
                </div>
              )}

              {/* Pregnancy Status from MedicalHistory */}
              {patientData.medicalHistory.isPregnant === true && (
                <div className="p-3 bg-pink-500/20 rounded-xl col-span-2 border border-pink-400/30">
                  <div className="flex items-center gap-2 text-pink-100">
                    <span className="text-xl">🤰</span>
                    <div>
                      <span className="font-semibold">Pregnant</span>
                      {patientData.medicalHistory.expectedDueDate && (
                        <span className="ml-2 text-sm text-pink-200">
                          Due: {new Date(patientData.medicalHistory.expectedDueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Medications from MedicalHistory */}
              {patientData.medicalHistory.currentMedications?.length > 0 && (
                <div className="p-3 bg-amber-500/20 rounded-xl col-span-2 border border-amber-400/30">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">💊</span>
                    <div className="flex-1">
                      <span className="text-xs uppercase text-amber-200 font-medium">Current Medications</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {patientData.medicalHistory.currentMedications.map((m: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-amber-300/30 text-white rounded text-sm">{m}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ongoing Treatment from MedicalHistory */}
              {patientData.medicalHistory.currentTreatment && (
                <div className="p-3 bg-cyan-500/20 rounded-xl col-span-2 border border-cyan-400/30">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🏥</span>
                    <div>
                      <span className="text-xs uppercase text-cyan-200 font-medium">Ongoing Treatment</span>
                      <div className="mt-1 text-sm text-white/90">
                        {patientData.medicalHistory.currentTreatment}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Note: Pregnancy, Medications, and Treatment are now shown from MedicalHistory above (single source of truth) */}
        </div>
      )}

      {/* AI Patient Context Summary */}
      {patientContext && isAIOnline && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            AI Patient Context Summary
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-white rounded-xl">
              <p className="text-gray-500 mb-1">Risk Level</p>
              <p className={clsx('font-semibold px-2 py-1 rounded inline-block', getRiskLevelColor(bookingData?.riskPrediction?.riskLevel || patientContext.riskLevel || 'low'))}>
                {bookingData?.riskPrediction?.riskLevel || patientContext.riskLevel || 'Low'}
              </p>
              {bookingData?.riskPrediction?.news2Score !== undefined && (
                <p className="text-xs text-gray-500 mt-1">NEWS2 Score: {bookingData.riskPrediction.news2Score}</p>
              )}
            </div>
            <div className="p-3 bg-white rounded-xl">
              <p className="text-gray-500 mb-1">Last Visit</p>
              <p className="font-medium text-gray-900">{patientContext.lastVisit || 'No recent visits'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Vitals are read-only when nurse recorded them AND doctor hasn't overridden
  const vitalsReadOnly = vitalsPrefilledByNurse && !vitalsEditOverride;

  const renderVitalsStep = () => (
    <div className="space-y-6">
      {/* Override Confirmation Modal */}
      {showOverrideConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ExclamationTriangleIcon className="h-6 w-6" />
                Emergency Override
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Nurse-recorded vitals are typically final. Override should only be used in emergency situations
                where vitals need immediate correction.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                This action will be logged for audit purposes.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowOverrideConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setVitalsEditOverride(true);
                    setShowOverrideConfirm(false);
                    toast.success('Override enabled - you can now edit vitals');
                  }}
                  className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Confirm Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Vitals Warning - when patient has no nurse-recorded vitals */}
      {!vitalsPrefilledByNurse && appointmentId && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800">Vitals Not Yet Recorded</h4>
              <p className="text-sm text-amber-600">
                This patient has not had vitals recorded by nursing staff.
                You may record vitals directly if this is an emergency.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nurse Recording Indicator - Read Only mode */}
      {vitalsPrefilledByNurse && bookingData?.vitals && (
        <div className={clsx(
          'border rounded-2xl p-4',
          vitalsEditOverride
            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
            : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={clsx(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              vitalsEditOverride ? 'bg-amber-100' : 'bg-emerald-100'
            )}>
              {vitalsEditOverride ? (
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
              ) : (
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
              )}
            </div>
            <div className="flex-1">
              <h4 className={clsx(
                'font-semibold',
                vitalsEditOverride ? 'text-amber-800' : 'text-emerald-800'
              )}>
                {vitalsEditOverride ? 'Doctor Override Active' : 'Vitals Recorded by Nurse'}
              </h4>
              <p className={clsx(
                'text-sm',
                vitalsEditOverride ? 'text-amber-600' : 'text-emerald-600'
              )}>
                Recorded at {bookingData.vitals.recordedAt
                  ? new Date(bookingData.vitals.recordedAt).toLocaleString()
                  : 'earlier today'}
                {bookingData.vitals.recordedBy && typeof bookingData.vitals.recordedBy === 'object' && (
                  <span className="ml-1">
                    by {(bookingData.vitals.recordedBy as { firstName?: string; lastName?: string }).firstName} {(bookingData.vitals.recordedBy as { firstName?: string; lastName?: string }).lastName}
                  </span>
                )}
              </p>
            </div>
            {!vitalsEditOverride ? (
              <>
                <span className="text-xs px-2 py-1 bg-emerald-200 text-emerald-700 rounded-full font-medium">
                  Read Only
                </span>
                <button
                  onClick={() => setShowOverrideConfirm(true)}
                  className="ml-2 text-xs px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg font-medium transition-colors"
                >
                  Emergency Override
                </button>
              </>
            ) : (
              <span className="text-xs px-2 py-1 bg-amber-200 text-amber-700 rounded-full font-medium">
                Override Active
              </span>
            )}
          </div>
        </div>
      )}

      {/* Patient Status - Pregnancy, Current Medications, Ongoing Treatment (from nurse entry) */}
      {vitalsPrefilledByNurse && bookingData?.vitals && (
        bookingData.vitals.isPregnant !== null ||
        (bookingData.vitals.currentMedications && bookingData.vitals.currentMedications.length > 0) ||
        bookingData.vitals.currentTreatment
      ) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-5 w-5 text-purple-500" />
            Patient Status (Recorded by Nurse)
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Pregnancy Status */}
            <div className="bg-pink-50 rounded-xl p-4 border border-pink-200">
              <h4 className="text-sm font-medium text-pink-700 mb-2">Pregnancy Status</h4>
              {bookingData.vitals.isPregnant ? (
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-pink-800">Pregnant</p>
                  {bookingData.vitals.expectedDueDate && (
                    <p className="text-sm text-pink-600">
                      Due: {new Date(bookingData.vitals.expectedDueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : bookingData.vitals.isPregnant === false ? (
                <p className="text-lg font-semibold text-gray-600">Not Pregnant</p>
              ) : (
                <p className="text-gray-400 italic">Not recorded</p>
              )}
            </div>

            {/* Current Medications */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h4 className="text-sm font-medium text-blue-700 mb-2">Current Medications</h4>
              {bookingData.vitals.currentMedications && bookingData.vitals.currentMedications.length > 0 ? (
                <ul className="space-y-1">
                  {bookingData.vitals.currentMedications.map((med, index) => (
                    <li key={index} className="text-sm text-blue-800">
                      <span className="font-medium">{med.name}</span>
                      {med.dosage && <span className="text-blue-600"> - {med.dosage}</span>}
                      {med.frequency && <span className="text-blue-500 text-xs ml-1">({med.frequency})</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 italic">None recorded</p>
              )}
            </div>

            {/* Ongoing Treatment */}
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <h4 className="text-sm font-medium text-amber-700 mb-2">Ongoing Treatment</h4>
              {bookingData.vitals.currentTreatment ? (
                <p className="text-sm text-amber-800">{bookingData.vitals.currentTreatment}</p>
              ) : (
                <p className="text-gray-400 italic">None recorded</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <HeartIcon className="h-5 w-5 text-red-500" />
          {vitalsReadOnly
            ? 'Nurse-Recorded Vital Signs (Read Only)'
            : vitalsPrefilledByNurse && vitalsEditOverride
              ? 'Edit Vital Signs (Emergency Override)'
              : 'Record Vital Signs'}
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Blood Pressure */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Blood Pressure (mmHg)</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Sys"
                value={vitals.bloodPressureSys || ''}
                onChange={(e) => !vitalsReadOnly && handleVitalsChange('bloodPressureSys', parseInt(e.target.value))}
                readOnly={vitalsReadOnly}
                disabled={vitalsReadOnly}
                className={clsx(
                  'w-full px-3 py-2 border rounded-lg',
                  vitalsReadOnly
                    ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
                )}
              />
              <span className="flex items-center text-gray-400">/</span>
              <input
                type="number"
                placeholder="Dia"
                value={vitals.bloodPressureDia || ''}
                onChange={(e) => !vitalsReadOnly && handleVitalsChange('bloodPressureDia', parseInt(e.target.value))}
                readOnly={vitalsReadOnly}
                disabled={vitalsReadOnly}
                className={clsx(
                  'w-full px-3 py-2 border rounded-lg',
                  vitalsReadOnly
                    ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
                )}
              />
            </div>
          </div>

          {/* Heart Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Heart Rate (bpm)</label>
            <input
              type="number"
              placeholder="60-100"
              value={vitals.heartRate || ''}
              onChange={(e) => !vitalsReadOnly && handleVitalsChange('heartRate', parseInt(e.target.value))}
              readOnly={vitalsReadOnly}
              disabled={vitalsReadOnly}
              className={clsx(
                'w-full px-3 py-2 border rounded-lg',
                vitalsReadOnly
                  ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Temperature (C)</label>
            <input
              type="number"
              step="0.1"
              placeholder="36.5-37.5"
              value={vitals.temperature || ''}
              onChange={(e) => !vitalsReadOnly && handleVitalsChange('temperature', parseFloat(e.target.value))}
              readOnly={vitalsReadOnly}
              disabled={vitalsReadOnly}
              className={clsx(
                'w-full px-3 py-2 border rounded-lg',
                vitalsReadOnly
                  ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>

          {/* Oxygen Saturation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">SpO2 (%)</label>
            <input
              type="number"
              placeholder="95-100"
              value={vitals.oxygenSaturation || ''}
              onChange={(e) => !vitalsReadOnly && handleVitalsChange('oxygenSaturation', parseInt(e.target.value))}
              readOnly={vitalsReadOnly}
              disabled={vitalsReadOnly}
              className={clsx(
                'w-full px-3 py-2 border rounded-lg',
                vitalsReadOnly
                  ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>

          {/* Respiratory Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Respiratory Rate (/min)</label>
            <input
              type="number"
              placeholder="12-20"
              value={vitals.respiratoryRate || ''}
              onChange={(e) => !vitalsReadOnly && handleVitalsChange('respiratoryRate', parseInt(e.target.value))}
              readOnly={vitalsReadOnly}
              disabled={vitalsReadOnly}
              className={clsx(
                'w-full px-3 py-2 border rounded-lg',
                vitalsReadOnly
                  ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>

          {/* Pain Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pain Level (0-10)</label>
            <input
              type="number"
              min="0"
              max="10"
              placeholder="0"
              value={vitals.painLevel || ''}
              onChange={(e) => !vitalsReadOnly && handleVitalsChange('painLevel', parseInt(e.target.value))}
              readOnly={vitalsReadOnly}
              disabled={vitalsReadOnly}
              className={clsx(
                'w-full px-3 py-2 border rounded-lg',
                vitalsReadOnly
                  ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>
        </div>

        {/* Weight and Height */}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={vitals.weight || ''}
              onChange={(e) => !vitalsReadOnly && handleVitalsChange('weight', parseFloat(e.target.value))}
              readOnly={vitalsReadOnly}
              disabled={vitalsReadOnly}
              className={clsx(
                'w-full px-3 py-2 border rounded-lg',
                vitalsReadOnly
                  ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Height (cm)</label>
            <input
              type="number"
              value={vitals.height || ''}
              onChange={(e) => !vitalsReadOnly && handleVitalsChange('height', parseInt(e.target.value))}
              readOnly={vitalsReadOnly}
              disabled={vitalsReadOnly}
              className={clsx(
                'w-full px-3 py-2 border rounded-lg',
                vitalsReadOnly
                  ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>
        </div>
      </div>

      {/* NEWS2 Score Display */}
      {news2Result && (
        <div className={clsx(
          'rounded-2xl p-6 border-2',
          getNEWS2Color(news2Result.score)
        )}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5" />
                NEWS2 Score
              </h3>
              <p className="text-sm opacity-80 mt-1">{news2Result.clinicalResponse}</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold">{news2Result.score}</div>
              <div className="text-sm font-medium">{news2Result.riskLevel.replace('_', ' ')}</div>
            </div>
          </div>
          {news2Result.breakdown && (
            <div className="mt-4 grid grid-cols-6 gap-2 text-xs">
              {Object.entries(news2Result.breakdown).map(([key, value]) => (
                <div key={key} className="bg-white/50 rounded p-2 text-center">
                  <div className="font-medium">{key}</div>
                  <div className="text-lg font-bold">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Previous Vitals - only show if not prefilled from nurse (to avoid confusion) */}
      {vitalsHistory && vitalsHistory.length > 0 && !vitalsPrefilledByNurse && (
        <div className="bg-gray-50 rounded-2xl p-6">
          <h4 className="font-medium text-gray-700 mb-3">Previous Vitals History</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">BP</th>
                  <th className="pb-2">HR</th>
                  <th className="pb-2">Temp</th>
                  <th className="pb-2">SpO2</th>
                </tr>
              </thead>
              <tbody>
                {vitalsHistory.slice(0, 3).map((v: any, i: number) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="py-2">{new Date(v.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">{v.bloodPressure || '-'}</td>
                    <td className="py-2">{v.heartRate || '-'}</td>
                    <td className="py-2">{v.temperature || '-'}</td>
                    <td className="py-2">{v.oxygenSaturation || '-'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderSymptomsStep = () => (
    <div className="space-y-6">
      {/* Chief Complaint */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Chief Complaint</h3>
          {whisperAvailable === true && !isRecordingChiefComplaint && !isProcessingVoice && (
            <span className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full">
              <MicrophoneIcon className="h-3 w-3" />
              Voice ready
            </span>
          )}
          {whisperAvailable === null && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <ArrowPathIcon className="h-3 w-3 animate-spin" />
              Checking...
            </span>
          )}
        </div>

        {/* Recording Controls - Prominent when recording */}
        {isRecordingChiefComplaint && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
                <div>
                  <p className="font-medium text-red-700">Recording...</p>
                  <p className="text-sm text-red-600">{formatDuration(recordingDuration)} / 1:00</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelChiefComplaintRecording}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={toggleChiefComplaintRecording}
                  className="px-4 py-1.5 text-sm bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span className="w-2 h-2 bg-white rounded-sm"></span>
                  Stop & Transcribe
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-red-600">Speak clearly into your microphone. Click "Stop & Transcribe" when done.</p>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessingVoice && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3">
              <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
              <div>
                <p className="font-medium text-blue-700">Transcribing with Whisper AI...</p>
                <p className="text-sm text-blue-600">Converting your speech to text</p>
              </div>
            </div>
          </div>
        )}

        {/* Textarea with mic button */}
        <div className="relative">
          <textarea
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Type or use voice input to describe the patient's main concern..."
            rows={4}
            disabled={isProcessingVoice}
            className={clsx(
              "w-full px-4 py-3 pr-14 border rounded-xl focus:ring-2 focus:ring-blue-500 resize-none transition-colors",
              isRecordingChiefComplaint && "border-red-300 bg-red-50/50",
              isProcessingVoice && "bg-gray-50 cursor-wait",
              !isRecordingChiefComplaint && !isProcessingVoice && "border-gray-300"
            )}
          />
          {/* Microphone Button - Only show when not recording */}
          {!isRecordingChiefComplaint && (
            <button
              type="button"
              onClick={toggleChiefComplaintRecording}
              disabled={isProcessingVoice || whisperAvailable === false || whisperAvailable === null}
              title={
                whisperAvailable === null ? "Checking voice service..." :
                whisperAvailable === false ? "Voice service unavailable" :
                "Click to start voice recording"
              }
              className={clsx(
                "absolute right-3 top-3 p-2.5 rounded-xl transition-all",
                whisperAvailable === true && !isProcessingVoice
                  ? "bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg"
                  : "bg-gray-200 text-gray-400",
                (isProcessingVoice || whisperAvailable === null) && "cursor-wait",
                whisperAvailable === false && "cursor-not-allowed opacity-50"
              )}
            >
              {isProcessingVoice ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : whisperAvailable === null ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <MicrophoneIcon className="h-5 w-5" />
              )}
            </button>
          )}
        </div>

        {/* Voice Error */}
        {voiceError && !isRecordingChiefComplaint && !isProcessingVoice && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {voiceError}
          </div>
        )}

        {/* Help text */}
        {!isRecordingChiefComplaint && !isProcessingVoice && whisperAvailable === true && (
          <p className="mt-2 text-xs text-gray-500">
            Click the microphone button to record voice input, or type directly in the field above.
          </p>
        )}
        {whisperAvailable === false && (
          <p className="mt-2 text-xs text-amber-600">
            Voice input unavailable. Please type the chief complaint.
          </p>
        )}
      </div>

      {/* Symptom Entry */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ClipboardDocumentListIcon className="h-5 w-5 text-blue-500" />
          Symptoms
        </h3>

        {/* Symptom Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={symptomInput}
            onChange={(e) => setSymptomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSymptom(symptomInput)}
            placeholder="Type a symptom..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => addSymptom(symptomInput)}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Symptom Tags */}
        {symptoms.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {symptoms.map((symptom) => (
              <span
                key={symptom.id}
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
                  symptom.severity === 'severe' ? 'bg-red-100 text-red-700' :
                  symptom.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                )}
              >
                {symptom.name}
                {symptom.extractedByAI && (
                  <SparklesIcon className="h-3 w-3" />
                )}
                <button onClick={() => removeSymptom(symptom.id)}>
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Quick Add Symptoms */}
        <div>
          <p className="text-sm text-gray-500 mb-2">Quick add:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS.filter(s => !symptoms.find(sym => sym.name === s)).slice(0, 10).map((s) => (
              <button
                key={s}
                onClick={() => addSymptom(s)}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-blue-100 hover:text-blue-600 transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Symptom Extraction */}
      {isAIOnline && chiefComplaint.length > 20 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-purple-800 flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              AI Symptom Extraction
            </h4>
            <button
              onClick={() => {
                // Extract symptoms from chief complaint using proper matching
                const complaintLower = chiefComplaint.toLowerCase();
                const extracted = COMMON_SYMPTOMS.filter(symptom => {
                  // Check if the full symptom phrase exists in the complaint
                  // Use word boundary matching to avoid partial matches
                  const symptomRegex = new RegExp(`\\b${symptom.replace(/\s+/g, '\\s+')}\\b`, 'i');
                  return symptomRegex.test(complaintLower);
                });
                extracted.forEach(s => addSymptom(s, 'moderate'));
                if (extracted.length > 0) {
                  toast.success(`Extracted ${extracted.length} symptoms from complaint`);
                } else {
                  toast('No matching symptoms found. Try adding them manually.', { icon: 'ℹ️' });
                }
              }}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center gap-1"
            >
              <SparklesIcon className="h-4 w-4" />
              Extract
            </button>
          </div>
          <p className="text-sm text-purple-700">
            AI can analyze the chief complaint to automatically identify and extract symptoms.
          </p>
        </div>
      )}
    </div>
  );

  const renderDiagnosisStep = () => (
    <div className="space-y-6">
      {/* Run AI Diagnosis */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              AI-Assisted Diagnosis
            </h3>
            <p className="text-blue-100 text-sm mt-1">
              Based on {symptoms.length} symptom(s) and patient context
            </p>
          </div>
          <button
            onClick={runAIDiagnosis}
            disabled={diagnosisMutation.isPending || symptoms.length === 0}
            className="px-6 py-2.5 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {diagnosisMutation.isPending ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <BoltIcon className="h-5 w-5" />
                Run Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Diagnosis Results */}
      {diagnosisMutation.data && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Differential Diagnoses</h3>
          <div className="space-y-3">
            {(diagnosisMutation.data.diagnoses || []).map((diagnosis: Diagnosis) => (
              <div
                key={diagnosis.icd10}
                onClick={() => selectDiagnosis(diagnosis)}
                className={clsx(
                  'p-4 rounded-xl border-2 cursor-pointer transition-all',
                  selectedDiagnoses.find(d => d.icd10 === diagnosis.icd10)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{diagnosis.name}</span>
                      {selectedDiagnoses.find(d => d.icd10 === diagnosis.icd10)?.isPrimary && (
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      ICD-10: {diagnosis.icd10}
                      {diagnosis.category && ` | ${diagnosis.category}`}
                    </p>
                  </div>
                  <div className={clsx(
                    'px-3 py-1 rounded-full text-sm font-bold',
                    diagnosis.confidence >= 0.7 ? 'bg-green-100 text-green-700' :
                    diagnosis.confidence >= 0.4 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    {Math.round(diagnosis.confidence * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Tests */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
          <BeakerIcon className="h-5 w-5" />
          Recommended Tests
          <span className="text-sm font-normal text-green-600 ml-2">
            ({recommendedTests.length} test{recommendedTests.length !== 1 ? 's' : ''})
          </span>
        </h3>

        {/* Test List with Remove Buttons */}
        {recommendedTests.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {recommendedTests.map((test) => (
              <span
                key={test}
                className="px-3 py-1.5 bg-white text-green-700 rounded-lg text-sm border border-green-300 flex items-center gap-2"
              >
                {test}
                <button
                  type="button"
                  onClick={() => setRecommendedTests(prev => prev.filter(t => t !== test))}
                  className="text-green-500 hover:text-red-500 transition-colors"
                  title="Remove test"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}

        {recommendedTests.length === 0 && (
          <p className="text-green-600 text-sm mb-4 italic">No tests added yet. Run AI analysis or add manually.</p>
        )}

        {/* Add New Test Input */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-green-200">
          <input
            type="text"
            value={newTestInput}
            onChange={(e) => setNewTestInput(e.target.value)}
            placeholder="Add a test (e.g., Complete Blood Count)"
            className="flex-1 px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTestInput.trim()) {
                e.preventDefault();
                if (!recommendedTests.includes(newTestInput.trim())) {
                  setRecommendedTests(prev => [...prev, newTestInput.trim()]);
                }
                setNewTestInput('');
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (newTestInput.trim() && !recommendedTests.includes(newTestInput.trim())) {
                setRecommendedTests(prev => [...prev, newTestInput.trim()]);
                setNewTestInput('');
              }
            }}
            disabled={!newTestInput.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {/* Custom Diagnosis Input */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Add Custom Diagnosis
        </h3>
        <p className="text-sm text-purple-600 mb-4">
          Add a diagnosis not suggested by AI. You can optionally include the ICD-10 code.
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={customDiagnosisInput}
            onChange={(e) => setCustomDiagnosisInput(e.target.value)}
            placeholder="Diagnosis name (e.g., Type 2 Diabetes Mellitus)"
            className="flex-1 px-4 py-2.5 border border-purple-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <input
            type="text"
            value={customDiagnosisIcd}
            onChange={(e) => setCustomDiagnosisIcd(e.target.value)}
            placeholder="ICD-10 Code (optional)"
            className="w-full md:w-40 px-4 py-2.5 border border-purple-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            type="button"
            onClick={() => {
              if (customDiagnosisInput.trim()) {
                const newDiagnosis = {
                  id: `custom-${Date.now()}`,
                  name: customDiagnosisInput.trim(),
                  icd10: customDiagnosisIcd.trim() || undefined,
                  isPrimary: selectedDiagnoses.length === 0 && customDiagnoses.length === 0,
                };
                setCustomDiagnoses(prev => [...prev, newDiagnosis]);
                setCustomDiagnosisInput('');
                setCustomDiagnosisIcd('');
              }
            }}
            disabled={!customDiagnosisInput.trim()}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            <PlusIcon className="h-4 w-4" />
            Add Diagnosis
          </button>
        </div>

        {/* Custom Diagnoses List */}
        {customDiagnoses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-200">
            <h4 className="text-sm font-medium text-purple-700 mb-2">Custom Diagnoses Added:</h4>
            <div className="space-y-2">
              {customDiagnoses.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-purple-200">
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{d.name}</span>
                    {d.icd10 && <span className="ml-2 text-sm text-gray-500">({d.icd10})</span>}
                    <span className="ml-2 text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">Custom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Set this custom diagnosis as primary
                        setCustomDiagnoses(prev => prev.map(cd => ({ ...cd, isPrimary: cd.id === d.id })));
                        setSelectedDiagnoses(prev => prev.map(sd => ({ ...sd, isPrimary: false })));
                      }}
                      className={clsx(
                        'text-xs font-medium px-2 py-1 rounded transition-colors',
                        d.isPrimary
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
                      )}
                    >
                      {d.isPrimary ? 'Primary' : 'Set Primary'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomDiagnoses(prev => prev.filter(cd => cd.id !== d.id))}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Remove diagnosis"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected AI Diagnoses Summary */}
      {selectedDiagnoses.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            Selected AI Diagnoses
            <span className="text-sm font-normal text-blue-600">(from AI analysis)</span>
          </h3>
          <div className="space-y-2">
            {selectedDiagnoses.map((d) => (
              <div key={d.icd10} className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-200">
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{d.name}</span>
                  <span className="ml-2 text-sm text-gray-500">({d.icd10})</span>
                  <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">AI</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Set this AI diagnosis as primary
                      setSelectedDiagnoses(prev => prev.map(sd => ({ ...sd, isPrimary: sd.icd10 === d.icd10 })));
                      setCustomDiagnoses(prev => prev.map(cd => ({ ...cd, isPrimary: false })));
                    }}
                    className={clsx(
                      'text-xs font-medium px-2 py-1 rounded transition-colors',
                      d.isPrimary
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                    )}
                  >
                    {d.isPrimary ? 'Primary' : 'Set Primary'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDiagnoses(prev => prev.filter(sd => sd.icd10 !== d.icd10))}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Remove diagnosis"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consultant Referral Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-indigo-500" />
            Consultant Referral
          </h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-sm text-gray-600">Needs Referral</span>
            <button
              type="button"
              onClick={() => setNeedsConsultantReferral(!needsConsultantReferral)}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                needsConsultantReferral ? 'bg-indigo-600' : 'bg-gray-200'
              )}
            >
              <span
                className={clsx(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  needsConsultantReferral ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </label>
        </div>

        {needsConsultantReferral && (
          <div className="space-y-4 pt-4 border-t border-gray-100">
            {/* Specialty Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consultant Specialty <span className="text-red-500">*</span>
              </label>
              <select
                value={consultantSpecialty}
                onChange={(e) => setConsultantSpecialty(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              >
                <option value="">Select Specialty</option>
                {CONSULTANT_SPECIALTIES.map((specialty) => (
                  <option key={specialty} value={specialty}>{specialty}</option>
                ))}
              </select>
            </div>

            {/* Urgency Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Urgency Level
              </label>
              <div className="flex gap-3">
                {[
                  { value: 'routine', label: 'Routine', color: 'bg-green-100 border-green-300 text-green-700' },
                  { value: 'urgent', label: 'Urgent', color: 'bg-amber-100 border-amber-300 text-amber-700' },
                  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 border-red-300 text-red-700' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReferralUrgency(option.value as typeof referralUrgency)}
                    className={clsx(
                      'px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all',
                      referralUrgency === option.value
                        ? option.color
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Referral Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Referral
                {whisperAvailable === true && !isReferralReasonRecording && !isReferralReasonProcessing && (
                  <span className="ml-2 text-xs text-indigo-500 flex items-center gap-1 inline-flex">
                    <MicrophoneIcon className="h-3 w-3" />
                    Voice enabled
                  </span>
                )}
              </label>
              <div className="relative">
                <textarea
                  value={referralReason}
                  onChange={(e) => setReferralReason(e.target.value)}
                  rows={3}
                  placeholder="Describe the reason for consultant referral..."
                  className={clsx(
                    "w-full rounded-xl border bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none pr-12",
                    isReferralReasonRecording
                      ? "border-red-400 bg-red-50"
                      : "border-gray-300"
                  )}
                />
                {/* Mic button */}
                {!isReferralReasonRecording && !isReferralReasonProcessing && (
                  <button
                    type="button"
                    onClick={startReferralReasonVoice}
                    disabled={whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice}
                    className={clsx(
                      "absolute right-3 top-3 p-2 rounded-lg transition-colors",
                      whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-indigo-500 text-white hover:bg-indigo-600"
                    )}
                    title={whisperAvailable === false ? "Voice input unavailable" : "Voice input for referral reason"}
                  >
                    <MicrophoneIcon className="h-5 w-5" />
                  </button>
                )}
                {/* Recording indicator */}
                {isReferralReasonRecording && (
                  <div className="absolute right-3 top-3 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-red-600 text-sm">
                      <span className="animate-pulse">●</span> Recording...
                    </span>
                    <button
                      type="button"
                      onClick={stopVoiceInput}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Stop
                    </button>
                  </div>
                )}
                {/* Processing indicator */}
                {isReferralReasonProcessing && (
                  <div className="absolute right-3 top-3 flex items-center gap-2 text-indigo-600 text-sm">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Transcribing...
                  </div>
                )}
              </div>
            </div>

            {/* Referral Summary */}
            {consultantSpecialty && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                <p className="text-sm text-indigo-800">
                  <span className="font-semibold">Referral Summary:</span> Patient will be referred to{' '}
                  <span className="font-medium">{consultantSpecialty}</span> with{' '}
                  <span className={clsx(
                    'font-medium',
                    referralUrgency === 'routine' && 'text-green-700',
                    referralUrgency === 'urgent' && 'text-amber-700',
                    referralUrgency === 'emergency' && 'text-red-700'
                  )}>
                    {referralUrgency}
                  </span>{' '}
                  priority.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insurance Coding Section */}
      {selectedDiagnoses.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowInsuranceCoding(!showInsuranceCoding)}
            className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-purple-700 font-medium transition-colors"
          >
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              Insurance Coding & Billing
            </div>
            <ChevronRightIcon className={clsx(
              'h-5 w-5 transition-transform',
              showInsuranceCoding && 'rotate-90'
            )} />
          </button>

          {showInsuranceCoding && (
            <div className="mt-4 space-y-4">
              {/* Payer Alerts */}
              {payerAlerts.length > 0 && (
                <PayerRulesAlert
                  alerts={payerAlerts}
                  onDismiss={(idx) => {
                    setPayerAlerts(alerts => alerts.filter((_, i) => i !== idx));
                  }}
                />
              )}

              {/* AI Code Suggestions Panel */}
              <CodeSuggestionPanel
                clinicalText={`${chiefComplaint}\n${symptoms.map(s => s.name).join(', ')}\n${[...selectedDiagnoses.map(d => d.name), ...customDiagnoses.map(d => d.name)].join(', ')}`}
                patientAge={patientData?.dateOfBirth ? calculateAge(patientData.dateOfBirth) : undefined}
                patientGender={patientData?.gender}
                encounterType="outpatient"
                selectedIcdCodes={selectedIcdCodes.map(c => c.code)}
                selectedCptCodes={selectedCptCodes.map(c => c.code)}
                onSelectIcdCode={(code) => {
                  if (!selectedIcdCodes.find(c => c.code === code.code)) {
                    setSelectedIcdCodes([...selectedIcdCodes, {
                      id: code.code, // Use code as ID for AI suggestions
                      code: code.code,
                      description: code.description,
                      specificityLevel: code.specificityLevel,
                    }]);
                  }
                }}
                onSelectCptCode={(code) => {
                  if (!selectedCptCodes.find(c => c.code === code.code)) {
                    setSelectedCptCodes([...selectedCptCodes, {
                      id: code.code,
                      code: code.code,
                      description: code.description,
                      units: 1,
                    }]);
                  }
                }}
                onRemoveIcdCode={(code) => {
                  setSelectedIcdCodes(codes => codes.filter(c => c.code !== code));
                }}
                onRemoveCptCode={(code) => {
                  setSelectedCptCodes(codes => codes.filter(c => c.code !== code));
                }}
              />

              {/* Manual ICD-10 Code Selection */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h4 className="text-md font-semibold text-gray-900 mb-4">ICD-10 Diagnosis Codes</h4>
                <ICD10Picker
                  selectedCodes={selectedIcdCodes}
                  onSelect={(code) => {
                    if (!selectedIcdCodes.find(c => c.id === code.id)) {
                      setSelectedIcdCodes([...selectedIcdCodes, code]);
                    }
                  }}
                  onRemove={(codeId) => {
                    setSelectedIcdCodes(codes => codes.filter(c => c.id !== codeId));
                  }}
                  maxSelections={10}
                />
              </div>

              {/* CPT Code Selection */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h4 className="text-md font-semibold text-gray-900 mb-4">CPT Procedure Codes</h4>
                <CPTCodePicker
                  selectedCodes={selectedCptCodes}
                  onSelect={(code) => {
                    if (!selectedCptCodes.find(c => c.id === code.id)) {
                      setSelectedCptCodes([...selectedCptCodes, {
                        ...code,
                        units: 1,
                        price: code.dhaPrice || code.basePrice,
                      }]);
                    }
                  }}
                  onRemove={(codeId) => {
                    setSelectedCptCodes(codes => codes.filter(c => c.id !== codeId));
                  }}
                  onUpdateCode={(codeId, updates) => {
                    setSelectedCptCodes(codes => codes.map(c =>
                      c.id === codeId ? { ...c, ...updates } : c
                    ));
                  }}
                  showPrices={true}
                  maxSelections={20}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderTreatmentStep = () => (
    <div className="space-y-6">
      {/* Prescription Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Prescriptions</h3>
        <button
          onClick={addPrescription}
          className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Add Medication
        </button>
      </div>

      {/* Drug Interactions Warning */}
      {drugInteractions.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
          <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-4">
            <ShieldExclamationIcon className="h-5 w-5" />
            Drug Interaction Warnings
          </h4>
          <div className="space-y-3">
            {drugInteractions.map((interaction, idx) => (
              <div
                key={idx}
                className={clsx(
                  'p-4 rounded-xl border',
                  getInteractionSeverityColor(interaction.severity)
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{interaction.drug1}</span>
                  <span className="text-gray-400">+</span>
                  <span className="font-medium">{interaction.drug2}</span>
                  <span className="ml-auto text-xs font-semibold uppercase px-2 py-0.5 rounded">
                    {interaction.severity}
                  </span>
                </div>
                <p className="text-sm opacity-80">{interaction.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
          <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No prescriptions added yet</p>
          <button
            onClick={addPrescription}
            className="mt-4 text-blue-600 hover:underline font-medium"
          >
            Add first prescription
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx, index) => (
            <div key={rx.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">Medication #{index + 1}</span>
                <button
                  onClick={() => removePrescription(rx.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name</label>
                  <div className="flex gap-2">
                    <DrugPicker
                      value={rx.medication}
                      onChange={(drug) => handleDrugSelection(rx.id, drug)}
                      placeholder="Search medication..."
                      autoSearchOnValueChange={true}
                      className={clsx(
                        "flex-1",
                        allergyConflicts.some(c => c.medication.toLowerCase() === rx.medication.toLowerCase()) && "[&_input]:border-red-500 [&_input]:bg-red-50"
                      )}
                    />
                    {isPrescriptionFieldRecording(rx.id, 'medication') ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={cancelVoiceInput}
                          className="px-2 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={stopVoiceInput}
                          className="px-2 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-1"
                          title="Stop & Transcribe"
                        >
                          <StopIcon className="h-4 w-4" />
                          <span className="text-xs">{formatDuration(fieldRecordingDuration)}</span>
                        </button>
                      </div>
                    ) : isPrescriptionFieldProcessing(rx.id, 'medication') ? (
                      <button type="button" disabled className="px-2 py-2 rounded-lg bg-blue-100 text-blue-600">
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startPrescriptionVoice(rx.id, 'medication')}
                        disabled={whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice}
                        className={clsx(
                          "px-2 py-2 rounded-lg transition-colors",
                          whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        )}
                        title={whisperAvailable === false ? "Voice input unavailable" : "Voice input"}
                      >
                        <MicrophoneIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {rx.genericName && (
                    <div className="mt-1 text-xs text-gray-500">
                      Generic: {rx.genericName} {rx.dosageForm && `· ${rx.dosageForm}`}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rx.dosage}
                      onChange={(e) => updatePrescription(rx.id, 'dosage', e.target.value)}
                      placeholder="e.g., 500mg"
                      className={clsx(
                        "flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                        isPrescriptionFieldRecording(rx.id, 'dosage')
                          ? "border-red-400 bg-red-50"
                          : "border-gray-300"
                      )}
                    />
                    {isPrescriptionFieldRecording(rx.id, 'dosage') ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={cancelVoiceInput}
                          className="px-2 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={stopVoiceInput}
                          className="px-2 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-1"
                          title="Stop & Transcribe"
                        >
                          <StopIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : isPrescriptionFieldProcessing(rx.id, 'dosage') ? (
                      <button type="button" disabled className="px-2 py-2 rounded-lg bg-blue-100 text-blue-600">
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startPrescriptionVoice(rx.id, 'dosage')}
                        disabled={whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice}
                        className={clsx(
                          "px-2 py-2 rounded-lg transition-colors",
                          whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        )}
                        title={whisperAvailable === false ? "Voice input unavailable" : "Voice input"}
                      >
                        <MicrophoneIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                  <select
                    value={rx.route}
                    onChange={(e) => updatePrescription(rx.id, 'route', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {MEDICATION_ROUTES.map(route => (
                      <option key={route} value={route}>{route}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={rx.frequency}
                    onChange={(e) => updatePrescription(rx.id, 'frequency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {FREQUENCIES.map(freq => (
                      <option key={freq} value={freq}>{freq}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={rx.duration}
                    onChange={(e) => updatePrescription(rx.id, 'duration', e.target.value)}
                    placeholder="e.g., 7 days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rx.instructions}
                      onChange={(e) => updatePrescription(rx.id, 'instructions', e.target.value)}
                      placeholder="e.g., Take with food"
                      className={clsx(
                        "flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                        isPrescriptionFieldRecording(rx.id, 'instructions')
                          ? "border-red-400 bg-red-50"
                          : "border-gray-300"
                      )}
                    />
                    {isPrescriptionFieldRecording(rx.id, 'instructions') ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={cancelVoiceInput}
                          className="px-2 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={stopVoiceInput}
                          className="px-2 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-1"
                          title="Stop & Transcribe"
                        >
                          <StopIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : isPrescriptionFieldProcessing(rx.id, 'instructions') ? (
                      <button type="button" disabled className="px-2 py-2 rounded-lg bg-blue-100 text-blue-600">
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startPrescriptionVoice(rx.id, 'instructions')}
                        disabled={whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice}
                        className={clsx(
                          "px-2 py-2 rounded-lg transition-colors",
                          whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        )}
                        title={whisperAvailable === false ? "Voice input unavailable" : "Voice input"}
                      >
                        <MicrophoneIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Allergy Conflict Warning */}
              {allergyConflicts.find(c => c.medication.toLowerCase() === rx.medication.toLowerCase()) && (
                <div className="mt-4 p-3 bg-red-100 border-2 border-red-300 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                      <span className="text-red-700 font-medium">
                        ALLERGY CONFLICT: Patient is allergic to {allergyConflicts.find(c => c.medication.toLowerCase() === rx.medication.toLowerCase())?.allergen}
                      </span>
                    </div>
                    {!acknowledgedConflicts.some(m => m.toLowerCase() === rx.medication.toLowerCase()) ? (
                      <button
                        onClick={() => acknowledgeAllergyConflict(rx.medication)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        Acknowledge & Proceed
                      </button>
                    ) : (
                      <span className="text-sm text-green-700 font-medium flex items-center gap-1">
                        <CheckCircleIcon className="h-4 w-4" />
                        Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings for this medication */}
              {rx.warnings && rx.warnings.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    {rx.warnings.join(', ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSummaryStep = () => (
    <div className="space-y-6">
      {/* Clinical Notes */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Clinical Notes</h3>
          {whisperAvailable === true && !isClinicalNotesRecording && !isClinicalNotesProcessing && (
            <span className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full">
              <MicrophoneIcon className="h-3 w-3" />
              Voice ready
            </span>
          )}
        </div>

        {/* Recording indicator */}
        {isClinicalNotesRecording && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <div>
                  <p className="font-medium text-red-700">Recording...</p>
                  <p className="text-sm text-red-600">{formatDuration(fieldRecordingDuration)} / 0:30</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelVoiceInput}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={stopVoiceInput}
                  className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-1"
                >
                  <StopIcon className="h-4 w-4" />
                  Stop & Transcribe
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isClinicalNotesProcessing && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3">
              <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
              <div>
                <p className="font-medium text-blue-700">Transcribing with Whisper AI...</p>
                <p className="text-sm text-blue-600">Converting your speech to text</p>
              </div>
            </div>
          </div>
        )}

        <div className="relative">
          <textarea
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Enter additional clinical observations and notes..."
            rows={4}
            className={clsx(
              "w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 resize-none pr-12",
              isClinicalNotesRecording
                ? "border-red-400 bg-red-50"
                : "border-gray-300"
            )}
          />
          {/* Mic button */}
          {!isClinicalNotesRecording && !isClinicalNotesProcessing && (
            <button
              type="button"
              onClick={startClinicalNotesVoice}
              disabled={whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice}
              className={clsx(
                "absolute right-3 top-3 p-2 rounded-lg transition-colors",
                whisperAvailable === false || isRecordingField || isProcessingField || isRecordingChiefComplaint || isProcessingVoice
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              )}
              title={whisperAvailable === false ? "Voice input unavailable" : "Voice input"}
            >
              <MicrophoneIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Click the microphone button to record voice input, or type directly.
        </p>
      </div>

      {/* AI SOAP Notes Generator */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            AI-Generated SOAP Notes
          </h3>
          <button
            onClick={() => generateSOAPMutation.mutate()}
            disabled={generateSOAPMutation.isPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            {generateSOAPMutation.isPending ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4" />
                Generate SOAP
              </>
            )}
          </button>
        </div>

        {soapNotes.subjective && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-2">Subjective</label>
              <textarea
                value={soapNotes.subjective}
                onChange={(e) => setSoapNotes(prev => ({ ...prev, subjective: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-2">Objective</label>
              <textarea
                value={soapNotes.objective}
                onChange={(e) => setSoapNotes(prev => ({ ...prev, objective: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-2">Assessment</label>
              <textarea
                value={soapNotes.assessment}
                onChange={(e) => setSoapNotes(prev => ({ ...prev, assessment: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-2">Plan</label>
              <textarea
                value={soapNotes.plan}
                onChange={(e) => setSoapNotes(prev => ({ ...prev, plan: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Consultation Summary */}
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Consultation Summary</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Patient</h4>
            <p className="font-medium text-gray-900">
              {patientData?.firstName} {patientData?.lastName} ({patientData?.mrn})
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Chief Complaint</h4>
            <p className="text-gray-900">{chiefComplaint || 'Not specified'}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Diagnoses</h4>
            <div className="space-y-1">
              {/* AI Diagnoses */}
              {selectedDiagnoses.map((d, i) => (
                <p key={d.icd10} className="text-gray-900 flex items-center gap-2">
                  <span>{i + 1}. {d.name} ({d.icd10})</span>
                  {d.isPrimary && <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded">Primary</span>}
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">AI</span>
                </p>
              ))}
              {/* Custom Diagnoses */}
              {customDiagnoses.map((d, i) => (
                <p key={d.id} className="text-gray-900 flex items-center gap-2">
                  <span>{selectedDiagnoses.length + i + 1}. {d.name}{d.icd10 ? ` (${d.icd10})` : ''}</span>
                  {d.isPrimary && <span className="text-xs px-1.5 py-0.5 bg-purple-500 text-white rounded">Primary</span>}
                  <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">Custom</span>
                </p>
              ))}
              {selectedDiagnoses.length === 0 && customDiagnoses.length === 0 && (
                <p className="text-gray-400">None</p>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Prescriptions</h4>
            <div className="space-y-1">
              {prescriptions.map((rx, i) => (
                <p key={rx.id} className="text-gray-900">
                  {i + 1}. {rx.medication} {rx.dosage} {rx.frequency}
                </p>
              ))}
              {prescriptions.length === 0 && <p className="text-gray-400">None</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // =============== AI Insights Panel ===============
  const renderAIInsightsPanel = () => (
    <div className="space-y-6">
      {/* AI Status */}
      <div className={clsx(
        'rounded-2xl p-4 border',
        isAIOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      )}>
        <div className="flex items-center gap-2">
          <div className={clsx(
            'w-3 h-3 rounded-full animate-pulse',
            isAIOnline ? 'bg-green-500' : 'bg-red-500'
          )} />
          <span className={clsx(
            'text-sm font-medium',
            isAIOnline ? 'text-green-700' : 'text-red-700'
          )}>
            AI Services {isAIOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Patient Risk Level */}
      {patientData && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <ShieldExclamationIcon className="h-5 w-5 text-blue-500" />
            Patient Risk Level
          </h4>
          {(() => {
            // Determine risk level from NEWS2 result (pre-filled from booking data or calculated)
            // NHS NEWS2 Guidelines: Score 0-4 (no extreme) = LOW, Score 5-6 OR extreme = MEDIUM, Score >= 7 = CRITICAL
            const riskLevel = news2Result?.riskLevel?.toUpperCase() ||
                              bookingData?.riskPrediction?.riskLevel?.toUpperCase() ||
                              (patientData.allergies && patientData.allergies.length > 0 ? 'MEDIUM' : 'LOW');
            const isCritical = riskLevel === 'CRITICAL' || (news2Result && news2Result.score >= 7);
            const isMedium = riskLevel === 'MODERATE' || riskLevel === 'MEDIUM' || riskLevel === 'HIGH' || (news2Result && news2Result.score >= 5);
            return (
              <div className={clsx(
                'px-4 py-3 rounded-xl text-center',
                isCritical ? 'bg-red-100' : isMedium ? 'bg-amber-100' : 'bg-green-100'
              )}>
                <p className={clsx(
                  'text-2xl font-bold',
                  isCritical ? 'text-red-700' : isMedium ? 'text-amber-700' : 'text-green-700'
                )}>
                  {isCritical ? 'CRITICAL' : isMedium ? 'MEDIUM' : 'LOW'}
                </p>
                {news2Result && (
                  <p className="text-sm mt-1 opacity-75">NEWS2: {news2Result.score}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* AI Insights List */}
      {aiInsights.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <LightBulbIcon className="h-5 w-5 text-amber-500" />
            AI Suggestions
          </h4>
          <div className="space-y-3">
            {aiInsights.map((insight, idx) => (
              <div
                key={idx}
                className={clsx(
                  'p-3 rounded-xl border',
                  insight.type === 'critical' ? 'bg-red-50 border-red-200' :
                  insight.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                  insight.type === 'suggestion' ? 'bg-blue-50 border-blue-200' :
                  'bg-gray-50 border-gray-200'
                )}
              >
                <p className={clsx(
                  'font-medium text-sm',
                  insight.type === 'critical' ? 'text-red-800' :
                  insight.type === 'warning' ? 'text-amber-800' :
                  insight.type === 'suggestion' ? 'text-blue-800' :
                  'text-gray-800'
                )}>
                  {insight.title}
                </p>
                <p className="text-xs text-gray-600 mt-1">{insight.description}</p>
                {insight.action && (
                  <p className="text-xs font-medium text-blue-600 mt-2">{insight.action}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drug Interactions */}
      {drugInteractions.length > 0 && (
        <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
          <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5" />
            Drug Interactions ({drugInteractions.length})
          </h4>
          <div className="space-y-2">
            {drugInteractions.slice(0, 3).map((interaction, idx) => (
              <div key={idx} className="p-2 bg-white rounded-lg text-sm">
                <p className="font-medium text-red-700">
                  {interaction.drug1} + {interaction.drug2}
                </p>
                <p className="text-xs text-gray-500">{interaction.severity}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Allergy Alerts */}
      {patientData?.allergies && patientData.allergies.length > 0 && (
        <div className="bg-orange-50 rounded-2xl p-5 border border-orange-200">
          <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Allergy Alerts
          </h4>
          <div className="space-y-2">
            {patientData.allergies.map((allergy, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg">
                <span className="font-medium text-gray-800">{allergy.allergen}</span>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded',
                  allergy.severity === 'severe' ? 'bg-red-100 text-red-700' :
                  allergy.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                  'bg-yellow-100 text-yellow-700'
                )}>
                  {allergy.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      {recommendedTests.length > 0 && (
        <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
          <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <BeakerIcon className="h-5 w-5" />
            Recommended Tests
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {recommendedTests.slice(0, 5).map((test, idx) => (
              <span key={idx} className="px-2 py-1 bg-white text-green-700 rounded text-xs border border-green-200">
                {test}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Consultation Timer */}
      <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl p-5 text-center border border-gray-200">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
          <ClockIcon className="h-6 w-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-500">Consultation Duration</p>
        <p className="text-3xl font-bold text-gray-800">{elapsedTime}</p>
      </div>
    </div>
  );

  // =============== Main Render ===============
  if (loadingPatient && selectedPatientId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <ArrowPathIcon className="h-12 w-12 animate-spin mx-auto text-blue-500" />
          <p className="mt-4 text-gray-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI-Enhanced Consultation</h1>
            <p className="text-sm text-gray-500">
              {patientData ? `${patientData.firstName} ${patientData.lastName} (${patientData.mrn})` : 'Select a patient to begin'}
            </p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Main Content Layout */}
      <div className="grid lg:grid-cols-10 gap-6">
        {/* Main Content Area - 70% */}
        <div className="lg:col-span-7">
          {currentStep === 1 && renderPatientStep()}
          {currentStep === 2 && renderVitalsStep()}
          {currentStep === 3 && renderSymptomsStep()}
          {currentStep === 4 && renderDiagnosisStep()}
          {currentStep === 5 && renderTreatmentStep()}
          {currentStep === 6 && renderSummaryStep()}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeftIcon className="h-5 w-5" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {CONSULTATION_STEPS.map((step) => (
                <div
                  key={step.id}
                  className={clsx(
                    'w-2.5 h-2.5 rounded-full transition-all',
                    currentStep === step.id ? 'bg-blue-500 w-6' :
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'
                  )}
                />
              ))}
            </div>

            {currentStep === 6 ? (
              <button
                onClick={completeConsultation}
                disabled={selectedDiagnoses.length === 0 && customDiagnoses.length === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircleIcon className="h-5 w-5" />
                Complete Consultation
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep(Math.min(6, currentStep + 1))}
                disabled={!canProceed}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* AI Insights Panel - 30% */}
        <div className="lg:col-span-3">
          <div className="sticky top-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 mb-6 text-white">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5" />
                <h3 className="font-semibold">AI Insights Panel</h3>
              </div>
              <p className="text-sm text-indigo-100 mt-1">
                Real-time clinical decision support
              </p>
            </div>
            {renderAIInsightsPanel()}
          </div>
        </div>
      </div>

      {/* Patient History Modal */}
      {showPatientHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                Past Visits - {patientData?.firstName} {patientData?.lastName}
              </h3>
              <button
                onClick={() => setShowPatientHistory(false)}
                className="text-white/80 hover:text-white"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {patientHistoryData?.bookings && patientHistoryData.bookings.length > 0 ? (
                <div className="space-y-4">
                  {patientHistoryData.bookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <CalendarIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {new Date(booking.appointmentDate).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-500">
                              {booking.doctor.name} - {booking.doctor.department}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          {booking.type}
                        </span>
                      </div>

                      {booking.consultation && (
                        <div className="mt-3 space-y-2">
                          {booking.consultation.chiefComplaint && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase">Chief Complaint</span>
                              <p className="text-sm text-gray-700">{booking.consultation.chiefComplaint}</p>
                            </div>
                          )}
                          {booking.consultation.diagnosis && booking.consultation.diagnosis.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase">Diagnosis</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {booking.consultation.diagnosis.map((dx, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                    {dx}
                                    {booking.consultation?.icdCodes[idx] && (
                                      <span className="ml-1 text-blue-600">({booking.consultation.icdCodes[idx]})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {booking.vitals && (
                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                              {booking.vitals.bloodPressureSys && (
                                <span>BP: {booking.vitals.bloodPressureSys}/{booking.vitals.bloodPressureDia}</span>
                              )}
                              {booking.vitals.heartRate && <span>HR: {booking.vitals.heartRate}</span>}
                              {booking.vitals.temperature && <span>Temp: {Number(booking.vitals.temperature).toFixed(1)}°C</span>}
                            </div>
                          )}
                          {booking.consultation.labResults && booking.consultation.labResults.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs font-medium text-gray-500 uppercase">Lab Results</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {booking.consultation.labResults.map((lab, idx) => (
                                  <span
                                    key={idx}
                                    className={clsx(
                                      'px-2 py-0.5 rounded text-xs',
                                      lab.isCritical
                                        ? 'bg-red-100 text-red-800'
                                        : lab.isAbnormal
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-green-100 text-green-800'
                                    )}
                                  >
                                    {lab.testName}: {lab.result || 'N/A'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ClockIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p>No previous visits found for this patient.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
