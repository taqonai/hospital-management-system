import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { PastSurgeryRecord } from './types';
import { formatDisplayDate } from './constants';
import SurgeryModal from './SurgeryModal';

export default function PastSurgeriesTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState<PastSurgeryRecord | null>(null);

  const { data: surgeriesData, isLoading } = useQuery({
    queryKey: ['patient-past-surgeries'],
    queryFn: async () => {
      const response = await patientPortalApi.getPastSurgeries();
      return response.data?.data || response.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientPortalApi.deletePastSurgery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-past-surgeries'] });
      toast.success('Past surgery removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove past surgery');
    },
  });

  const pastSurgeries: PastSurgeryRecord[] = surgeriesData || [];

  const openAdd = () => {
    setEditingSurgery(null);
    setShowModal(true);
  };

  const openEdit = (surgery: PastSurgeryRecord) => {
    setEditingSurgery(surgery);
    setShowModal(true);
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Past Surgeries</h2>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 shadow text-sm"
        >
          <PlusIcon className="h-4 w-4" />
          Add Surgery
        </button>
      </div>

      {isLoading ? (
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
                    onClick={() => openEdit(surgery)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this surgery record?')) {
                        deleteMutation.mutate(surgery.id);
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
      <SurgeryModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditingSurgery(null); }}
        editingSurgery={editingSurgery}
      />
    </div>
  );
}
