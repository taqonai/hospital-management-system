import { useState, Fragment, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition, Tab } from '@headlessui/react';
import {
  HeartIcon,
  ClipboardDocumentListIcon,
  BeakerIcon,
  UserGroupIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import toast from 'react-hot-toast';

interface MedicalHistory {
  id: string;
  patientId: string;
  chronicConditions: string[];
  pastSurgeries: string[];
  familyHistory: string[];
  currentMedications: string[];
  immunizations: string[];
  lifestyle: {
    smoking?: string;
    alcohol?: string;
    exercise?: string;
    diet?: string;
  } | null;
  notes: string | null;
  // New fields
  currentTreatment?: string | null;
  isPregnant?: boolean | null;
  expectedDueDate?: string | null;
}

interface Allergy {
  id: string;
  allergen: string;
  type: 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  reaction?: string;
  notes?: string;
  createdAt: string;
}

interface ImmunizationRecord {
  id: string;
  vaccineName: string;
  vaccineType?: string | null;
  doseNumber?: number | null;
  dateAdministered: string;
  administeredBy?: string | null;
  lotNumber?: string | null;
  nextDueDate?: string | null;
  notes?: string | null;
  verificationStatus?: string;
}

interface PastSurgeryRecord {
  id: string;
  surgeryName: string;
  surgeryDate: string;
  hospitalName: string;
  hospitalLocation?: string | null;
  surgeonName?: string | null;
  indication?: string | null;
  complications?: string | null;
  outcome?: string | null;
  notes?: string | null;
  verificationStatus?: string;
}

interface AIAnalysis {
  summary: {
    totalConditions: number;
    totalAllergies: number;
    riskLevel: string;
  };
  recommendations: Array<{
    title: string;
    description: string;
    priority: string;
  }>;
  riskFactors: Array<{
    factor: string;
    level: string;
  }>;
  preventiveCare: Array<{
    test: string;
    frequency: string;
    importance: string;
  }>;
  lastAnalyzed: string;
}

const ALLERGY_TYPES = [
  { value: 'DRUG', label: 'Drug/Medication' },
  { value: 'FOOD', label: 'Food' },
  { value: 'ENVIRONMENTAL', label: 'Environmental' },
  { value: 'OTHER', label: 'Other' },
];

const SEVERITY_LEVELS = [
  { value: 'MILD', label: 'Mild', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'MODERATE', label: 'Moderate', color: 'bg-orange-100 text-orange-800' },
  { value: 'SEVERE', label: 'Severe', color: 'bg-red-100 text-red-800' },
  { value: 'LIFE_THREATENING', label: 'Life-Threatening', color: 'bg-red-200 text-red-900' },
];

const COMMON_CONDITIONS = [
  'Diabetes Type 1', 'Diabetes Type 2', 'Hypertension', 'Asthma', 'COPD',
  'Heart Disease', 'Arthritis', 'Thyroid Disorder', 'High Cholesterol', 'Anxiety',
  'Depression', 'Migraine', 'Epilepsy', 'Cancer', 'Kidney Disease'
];

const COMMON_ALLERGIES = {
  DRUG: ['Penicillin', 'Aspirin', 'Ibuprofen', 'Sulfa drugs', 'Codeine', 'Morphine'],
  FOOD: ['Peanuts', 'Tree nuts', 'Shellfish', 'Eggs', 'Milk', 'Wheat', 'Soy', 'Fish'],
  ENVIRONMENTAL: ['Pollen', 'Dust mites', 'Pet dander', 'Mold', 'Latex', 'Bee stings'],
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const formatDisplayDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '-';
  }
};

