import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { MedicalHistory } from './types';
import { COMMON_CONDITIONS } from './constants';

export default function HealthProfileTab() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
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

  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const [newCondition, setNewCondition] = useState('');
  const [newFamilyHistory, setNewFamilyHistory] = useState('');
  const [newMedication, setNewMedication] = useState({ name: '', dosage: '', frequency: '' });

  // Patient profile for gender/age check
  const [patientProfile, setPatientProfile] = useState<{
    gender?: string;
    dateOfBirth?: string;
  } | null>(null);

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

  useQuery({
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

  const patientAge = calculateAge(patientProfile?.dateOfBirth);
  const shouldShowPregnancy =
    patientProfile?.gender?.toUpperCase() === 'FEMALE' &&
    patientAge !== null &&
    patientAge >= 18 &&
    patientAge <= 55;

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['patient-medical-history'],
    queryFn: async () => {
      const response = await patientPortalApi.getMedicalHistory();
      return response.data?.data || response.data;
    },
  });

  const [initialLoadDone, setInitialLoadDone] = useState(false);

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
      const newData = { ...currentFormData, [field]: [...currentItems, value.trim()] };
      formDataRef.current = newData;
      setFormData(newData);
    }
    setter('');
  };

  const handleRemoveItem = (field: keyof MedicalHistory, value: string) => {
    const currentFormData = { ...formDataRef.current };
    const currentItems = (currentFormData[field] as string[]) || [];
    const newData = { ...currentFormData, [field]: currentItems.filter((item) => item !== value) };
    formDataRef.current = newData;
    setFormData(newData);
  };

  const handleSaveHistory = () => {
    updateHistoryMutation.mutate(formDataRef.current);
  };

  const addMedication = () => {
    if (!newMedication.name.trim()) return;
    const medString = [
      newMedication.name.trim(),
      newMedication.dosage.trim(),
      newMedication.frequency.trim() ? `(${newMedication.frequency.trim()})` : '',
    ].filter(Boolean).join(' ');

    const currentFormData = { ...formDataRef.current };
    const currentMeds = (currentFormData.currentMedications as string[]) || [];
    const newData = { ...currentFormData, currentMedications: [...currentMeds, medString] };
    formDataRef.current = newData;
    setFormData(newData);
    setNewMedication({ name: '', dosage: '', frequency: '' });
  };

  const editButton = !isEditing ? (
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
  );

  return (
    <div className="space-y-6">
      {/* Chronic Conditions */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Chronic Conditions & Ongoing Treatment</h2>
          {editButton}
        </div>

        {isLoading ? (
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

            {/* Pregnancy Status */}
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

      {/* Current Medications */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Current Medications</h2>
        </div>

        {isLoading ? (
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

      {/* Family History */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Family Medical History</h2>
        </div>

        <p className="text-gray-600 mb-4">
          Record any significant medical conditions that run in your family.
          This helps doctors understand your health risks.
        </p>

        {isLoading ? (
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
    </div>
  );
}
