import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ShieldExclamationIcon,
  InformationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { Allergy } from './types';
import { ALLERGY_TYPES, SEVERITY_LEVELS } from './constants';
import AllergyModal from './AllergyModal';

export default function AllergiesTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);

  const { data: allergiesData, isLoading } = useQuery({
    queryKey: ['patient-allergies'],
    queryFn: async () => {
      const response = await patientPortalApi.getAllergies();
      return response.data?.data || response.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientPortalApi.deleteAllergy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-allergies'] });
      toast.success('Allergy removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove allergy');
    },
  });

  const allergies: Allergy[] = allergiesData || [];

  const openAdd = () => {
    setEditingAllergy(null);
    setShowModal(true);
  };

  const openEdit = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setShowModal(true);
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Allergies</h2>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 shadow"
        >
          <PlusIcon className="h-5 w-5" />
          Add Allergy
        </button>
      </div>

      {isLoading ? (
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
                      onClick={() => openEdit(allergy)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this allergy?')) {
                          deleteMutation.mutate(allergy.id);
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

      {/* Modal */}
      <AllergyModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditingAllergy(null); }}
        editingAllergy={editingAllergy}
      />
    </div>
  );
}
