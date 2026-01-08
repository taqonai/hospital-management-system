import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCircleIcon,
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
} from '@heroicons/react/24/outline';
import { patientApi, aiApi, smartOrderApi, medSafetyApi, ipdApi } from '../../services/api';
import { useAIHealth } from '../../hooks/useAI';
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
  medicalHistory?: Array<{ condition: string; diagnosedDate: string; status?: string }>;
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
}

interface NEWS2Result {
  score: number;
  riskLevel: 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH';
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
  medication: string;
  genericName?: string;
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
    case 'LOW_MEDIUM': return 'text-yellow-700 bg-yellow-100';
    case 'MEDIUM': return 'text-amber-700 bg-amber-100';
    case 'HIGH': return 'text-red-700 bg-red-100';
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
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<Diagnosis[]>([]);
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
      const response = await aiApi.analyzeDiagnosis({
        symptoms: data.symptoms,
        patientAge: data.patientAge,
        gender: data.gender,
        medicalHistory: patientData?.medicalHistory?.map(h => h.condition) || [],
        currentMedications: [],
        allergies: patientData?.allergies?.map(a => a.allergen) || [],
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
      const assessment = selectedDiagnoses.map(d => `${d.name} (${d.icd10}) - ${Math.round(d.confidence * 100)}% confidence`).join('\n');
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
    setPrescriptions(prev => prev.map(rx =>
      rx.id === id ? { ...rx, [field]: value } : rx
    ));
  };

  const removePrescription = (id: string) => {
    setPrescriptions(prev => prev.filter(rx => rx.id !== id));
  };

  const selectDiagnosis = (diagnosis: Diagnosis) => {
    setSelectedDiagnoses(prev => {
      const exists = prev.find(d => d.icd10 === diagnosis.icd10);
      if (exists) {
        return prev.filter(d => d.icd10 !== diagnosis.icd10);
      }
      return [...prev, { ...diagnosis, isPrimary: prev.length === 0 }];
    });
  };

  const completeConsultation = async () => {
    try {
      // Generate final SOAP notes
      await generateSOAPMutation.mutateAsync();
      toast.success('Consultation completed successfully');
      navigate('/opd');
    } catch (error) {
      toast.error('Failed to complete consultation');
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
      case 4: return selectedDiagnoses.length > 0;
      case 5: return true; // Prescriptions are optional
      case 6: return true;
      default: return false;
    }
  }, [currentStep, selectedPatientId, vitals, symptoms, chiefComplaint, selectedDiagnoses]);

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
            <button
              onClick={() => setSelectedPatientId(null)}
              className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
            >
              Change
            </button>
          </div>

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