export default function MedicalHistory() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Immunization modal state
  const [showImmunizationModal, setShowImmunizationModal] = useState(false);
  const [editingImmunization, setEditingImmunization] = useState<ImmunizationRecord | null>(null);
  const [immunizationForm, setImmunizationForm] = useState({
    vaccineName: '',
    vaccineType: '',
    doseNumber: '',
    dateAdministered: '',
    administeredBy: '',
    lotNumber: '',
    nextDueDate: '',
    notes: '',
  });

  // Surgery modal state
  const [showSurgeryModal, setShowSurgeryModal] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState<PastSurgeryRecord | null>(null);
  const [surgeryForm, setSurgeryForm] = useState({
    surgeryName: '',
    surgeryDate: '',
    hospitalName: '',
    hospitalLocation: '',
    surgeonName: '',
    indication: '',
    complications: '',
    outcome: '',
    notes: '',
  });

  // Form states
  const [formData, setFormData] = useState<Partial<MedicalHistory>>({
    chronicConditions: [],
    pastSurgeries: [],
    familyHistory: [],
    currentMedications: [],
    immunizations: [],
    lifestyle: null,
    notes: null,
    currentTreatment: null,
    isPregnant: null,
    expectedDueDate: null,
  });

  // Ref to always have access to the latest formData value
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Patient profile for gender/age check
  const [patientProfile, setPatientProfile] = useState<{
    gender?: string;
    dateOfBirth?: string;
  } | null>(null);

  const [newCondition, setNewCondition] = useState('');
  const [newFamilyHistory, setNewFamilyHistory] = useState('');
  const [newMedication, setNewMedication] = useState({ name: '', dosage: '', frequency: '' });

  // Allergy form
  const [allergyForm, setAllergyForm] = useState({
    allergen: '',
    type: 'DRUG' as 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER',
    severity: 'MILD' as 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING',
    reaction: '',
    notes: '',
  });

  // Helper to calculate age from date of birth
  const calculateAge = (dateOfBirth: string | undefined): number | null => {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Fetch patient profile for gender/age check
  const { data: profileData } = useQuery({
    queryKey: ['patient-profile'],
    queryFn: async () => {
      const response = await patientPortalApi.getProfile();
      const data = response.data?.data || response.data;
      setPatientProfile({
        gender: data?.gender,
        dateOfBirth: data?.dateOfBirth,
      });
      return data;
    },
  });

  // Determine if pregnancy question should be shown
  const patientAge = calculateAge(patientProfile?.dateOfBirth);
  const shouldShowPregnancy =
    patientProfile?.gender?.toUpperCase() === 'FEMALE' &&
    patientAge !== null &&
    patientAge >= 18 &&
    patientAge <= 55;

  // Fetch medical history
  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['patient-medical-history'],
    queryFn: async () => {
      const response = await patientPortalApi.getMedicalHistory();
      return response.data?.data || response.data;
    },
  });

  // Fetch structured immunizations
  const { data: immunizationsData, isLoading: loadingImmunizations } = useQuery({
    queryKey: ['patient-immunizations'],
    queryFn: async () => {
      const response = await patientPortalApi.getImmunizations();
      return response.data?.data || response.data || [];
    },
  });

  // Fetch structured past surgeries
  const { data: surgeriesData, isLoading: loadingSurgeries } = useQuery({
    queryKey: ['patient-past-surgeries'],
    queryFn: async () => {
      const response = await patientPortalApi.getPastSurgeries();
      return response.data?.data || response.data || [];
    },
  });

  // Track if initial data has been loaded
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Sync form data on initial load and after mutation refetch
  useEffect(() => {
    if (historyData && !isEditing) {
      setFormData({
        chronicConditions: historyData?.chronicConditions || [],
        pastSurgeries: historyData?.pastSurgeries || [],
        familyHistory: historyData?.familyHistory || [],
        currentMedications: historyData?.currentMedications || [],
        immunizations: historyData?.immunizations || [],
        lifestyle: historyData?.lifestyle || null,
        notes: historyData?.notes || null,
        currentTreatment: historyData?.currentTreatment || null,
        isPregnant: historyData?.isPregnant ?? null,
        expectedDueDate: historyData?.expectedDueDate ? new Date(historyData.expectedDueDate).toISOString().split('T')[0] : null,
      });
      if (!initialLoadDone) {
        setInitialLoadDone(true);
      }
    }
  }, [historyData, isEditing, initialLoadDone]);

  // Fetch allergies
  const { data: allergiesData, isLoading: loadingAllergies } = useQuery({
    queryKey: ['patient-allergies'],
    queryFn: async () => {
      const response = await patientPortalApi.getAllergies();
      return response.data?.data || response.data || [];
    },
  });

  // Update medical history mutation
  const updateHistoryMutation = useMutation({
    mutationFn: (data: any) => patientPortalApi.updateMedicalHistory(data),
    onSuccess: async (response) => {
      const responseData = response.data?.data || response.data;
      if (responseData) {
        const newFormData = {
          chronicConditions: responseData?.chronicConditions || [],
          pastSurgeries: responseData?.pastSurgeries || [],
          familyHistory: responseData?.familyHistory || [],
          currentMedications: responseData?.currentMedications || [],
          immunizations: responseData?.immunizations || [],
          lifestyle: responseData?.lifestyle || null,
          notes: responseData?.notes || null,
          currentTreatment: responseData?.currentTreatment || null,
          isPregnant: responseData?.isPregnant ?? null,
          expectedDueDate: responseData?.expectedDueDate ? new Date(responseData.expectedDueDate).toISOString().split('T')[0] : null,
        };
        setFormData(newFormData);
      }
      await queryClient.invalidateQueries({ queryKey: ['patient-medical-history'] });
      await queryClient.refetchQueries({ queryKey: ['patient-medical-history'] });
      toast.success('Medical history updated successfully');
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update medical history');
    },
  });

  // Immunization mutations
  const addImmunizationMutation = useMutation({
    mutationFn: (data: any) => patientPortalApi.addImmunization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-immunizations'] });
      toast.success('Immunization added successfully');
      setShowImmunizationModal(false);
      resetImmunizationForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add immunization');
    },
  });

  const updateImmunizationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      patientPortalApi.updateImmunization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-immunizations'] });
      toast.success('Immunization updated successfully');
      setShowImmunizationModal(false);
      setEditingImmunization(null);
      resetImmunizationForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update immunization');
    },
  });

  const deleteImmunizationMutation = useMutation({
    mutationFn: (id: string) => patientPortalApi.deleteImmunization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-immunizations'] });
      toast.success('Immunization removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove immunization');
    },
  });

  // Past surgery mutations
  const addSurgeryMutation = useMutation({
    mutationFn: (data: any) => patientPortalApi.addPastSurgery(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-past-surgeries'] });
      toast.success('Past surgery added successfully');
      setShowSurgeryModal(false);
      resetSurgeryForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add past surgery');
    },
  });

  const updateSurgeryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      patientPortalApi.updatePastSurgery(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-past-surgeries'] });
      toast.success('Past surgery updated successfully');
      setShowSurgeryModal(false);
      setEditingSurgery(null);
      resetSurgeryForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update past surgery');
    },
  });

  const deleteSurgeryMutation = useMutation({
    mutationFn: (id: string) => patientPortalApi.deletePastSurgery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-past-surgeries'] });
      toast.success('Past surgery removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove past surgery');
    },
  });

  // Add allergy mutation
  const addAllergyMutation = useMutation({
    mutationFn: (data: any) => patientPortalApi.addAllergy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-allergies'] });
      toast.success('Allergy added successfully');
      setShowAllergyModal(false);
      resetAllergyForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add allergy');
    },
  });

  // Update allergy mutation
  const updateAllergyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      patientPortalApi.updateAllergy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-allergies'] });
      toast.success('Allergy updated successfully');
      setShowAllergyModal(false);
      setEditingAllergy(null);
      resetAllergyForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update allergy');
    },
  });

  // Delete allergy mutation
  const deleteAllergyMutation = useMutation({
    mutationFn: (id: string) => patientPortalApi.deleteAllergy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-allergies'] });
      toast.success('Allergy removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove allergy');
    },
  });

  // AI Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: () => patientPortalApi.analyzeMedicalHistory(),
    onSuccess: (response) => {
      const data = response.data?.data || response.data;
      setShowAnalysis(true);
      return data;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate analysis');
    },
  });

  const resetAllergyForm = () => {
    setAllergyForm({
      allergen: '',
      type: 'DRUG',
      severity: 'MILD',
      reaction: '',
      notes: '',
    });
  };

  const resetImmunizationForm = () => {
    setImmunizationForm({
      vaccineName: '',
      vaccineType: '',
      doseNumber: '',
      dateAdministered: '',
      administeredBy: '',
      lotNumber: '',
      nextDueDate: '',
      notes: '',
    });
  };

  const resetSurgeryForm = () => {
    setSurgeryForm({
      surgeryName: '',
      surgeryDate: '',
      hospitalName: '',
      hospitalLocation: '',
      surgeonName: '',
      indication: '',
      complications: '',
      outcome: '',
      notes: '',
    });
  };

  // Reset form data from historyData (used when Cancel is clicked)
  const handleCancelEdit = () => {
    if (historyData) {
      setFormData({
        chronicConditions: historyData?.chronicConditions || [],
        pastSurgeries: historyData?.pastSurgeries || [],
        familyHistory: historyData?.familyHistory || [],
        currentMedications: historyData?.currentMedications || [],
        immunizations: historyData?.immunizations || [],
        lifestyle: historyData?.lifestyle || null,
        notes: historyData?.notes || null,
        currentTreatment: historyData?.currentTreatment || null,
        isPregnant: historyData?.isPregnant ?? null,
        expectedDueDate: historyData?.expectedDueDate ? new Date(historyData.expectedDueDate).toISOString().split('T')[0] : null,
      });
    }
    setIsEditing(false);
  };

  const handleAddItem = (field: keyof MedicalHistory, value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    const currentFormData = { ...formDataRef.current };
    const currentItems = (currentFormData[field] as string[]) || [];
    if (!currentItems.includes(value.trim())) {
      const newData = {
        ...currentFormData,
        [field]: [...currentItems, value.trim()],
      };
      formDataRef.current = newData;
      setFormData(newData);
    }
    setter('');
  };

  const handleRemoveItem = (field: keyof MedicalHistory, value: string) => {
    const currentFormData = { ...formDataRef.current };
    const currentItems = (currentFormData[field] as string[]) || [];
    const newData = {
      ...currentFormData,
      [field]: currentItems.filter((item) => item !== value),
    };
    formDataRef.current = newData;
    setFormData(newData);
  };

  const handleSaveHistory = () => {
    updateHistoryMutation.mutate(formDataRef.current);
  };

  // Medication add (structured: name + dosage + frequency)
  const addMedication = () => {
    if (!newMedication.name.trim()) return;
    const medString = [
      newMedication.name.trim(),
      newMedication.dosage.trim(),
      newMedication.frequency.trim() ? `(${newMedication.frequency.trim()})` : '',
    ].filter(Boolean).join(' ');

    const currentFormData = { ...formDataRef.current };
    const currentMeds = (currentFormData.currentMedications as string[]) || [];
    const newData = {
      ...currentFormData,
      currentMedications: [...currentMeds, medString],
    };
    formDataRef.current = newData;
    setFormData(newData);
    setNewMedication({ name: '', dosage: '', frequency: '' });
  };

  const handleSaveAllergy = () => {
    if (!allergyForm.allergen.trim()) {
      toast.error('Allergen name is required');
      return;
    }
    if (editingAllergy) {
      updateAllergyMutation.mutate({ id: editingAllergy.id, data: allergyForm });
    } else {
      addAllergyMutation.mutate(allergyForm);
    }
  };

  const handleSaveImmunization = () => {
    if (!immunizationForm.vaccineName.trim()) {
      toast.error('Vaccine name is required');
      return;
    }
    if (!immunizationForm.dateAdministered) {
      toast.error('Date administered is required');
      return;
    }
    const data = {
      vaccineName: immunizationForm.vaccineName,
      vaccineType: immunizationForm.vaccineType || undefined,
      doseNumber: immunizationForm.doseNumber ? parseInt(immunizationForm.doseNumber) : undefined,
      dateAdministered: immunizationForm.dateAdministered,
      administeredBy: immunizationForm.administeredBy || undefined,
      lotNumber: immunizationForm.lotNumber || undefined,
      nextDueDate: immunizationForm.nextDueDate || undefined,
      notes: immunizationForm.notes || undefined,
    };
    if (editingImmunization) {
      updateImmunizationMutation.mutate({ id: editingImmunization.id, data });
    } else {
      addImmunizationMutation.mutate(data);
    }
  };

  const handleSaveSurgery = () => {
    if (!surgeryForm.surgeryName.trim()) {
      toast.error('Surgery name is required');
      return;
    }
    if (!surgeryForm.surgeryDate) {
      toast.error('Surgery date is required');
      return;
    }
    if (!surgeryForm.hospitalName.trim()) {
      toast.error('Hospital name is required');
      return;
    }
    const data = {
      surgeryName: surgeryForm.surgeryName,
      surgeryDate: surgeryForm.surgeryDate,
      hospitalName: surgeryForm.hospitalName,
      hospitalLocation: surgeryForm.hospitalLocation || undefined,
      surgeonName: surgeryForm.surgeonName || undefined,
      indication: surgeryForm.indication || undefined,
      complications: surgeryForm.complications || undefined,
      outcome: surgeryForm.outcome || undefined,
      notes: surgeryForm.notes || undefined,
    };
    if (editingSurgery) {
      updateSurgeryMutation.mutate({ id: editingSurgery.id, data });
    } else {
      addSurgeryMutation.mutate(data);
    }
  };

  const openEditAllergy = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setAllergyForm({
      allergen: allergy.allergen,
      type: allergy.type,
      severity: allergy.severity,
      reaction: allergy.reaction || '',
      notes: allergy.notes || '',
    });
    setShowAllergyModal(true);
  };

  const openEditImmunization = (imm: ImmunizationRecord) => {
    setEditingImmunization(imm);
    setImmunizationForm({
      vaccineName: imm.vaccineName || '',
      vaccineType: imm.vaccineType || '',
      doseNumber: imm.doseNumber ? String(imm.doseNumber) : '',
      dateAdministered: formatDate(imm.dateAdministered),
      administeredBy: imm.administeredBy || '',
      lotNumber: imm.lotNumber || '',
      nextDueDate: formatDate(imm.nextDueDate),
      notes: imm.notes || '',
    });
    setShowImmunizationModal(true);
  };

  const openEditSurgery = (surgery: PastSurgeryRecord) => {
    setEditingSurgery(surgery);
    setSurgeryForm({
      surgeryName: surgery.surgeryName || '',
      surgeryDate: formatDate(surgery.surgeryDate),
      hospitalName: surgery.hospitalName || '',
      hospitalLocation: surgery.hospitalLocation || '',
      surgeonName: surgery.surgeonName || '',
      indication: surgery.indication || '',
      complications: surgery.complications || '',
      outcome: surgery.outcome || '',
      notes: surgery.notes || '',
    });
    setShowSurgeryModal(true);
  };

  const allergies: Allergy[] = allergiesData || [];
  const immunizations: ImmunizationRecord[] = immunizationsData || [];
  const pastSurgeries: PastSurgeryRecord[] = surgeriesData || [];
  const analysis: AIAnalysis | null = analysisMutation.data?.data?.data || analysisMutation.data?.data || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl text-white shadow-lg">
                <HeartIcon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Medical History</h1>
                <p className="text-gray-500 mt-1">Manage your health records and allergies</p>
              </div>
            </div>
            <button
              onClick={() => analysisMutation.mutate()}
              disabled={analysisMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
            >
              {analysisMutation.isPending ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <SparklesIcon className="h-5 w-5" />
              )}
              AI Health Analysis
            </button>
          </div>
        </div>

        {/* AI Analysis Results */}
        {showAnalysis && analysis && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-900">AI Health Analysis</h2>
              </div>
              <button
                onClick={() => setShowAnalysis(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow">
                <p className="text-sm text-gray-500">Health Conditions</p>
                <p className="text-2xl font-bold text-gray-900">{analysis.summary.totalConditions}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow">
                <p className="text-sm text-gray-500">Allergies</p>
                <p className="text-2xl font-bold text-gray-900">{analysis.summary.totalAllergies}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow">
                <p className="text-sm text-gray-500">Risk Level</p>
                <p className={`text-2xl font-bold ${
                  analysis.summary.riskLevel === 'elevated' ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {analysis.summary.riskLevel === 'elevated' ? 'Elevated' : 'Normal'}
                </p>
              </div>
            </div>

            {analysis.recommendations.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <LightBulbIcon className="h-5 w-5 text-yellow-500" />
                  Recommendations
                </h3>
                <div className="space-y-3">
                  {analysis.recommendations.map((rec, idx) => (
                    <div key={idx} className={`bg-white rounded-xl p-4 border-l-4 ${
                      rec.priority === 'high' ? 'border-red-500' :
                      rec.priority === 'medium' ? 'border-yellow-500' : 'border-blue-500'
                    }`}>
                      <h4 className="font-medium text-gray-900">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.preventiveCare.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ShieldExclamationIcon className="h-5 w-5 text-blue-500" />
                  Recommended Preventive Care
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.preventiveCare.map((care, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-4 shadow-sm">
                      <h4 className="font-medium text-gray-900">{care.test}</h4>
                      <p className="text-sm text-blue-600">{care.frequency}</p>
                      <p className="text-xs text-gray-500 mt-1">{care.importance}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <Tab.Group>
          <Tab.List className="flex space-x-2 rounded-xl bg-white/70 backdrop-blur-xl p-2 mb-6 shadow-lg border border-white/20">
            <Tab as={Fragment}>
              {({ selected }) => (
                <button
                  className={`w-full rounded-lg py-3 text-sm font-medium leading-5 transition-all ${
                    selected
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <ClipboardDocumentListIcon className="h-5 w-5" />
                    Health Conditions
                  </div>
                </button>
              )}
            </Tab>
            <Tab as={Fragment}>
              {({ selected }) => (
                <button
                  className={`w-full rounded-lg py-3 text-sm font-medium leading-5 transition-all ${
                    selected
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                    Allergies
                  </div>
                </button>
              )}
            </Tab>
            <Tab as={Fragment}>
              {({ selected }) => (
                <button
                  className={`w-full rounded-lg py-3 text-sm font-medium leading-5 transition-all ${
                    selected
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <BeakerIcon className="h-5 w-5" />
                    Medications & Immunizations
                  </div>
                </button>
              )}
            </Tab>
            <Tab as={Fragment}>
              {({ selected }) => (
                <button
                  className={`w-full rounded-lg py-3 text-sm font-medium leading-5 transition-all ${
                    selected
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <UserGroupIcon className="h-5 w-5" />
                    Family History
                  </div>
                </button>
              )}
            </Tab>
          </Tab.List>

          <Tab.Panels>
            {/* Health Conditions Tab */}
            <Tab.Panel>
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Chronic Conditions & Ongoing Treatment</h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveHistory}
                        disabled={updateHistoryMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                      >
                        {updateHistoryMutation.isPending ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <CheckCircleIcon className="h-5 w-5" />
                        )}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {loadingHistory ? (
                  <div className="text-center py-12">
                    <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-rose-500" />
                    <p className="mt-2 text-gray-500">Loading...</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Chronic Conditions */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Chronic Conditions</h3>
                      {isEditing && (
                        <div className="flex gap-2 mb-4">
                          <input
                            type="text"
                            value={newCondition}
                            onChange={(e) => setNewCondition(e.target.value)}
                            placeholder="Add a condition..."
                            list="conditions-list"
                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddItem('chronicConditions', newCondition, setNewCondition);
                              }
                            }}
                          />
                          <datalist id="conditions-list">
                            {COMMON_CONDITIONS.map((c) => <option key={c} value={c} />)}
                          </datalist>
                          <button
                            onClick={() => handleAddItem('chronicConditions', newCondition, setNewCondition)}
                            className="px-4 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"
                          >
                            <PlusIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(formData.chronicConditions || []).length === 0 ? (
                          <p className="text-gray-500 italic">No chronic conditions recorded</p>
                        ) : (
                          formData.chronicConditions?.map((condition, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-100 text-rose-800"
                            >
                              {condition}
                              {isEditing && (
                                <button
                                  onClick={() => handleRemoveItem('chronicConditions', condition)}
                                  className="text-rose-600 hover:text-rose-800"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Past Surgeries - now structured with modal */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Past Surgeries</h3>
                        <button
                          onClick={() => {
                            resetSurgeryForm();
                            setEditingSurgery(null);
                            setShowSurgeryModal(true);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 shadow text-sm"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Surgery
                        </button>
                      </div>
                      {loadingSurgeries ? (
                        <div className="text-center py-6">
                          <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto text-rose-500" />
                        </div>
                      ) : pastSurgeries.length === 0 ? (
                        <p className="text-gray-500 italic text-center py-4 bg-gray-50 rounded-xl">No past surgeries recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {pastSurgeries.map((surgery) => (
                            <div key={surgery.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">{surgery.surgeryName}</h4>
                                    {surgery.verificationStatus && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        surgery.verificationStatus === 'NURSE_VERIFIED' || surgery.verificationStatus === 'DOCTOR_VALIDATED'
                                          ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {surgery.verificationStatus === 'PATIENT_REPORTED' ? 'Self-reported' :
                                         surgery.verificationStatus === 'NURSE_VERIFIED' ? 'Verified' : 'Validated'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-600 mt-2">
                                    <span>Date: {formatDisplayDate(surgery.surgeryDate)}</span>
                                    <span>Hospital: {surgery.hospitalName}</span>
                                    {surgery.hospitalLocation && <span>Location: {surgery.hospitalLocation}</span>}
                                    {surgery.surgeonName && <span>Surgeon: {surgery.surgeonName}</span>}
                                    {surgery.complications && <span>Complications: {surgery.complications}</span>}
                                    {surgery.outcome && <span>Outcome: {surgery.outcome}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() => openEditSurgery(surgery)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('Are you sure you want to remove this surgery record?')) {
                                        deleteSurgeryMutation.mutate(surgery.id);
                                      }
                                    }}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ongoing Treatment */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Ongoing Treatment</h3>
                      <p className="text-sm text-gray-500 mb-3">
                        Record any ongoing treatments such as chemotherapy, dialysis, physical therapy, etc.
                      </p>
                      {isEditing ? (
                        <textarea
                          value={formData.currentTreatment || ''}
                          onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, currentTreatment: v })); }}
                          placeholder="e.g., Chemotherapy every 2 weeks, Dialysis 3x/week, Physical therapy sessions..."
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                          rows={3}
                        />
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-xl">
                          {formData.currentTreatment ? (
                            <p className="text-gray-800">{formData.currentTreatment}</p>
                          ) : (
                            <p className="text-gray-500 italic">No ongoing treatment recorded</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pregnancy Status - Only show for females aged 18-55 */}
                    {shouldShowPregnancy && (
                      <div className="p-5 bg-pink-50 border border-pink-200 rounded-xl">
                        <h3 className="text-lg font-semibold text-pink-900 mb-4">Pregnancy Status</h3>
                        <p className="text-sm text-pink-700 mb-4">
                          This information helps healthcare providers make safer treatment decisions.
                        </p>
                        {isEditing ? (
                          <>
                            <div className="flex gap-4 mb-4">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  checked={formData.isPregnant === true}
                                  onChange={() => setFormData(prev => ({ ...prev, isPregnant: true }))}
                                  className="w-4 h-4 text-pink-600 border-gray-300 focus:ring-pink-500"
                                />
                                <span className="ml-2 text-gray-700">Yes, I am pregnant</span>
                              </label>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  checked={formData.isPregnant === false}
                                  onChange={() => setFormData(prev => ({ ...prev, isPregnant: false, expectedDueDate: null }))}
                                  className="w-4 h-4 text-pink-600 border-gray-300 focus:ring-pink-500"
                                />
                                <span className="ml-2 text-gray-700">No</span>
                              </label>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  checked={formData.isPregnant === null || formData.isPregnant === undefined}
                                  onChange={() => setFormData(prev => ({ ...prev, isPregnant: null, expectedDueDate: null }))}
                                  className="w-4 h-4 text-pink-600 border-gray-300 focus:ring-pink-500"
                                />
                                <span className="ml-2 text-gray-700">Not specified</span>
                              </label>
                            </div>
                            {formData.isPregnant === true && (
                              <div>
                                <label className="block text-sm font-medium text-pink-800 mb-2">
                                  Expected Due Date
                                </label>
                                <input
                                  type="date"
                                  value={formData.expectedDueDate || ''}
                                  onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, expectedDueDate: v })); }}
                                  className="px-4 py-2 rounded-xl border border-pink-300 focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-3 bg-white rounded-lg">
                            {formData.isPregnant === true ? (
                              <div className="flex items-center gap-2 text-pink-800">
                                <span className="font-medium">Currently Pregnant</span>
                                {formData.expectedDueDate && (
                                  <span className="text-sm text-pink-600 ml-2">
                                    (Due: {new Date(formData.expectedDueDate).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                            ) : formData.isPregnant === false ? (
                              <p className="text-gray-600">Not pregnant</p>
                            ) : (
                              <p className="text-gray-500 italic">Not specified</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Tab.Panel>

            {/* Allergies Tab */}
            <Tab.Panel>
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Allergies</h2>
                  <button
                    onClick={() => {
                      resetAllergyForm();
                      setEditingAllergy(null);
                      setShowAllergyModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 shadow"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Add Allergy
                  </button>
                </div>

                {loadingAllergies ? (
                  <div className="text-center py-12">
                    <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-rose-500" />
                    <p className="mt-2 text-gray-500">Loading allergies...</p>
                  </div>
                ) : allergies.length === 0 ? (
                  <div className="text-center py-12">
                    <ShieldExclamationIcon className="h-12 w-12 text-gray-300 mx-auto" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">No Allergies Recorded</h3>
                    <p className="mt-2 text-gray-500">
                      Add any allergies you have to help healthcare providers give you safer care.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allergies.map((allergy) => {
                      const severityInfo = SEVERITY_LEVELS.find((s) => s.value === allergy.severity);
                      const typeInfo = ALLERGY_TYPES.find((t) => t.value === allergy.type);
                      return (
                        <div
                          key={allergy.id}
                          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{allergy.allergen}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                  {typeInfo?.label || allergy.type}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${severityInfo?.color}`}>
                                  {severityInfo?.label || allergy.severity}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditAllergy(allergy)}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to remove this allergy?')) {
                                    deleteAllergyMutation.mutate(allergy.id);
                                  }
                                }}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {allergy.reaction && (
                            <p className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">Reaction:</span> {allergy.reaction}
                            </p>
                          )}
                          {allergy.notes && (
                            <p className="mt-1 text-sm text-gray-500">{allergy.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Important Notice */}
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <InformationCircleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800">Important</h4>
                      <p className="text-sm text-amber-700 mt-1">
                        Keep your allergy information up to date. This helps healthcare providers avoid prescribing
                        medications or treatments that could cause adverse reactions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Tab.Panel>

            {/* Medications & Immunizations Tab */}
            <Tab.Panel>
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
                <div className="space-y-8">
                  {/* Current Medications */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-900">Current Medications</h2>
                      {!isEditing ? (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 text-sm"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                          Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveHistory}
                            disabled={updateHistoryMutation.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 text-sm"
                          >
                            {updateHistoryMutation.isPending ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4" />
                            )}
                            Save
                          </button>
                        </div>
                      )}
                    </div>

                    {loadingHistory ? (
                      <div className="text-center py-8">
                        <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto text-rose-500" />
                      </div>
                    ) : (
                      <>
                        {isEditing && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-500 mb-3">Add medications with name, dosage, and frequency (matching nurse portal format).</p>
                            <div className="flex gap-2 items-end flex-wrap">
                              <div className="flex-1 min-w-[140px]">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Medication Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g., Metformin"
                                  value={newMedication.name}
                                  onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-500"
                                  onKeyDown={(e) => { if (e.key === 'Enter') addMedication(); }}
                                />
                              </div>
                              <div className="w-24">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
                                <input
                                  type="text"
                                  placeholder="500mg"
                                  value={newMedication.dosage}
                                  onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-500"
                                  onKeyDown={(e) => { if (e.key === 'Enter') addMedication(); }}
                                />
                              </div>
                              <div className="w-28">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                                <input
                                  type="text"
                                  placeholder="Twice daily"
                                  value={newMedication.frequency}
                                  onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-500"
                                  onKeyDown={(e) => { if (e.key === 'Enter') addMedication(); }}
                                />
                              </div>
                              <button
                                onClick={addMedication}
                                disabled={!newMedication.name.trim()}
                                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
                              >
                                <PlusIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {(formData.currentMedications || []).length === 0 ? (
                            <p className="text-gray-500 italic">No current medications recorded</p>
                          ) : (
                            formData.currentMedications?.map((medication, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 text-green-800"
                              >
                                {medication}
                                {isEditing && (
                                  <button
                                    onClick={() => handleRemoveItem('currentMedications', medication)}
                                    className="text-green-600 hover:text-green-800"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </span>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200" />

                  {/* Immunization Records - structured with modal (matching nurse portal) */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-900">Immunization Records</h2>
                      <button
                        onClick={() => {
                          resetImmunizationForm();
                          setEditingImmunization(null);
                          setShowImmunizationModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 shadow text-sm"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Vaccine
                      </button>
                    </div>

                    {loadingImmunizations ? (
                      <div className="text-center py-8">
                        <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto text-rose-500" />
                      </div>
                    ) : immunizations.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <ShieldExclamationIcon className="h-10 w-10 text-gray-300 mx-auto" />
                        <p className="mt-2 text-gray-500">No immunizations recorded</p>
                        <p className="text-sm text-gray-400 mt-1">Add your vaccination history to keep your records complete.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {immunizations.map((imm) => (
                          <div key={imm.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{imm.vaccineName}</h4>
                                  {imm.vaccineType && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                      {imm.vaccineType}
                                    </span>
                                  )}
                                  {imm.doseNumber && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                      Dose {imm.doseNumber}
                                    </span>
                                  )}
                                  {imm.verificationStatus && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      imm.verificationStatus === 'NURSE_VERIFIED' || imm.verificationStatus === 'DOCTOR_VALIDATED'
                                        ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {imm.verificationStatus === 'PATIENT_REPORTED' ? 'Self-reported' :
                                       imm.verificationStatus === 'NURSE_VERIFIED' ? 'Verified' : 'Validated'}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-600 mt-2">
                                  <span>Date: {formatDisplayDate(imm.dateAdministered)}</span>
                                  {imm.administeredBy && <span>Provider: {imm.administeredBy}</span>}
                                  {imm.lotNumber && <span>Lot #: {imm.lotNumber}</span>}
                                  {imm.nextDueDate && (
                                    <span className="text-blue-600 font-medium">
                                      Next due: {formatDisplayDate(imm.nextDueDate)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  onClick={() => openEditImmunization(imm)}
                                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                >
                                  <PencilSquareIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Are you sure you want to remove this immunization record?')) {
                                      deleteImmunizationMutation.mutate(imm.id);
                                    }
                                  }}
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Tab.Panel>

            {/* Family History Tab */}
            <Tab.Panel>
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Family Medical History</h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveHistory}
                        disabled={updateHistoryMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                      >
                        {updateHistoryMutation.isPending ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <CheckCircleIcon className="h-5 w-5" />
                        )}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-gray-600 mb-4">
                  Record any significant medical conditions that run in your family.
                  This helps doctors understand your health risks.
                </p>

                {loadingHistory ? (
                  <div className="text-center py-12">
                    <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-rose-500" />
                  </div>
                ) : (
                  <div>
                    {isEditing && (
                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          value={newFamilyHistory}
                          onChange={(e) => setNewFamilyHistory(e.target.value)}
                          placeholder="e.g., Father - Heart Disease, Mother - Diabetes"
                          className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddItem('familyHistory', newFamilyHistory, setNewFamilyHistory);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleAddItem('familyHistory', newFamilyHistory, setNewFamilyHistory)}
                          className="px-4 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"
                        >
                          <PlusIcon className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                    <div className="space-y-2">
                      {(formData.familyHistory || []).length === 0 ? (
                        <p className="text-gray-500 italic">No family history recorded</p>
                      ) : (
                        formData.familyHistory?.map((history, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                          >
                            <span className="text-gray-800">{history}</span>
                            {isEditing && (
                              <button
                                onClick={() => handleRemoveItem('familyHistory', history)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>

      {/* Add/Edit Allergy Modal */}
      <Transition appear show={showAllergyModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAllergyModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-xl font-bold text-gray-900 mb-4">
                    {editingAllergy ? 'Edit Allergy' : 'Add New Allergy'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Allergen <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={allergyForm.allergen}
                        onChange={(e) => setAllergyForm({ ...allergyForm, allergen: e.target.value })}
                        placeholder="e.g., Penicillin, Peanuts"
                        list="allergen-suggestions"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                      <datalist id="allergen-suggestions">
                        {COMMON_ALLERGIES[allergyForm.type as keyof typeof COMMON_ALLERGIES]?.map((a) => (
                          <option key={a} value={a} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={allergyForm.type}
                        onChange={(e) => setAllergyForm({ ...allergyForm, type: e.target.value as any })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      >
                        {ALLERGY_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Severity <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={allergyForm.severity}
                        onChange={(e) => setAllergyForm({ ...allergyForm, severity: e.target.value as any })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      >
                        {SEVERITY_LEVELS.map((level) => (
                          <option key={level.value} value={level.value}>{level.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reaction</label>
                      <input
                        type="text"
                        value={allergyForm.reaction}
                        onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
                        placeholder="e.g., Skin rash, difficulty breathing"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={allergyForm.notes}
                        onChange={(e) => setAllergyForm({ ...allergyForm, notes: e.target.value })}
                        placeholder="Any additional notes..."
                        rows={2}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setShowAllergyModal(false)}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAllergy}
                      disabled={addAllergyMutation.isPending || updateAllergyMutation.isPending}
                      className="flex-1 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                    >
                      {(addAllergyMutation.isPending || updateAllergyMutation.isPending) ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Add/Edit Immunization Modal - matches nurse portal fields exactly */}
      <Transition appear show={showImmunizationModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowImmunizationModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-xl font-bold text-gray-900 mb-4">
                    {editingImmunization ? 'Edit Immunization' : 'Add Immunization Record'}
                  </Dialog.Title>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vaccine Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={immunizationForm.vaccineName}
                        onChange={(e) => setImmunizationForm({ ...immunizationForm, vaccineName: e.target.value })}
                        placeholder="e.g., COVID-19, MMR, Hepatitis B"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Brand/Type</label>
                      <input
                        type="text"
                        value={immunizationForm.vaccineType}
                        onChange={(e) => setImmunizationForm({ ...immunizationForm, vaccineType: e.target.value })}
                        placeholder="e.g., Pfizer-BioNTech"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date Administered <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={immunizationForm.dateAdministered}
                        onChange={(e) => setImmunizationForm({ ...immunizationForm, dateAdministered: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dose Number</label>
                      <input
                        type="number"
                        value={immunizationForm.doseNumber}
                        onChange={(e) => setImmunizationForm({ ...immunizationForm, doseNumber: e.target.value })}
                        placeholder="1, 2, 3..."
                        min="1"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Healthcare Provider/Clinic</label>
                      <input
                        type="text"
                        value={immunizationForm.administeredBy}
                        onChange={(e) => setImmunizationForm({ ...immunizationForm, administeredBy: e.target.value })}
                        placeholder="e.g., City Health Clinic"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
                      <input
                        type="text"
                        value={immunizationForm.lotNumber}
                        onChange={(e) => setImmunizationForm({ ...immunizationForm, lotNumber: e.target.value })}
                        placeholder="For tracking"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
                      <input
                        type="date"
                        value={immunizationForm.nextDueDate}
                        onChange={(e) => setImmunizationForm({ ...immunizationForm, nextDueDate: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setShowImmunizationModal(false)}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveImmunization}
                      disabled={addImmunizationMutation.isPending || updateImmunizationMutation.isPending}
                      className="flex-1 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                    >
                      {(addImmunizationMutation.isPending || updateImmunizationMutation.isPending) ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Add/Edit Past Surgery Modal - matches nurse portal fields exactly */}
      <Transition appear show={showSurgeryModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowSurgeryModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-xl font-bold text-gray-900 mb-4">
                    {editingSurgery ? 'Edit Past Surgery' : 'Add Past Surgery'}
                  </Dialog.Title>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Surgery Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={surgeryForm.surgeryName}
                        onChange={(e) => setSurgeryForm({ ...surgeryForm, surgeryName: e.target.value })}
                        placeholder="e.g., Appendectomy, Cesarean Section"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={surgeryForm.surgeryDate}
                        onChange={(e) => setSurgeryForm({ ...surgeryForm, surgeryDate: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hospital Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={surgeryForm.hospitalName}
                        onChange={(e) => setSurgeryForm({ ...surgeryForm, hospitalName: e.target.value })}
                        placeholder="Hospital name"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location (City/Country)</label>
                      <input
                        type="text"
                        value={surgeryForm.hospitalLocation}
                        onChange={(e) => setSurgeryForm({ ...surgeryForm, hospitalLocation: e.target.value })}
                        placeholder="e.g., Dubai, UAE"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon Name</label>
                      <input
                        type="text"
                        value={surgeryForm.surgeonName}
                        onChange={(e) => setSurgeryForm({ ...surgeryForm, surgeonName: e.target.value })}
                        placeholder="Dr. name"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Complications / Outcome</label>
                      <input
                        type="text"
                        value={surgeryForm.complications}
                        onChange={(e) => setSurgeryForm({ ...surgeryForm, complications: e.target.value })}
                        placeholder="e.g., Successful, no complications"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setShowSurgeryModal(false)}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSurgery}
                      disabled={addSurgeryMutation.isPending || updateSurgeryMutation.isPending}
                      className="flex-1 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                    >
                      {(addSurgeryMutation.isPending || updateSurgeryMutation.isPending) ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
