import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { PastSurgeryRecord } from './types';
import { formatDate } from './constants';

interface SurgeryModalProps {
  show: boolean;
  onClose: () => void;
  editingSurgery: PastSurgeryRecord | null;
}

export default function SurgeryModal({ show, onClose, editingSurgery }: SurgeryModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
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

  useEffect(() => {
    if (editingSurgery) {
      setForm({
        surgeryName: editingSurgery.surgeryName || '',
        surgeryDate: formatDate(editingSurgery.surgeryDate),
        hospitalName: editingSurgery.hospitalName || '',
        hospitalLocation: editingSurgery.hospitalLocation || '',
        surgeonName: editingSurgery.surgeonName || '',
        indication: editingSurgery.indication || '',
        complications: editingSurgery.complications || '',
        outcome: editingSurgery.outcome || '',
        notes: editingSurgery.notes || '',
      });
    } else {
      setForm({
        surgeryName: '', surgeryDate: '', hospitalName: '', hospitalLocation: '',
        surgeonName: '', indication: '', complications: '', outcome: '', notes: '',
      });
    }
  }, [editingSurgery, show]);

  const addMutation = useMutation({
    mutationFn: (data: any) => patientPortalApi.addPastSurgery(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-past-surgeries'] });
      toast.success('Past surgery added successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add past surgery');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      patientPortalApi.updatePastSurgery(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-past-surgeries'] });
      toast.success('Past surgery updated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update past surgery');
    },
  });

  const handleSave = () => {
    if (!form.surgeryName.trim()) {
      toast.error('Surgery name is required');
      return;
    }
    if (!form.surgeryDate) {
      toast.error('Surgery date is required');
      return;
    }
    if (!form.hospitalName.trim()) {
      toast.error('Hospital name is required');
      return;
    }
    const data = {
      surgeryName: form.surgeryName,
      surgeryDate: form.surgeryDate,
      hospitalName: form.hospitalName,
      hospitalLocation: form.hospitalLocation || undefined,
      surgeonName: form.surgeonName || undefined,
      indication: form.indication || undefined,
      complications: form.complications || undefined,
      outcome: form.outcome || undefined,
      notes: form.notes || undefined,
    };
    if (editingSurgery) {
      updateMutation.mutate({ id: editingSurgery.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  return (
    <Transition appear show={show} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
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
                      value={form.surgeryName}
                      onChange={(e) => setForm({ ...form, surgeryName: e.target.value })}
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
                      value={form.surgeryDate}
                      onChange={(e) => setForm({ ...form, surgeryDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hospital Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.hospitalName}
                      onChange={(e) => setForm({ ...form, hospitalName: e.target.value })}
                      placeholder="Hospital name"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location (City/Country)</label>
                    <input
                      type="text"
                      value={form.hospitalLocation}
                      onChange={(e) => setForm({ ...form, hospitalLocation: e.target.value })}
                      placeholder="e.g., Dubai, UAE"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon Name</label>
                    <input
                      type="text"
                      value={form.surgeonName}
                      onChange={(e) => setForm({ ...form, surgeonName: e.target.value })}
                      placeholder="Dr. name"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Complications / Outcome</label>
                    <input
                      type="text"
                      value={form.complications}
                      onChange={(e) => setForm({ ...form, complications: e.target.value })}
                      placeholder="e.g., Successful, no complications"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={addMutation.isPending || updateMutation.isPending}
                    className="flex-1 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                  >
                    {(addMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