          {/* Medical History */}
          {patientData.medicalHistory && patientData.medicalHistory.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {patientData.medicalHistory.slice(0, 5).map((h, i) => (
                <span key={i} className="px-2 py-1 bg-white/15 rounded-lg text-sm">
                  {h.condition}
                </span>
              ))}
            </div>
          )}
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
              <p className={clsx('font-semibold px-2 py-1 rounded inline-block', getRiskLevelColor(patientContext.riskLevel || 'low'))}>
                {patientContext.riskLevel || 'Low'}
              </p>
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

  const renderVitalsStep = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <HeartIcon className="h-5 w-5 text-red-500" />
          Record Vital Signs
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
                onChange={(e) => handleVitalsChange('bloodPressureSys', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="flex items-center text-gray-400">/</span>
              <input
                type="number"
                placeholder="Dia"
                value={vitals.bloodPressureDia || ''}
                onChange={(e) => handleVitalsChange('bloodPressureDia', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              onChange={(e) => handleVitalsChange('heartRate', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              onChange={(e) => handleVitalsChange('temperature', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Oxygen Saturation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">SpO2 (%)</label>
            <input
              type="number"
              placeholder="95-100"
              value={vitals.oxygenSaturation || ''}
              onChange={(e) => handleVitalsChange('oxygenSaturation', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Respiratory Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Respiratory Rate (/min)</label>
            <input
              type="number"
              placeholder="12-20"
              value={vitals.respiratoryRate || ''}
              onChange={(e) => handleVitalsChange('respiratoryRate', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              onChange={(e) => handleVitalsChange('painLevel', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              onChange={(e) => handleVitalsChange('weight', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Height (cm)</label>
            <input
              type="number"
              value={vitals.height || ''}
              onChange={(e) => handleVitalsChange('height', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

      {/* Previous Vitals */}
      {vitalsHistory && vitalsHistory.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-6">
          <h4 className="font-medium text-gray-700 mb-3">Previous Vitals</h4>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Chief Complaint</h3>
        <textarea
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          placeholder="Describe the patient's main concern..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
        />
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
      {recommendedTests.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
            <BeakerIcon className="h-5 w-5" />
            Recommended Tests
          </h3>
          <div className="flex flex-wrap gap-2">
            {recommendedTests.map((test) => (
              <span
                key={test}
                className="px-3 py-1.5 bg-white text-green-700 rounded-lg text-sm border border-green-300"
              >
                {test}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Selected Diagnoses Summary */}
      {selectedDiagnoses.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">Selected Diagnoses</h3>
          <div className="space-y-2">
            {selectedDiagnoses.map((d, index) => (
              <div key={d.icd10} className="flex items-center justify-between p-3 bg-white rounded-xl">
                <div>
                  <span className="font-medium text-gray-900">{d.name}</span>
                  <span className="ml-2 text-sm text-gray-500">({d.icd10})</span>
                </div>
                <span className={clsx(
                  'text-xs font-medium px-2 py-0.5 rounded',
                  index === 0 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                )}>
                  {index === 0 ? 'Primary' : 'Secondary'}
                </span>
              </div>
            ))}
          </div>
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
                  <input
                    type="text"
                    value={rx.medication}
                    onChange={(e) => updatePrescription(rx.id, 'medication', e.target.value)}
                    placeholder="e.g., Amoxicillin"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={rx.dosage}
                    onChange={(e) => updatePrescription(rx.id, 'dosage', e.target.value)}
                    placeholder="e.g., 500mg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
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
                  <input
                    type="text"
                    value={rx.instructions}
                    onChange={(e) => updatePrescription(rx.id, 'instructions', e.target.value)}
                    placeholder="e.g., Take with food"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinical Notes</h3>
        <textarea
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.target.value)}
          placeholder="Enter additional clinical observations and notes..."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
        />
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
              {selectedDiagnoses.map((d, i) => (
                <p key={d.icd10} className="text-gray-900">
                  {i + 1}. {d.name} ({d.icd10})
                </p>
              ))}
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
          <div className={clsx(
            'px-4 py-3 rounded-xl text-center',
            news2Result && news2Result.score >= 5 ? 'bg-red-100' :
            patientData.allergies && patientData.allergies.length > 0 ? 'bg-amber-100' :
            'bg-green-100'
          )}>
            <p className={clsx(
              'text-2xl font-bold',
              news2Result && news2Result.score >= 5 ? 'text-red-700' :
              patientData.allergies && patientData.allergies.length > 0 ? 'text-amber-700' :
              'text-green-700'
            )}>
              {news2Result && news2Result.score >= 5 ? 'HIGH' :
               patientData.allergies && patientData.allergies.length > 0 ? 'MODERATE' : 'LOW'}
            </p>
          </div>
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
        <div className="flex items-center gap-3">
          {currentStep === 6 && (
            <button
              onClick={completeConsultation}
              className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <CheckCircleIcon className="h-5 w-5" />
              Complete Consultation
            </button>
          )}
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

            <button
              onClick={() => setCurrentStep(Math.min(6, currentStep + 1))}
              disabled={currentStep === 6 || !canProceed}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <ChevronRightIcon className="h-5 w-5" />
            </button>
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
    </div>
  );
}
