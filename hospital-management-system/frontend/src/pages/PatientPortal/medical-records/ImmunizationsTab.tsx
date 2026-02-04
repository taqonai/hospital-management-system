import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { ImmunizationRecord } from './types';
import { formatDisplayDate } from './constants';
import ImmunizationModal from './ImmunizationModal';

export default function ImmunizationsTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingImmunization, setEditingImmunization] = useState<ImmunizationRecord | null>(null);

  const { data: immunizationsData, isLoading } = useQuery({
    queryKey: ['patient-immunizations'],
    queryFn: async () => {
      const response = await patientPortalApi.getImmunizations();
      return response.data?.data || response.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientPortalApi.deleteImmunization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-immunizations'] });
      toast.success('Immunization removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove immunization');
    },
  });

  const immunizations: ImmunizationRecord[] = immunizationsData || [];

  const openAdd = () => {
    setEditingImmunization(null);
    setShowModal(true);
  };

  const openEdit = (imm: ImmunizationRecord) => {
    setEditingImmunization(imm);
    setShowModal(true);
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Immunization Records</h2>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 shadow text-sm"
        >
          <PlusIcon className="h-4 w-4" />
          Add Vaccine
        </button>
      </div>

      {isLoading ? (
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
                    onClick={() => openEdit(imm)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this immunization record?')) {
                        deleteMutation.mutate(imm.id);
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

      {/* Modal */}
      <ImmunizationModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditingImmunization(null); }}
        editingImmunization={editingImmunization}
      />
    </div>
  );
}
