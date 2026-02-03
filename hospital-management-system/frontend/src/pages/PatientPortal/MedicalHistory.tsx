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

const COMMON_SURGERIES = [
  'Appendectomy', 'Tonsillectomy', 'Cesarean Section', 'Knee Replacement',
  'Hip Replacement', 'Gallbladder Removal', 'Heart Bypass', 'Cataract Surgery',
  'Hernia Repair', 'Spinal Surgery'
];

const COMMON_ALLERGIES = {
  DRUG: ['Penicillin', 'Aspirin', 'Ibuprofen', 'Sulfa drugs', 'Codeine', 'Morphine'],
  FOOD: ['Peanuts', 'Tree nuts', 'Shellfish', 'Eggs', 'Milk', 'Wheat', 'Soy', 'Fish'],
  ENVIRONMENTAL: ['Pollen', 'Dust mites', 'Pet dander', 'Mold', 'Latex', 'Bee stings'],
};

export default function MedicalHistory() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

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
  const [newSurgery, setNewSurgery] = useState('');
  const [newFamilyHistory, setNewFamilyHistory] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [newImmunization, setNewImmunization] = useState('');

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

  // Track if initial data has been loaded
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Sync form data on initial load and after mutation refetch
  // This ensures display is always up to date with server data
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
      // Update formData directly from response to ensure immediate display
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
      // Invalidate and refetch to ensure cache is updated
      await queryClient.invalidateQueries({ queryKey: ['patient-medical-history'] });
      await queryClient.refetchQueries({ queryKey: ['patient-medical-history'] });
      toast.success('Medical history updated successfully');
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update medical history');
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

    // Get current data from ref (always most up-to-date)
    const currentFormData = { ...formDataRef.current };
    const currentItems = (currentFormData[field] as string[]) || [];

    if (!currentItems.includes(value.trim())) {
      const newData = {
        ...currentFormData,
        [field]: [...currentItems, value.trim()],
      };

      // Update ref FIRST (synchronous)
      formDataRef.current = newData;

      // Then update state for UI
      setFormData(newData);
    }

    setter('');
  };

  const handleRemoveItem = (field: keyof MedicalHistory, value: string) => {
    // Get current data from ref
    const currentFormData = { ...formDataRef.current };
    const currentItems = (currentFormData[field] as string[]) || [];

    const newData = {
      ...currentFormData,
      [field]: currentItems.filter((item) => item !== value),
    };

    // Update ref FIRST
    formDataRef.current = newData;

    // Then update state for UI
    setFormData(newData);
  };

  const handleSaveHistory = () => {
    updateHistoryMutation.mutate(formDataRef.current);
  };

  const handleSaveAllergy = () => {
    if (!allergyForm.allergen.trim()) {
      toast.error('Allergen name is required');
      return;
    }

    if (editingAllergy) {
      updateAllergyMutation.mutate({
        id: editingAllergy.id,
        data: allergyForm,
      });
    } else {
      addAllergyMutation.mutate(allergyForm);
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

  const allergies: Allergy[] = allergiesData || [];
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

            {/* Recommendations */}
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

            {/* Preventive Care */}
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
                  <h2 className="text-xl font-bold text-gray-900">Chronic Conditions & Past Surgeries</h2>
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

                    {/* Past Surgeries */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Past Surgeries</h3>
                      {isEditing && (
                        <div className="flex gap-2 mb-4">
                          <input
                            type="text"
                            value={newSurgery}
                            onChange={(e) => setNewSurgery(e.target.value)}
                            placeholder="Add a surgery..."
                            list="surgeries-list"
                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddItem('pastSurgeries', newSurgery, setNewSurgery);
                              }
                            }}
                          />
                          <datalist id="surgeries-list">
                            {COMMON_SURGERIES.map((s) => <option key={s} value={s} />)}
                          </datalist>
                          <button
                            onClick={() => handleAddItem('pastSurgeries', newSurgery, setNewSurgery)}
                            className="px-4 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"
                          >
                            <PlusIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(formData.pastSurgeries || []).length === 0 ? (
                          <p className="text-gray-500 italic">No past surgeries recorded</p>
                        ) : (
                          formData.pastSurgeries?.map((surgery, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800"
                            >
                              {surgery}
                              {isEditing && (
                                <button
                                  onClick={() => handleRemoveItem('pastSurgeries', surgery)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              )}
                            </span>
                          ))
                        )}
                      </div>
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
                                <span className="text-xl">🤰</span>
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
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Medications & Immunizations</h2>
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
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Current Medications */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Medications</h3>
                      {isEditing && (
                        <div className="flex gap-2 mb-4">
                          <input
                            type="text"
                            value={newMedication}
                            onChange={(e) => setNewMedication(e.target.value)}
                            placeholder="Add a medication (e.g., Metformin 500mg)"
                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddItem('currentMedications', newMedication, setNewMedication);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddItem('currentMedications', newMedication, setNewMedication)}
                            className="px-4 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"
                          >
                            <PlusIcon className="h-5 w-5" />
                          </button>
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
                    </div>

                    {/* Immunizations */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Immunizations</h3>
                      {isEditing && (
                        <div className="flex gap-2 mb-4">
                          <input
                            type="text"
                            value={newImmunization}
                            onChange={(e) => setNewImmunization(e.target.value)}
                            placeholder="Add an immunization (e.g., COVID-19 Vaccine 2023)"
                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddItem('immunizations', newImmunization, setNewImmunization);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddItem('immunizations', newImmunization, setNewImmunization)}
                            className="px-4 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"
                          >
                            <PlusIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(formData.immunizations || []).length === 0 ? (
                          <p className="text-gray-500 italic">No immunizations recorded</p>
                        ) : (
                          formData.immunizations?.map((immunization, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-800"
                            >
                              {immunization}
                              {isEditing && (
                                <button
                                  onClick={() => handleRemoveItem('immunizations', immunization)}
                                  className="text-purple-600 hover:text-purple-800"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
    </div>
  );
}
