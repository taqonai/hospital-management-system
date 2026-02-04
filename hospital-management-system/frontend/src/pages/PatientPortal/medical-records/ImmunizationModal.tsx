import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { ImmunizationRecord } from './types';
import { formatDate } from './constants';

interface ImmunizationModalProps {
  show: boolean;
  onClose: () => void;
  editingImmunization: ImmunizationRecord | null;
}

export default function ImmunizationModal({ show, onClose, editingImmunization }: ImmunizationModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    vaccineName: '',
    vaccineType: '',
    doseNumber: '',
    dateAdministered: '',
    administeredBy: '',
    lotNumber: '',
    nextDueDate: '',
    notes: '',
  });

  useEffect(() => {
    if (editingImmunization) {
      setForm({
        vaccineName: editingImmunization.vaccineName || '',
        vaccineType: editingImmunization.vaccineType || '',
        doseNumber: editingImmunization.doseNumber ? String(editingImmunization.doseNumber) : '',
        dateAdministered: formatDate(editingImmunization.dateAdministered),
        administeredBy: editingImmunization.administeredBy || '',
        lotNumber: editingImmunization.lotNumber || '',
        nextDueDate: formatDate(editingImmunization.nextDueDate),
        notes: editingImmunization.notes || '',
      });
    } else {
      setForm({
        vaccineName: '', vaccineType: '', doseNumber: '', dateAdministered: '',
        administeredBy: '', lotNumber: '', nextDueDate: '', notes: '',
      });
    }
  }, [editingImmunization, show]);

  const addMutation = useMutation({
    mutationFn: (data: any) => patientPortalApi.addImmunization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-immunizations'] });
      toast.success('Immunization added successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add immunization');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      patientPortalApi.updateImmunization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-immunizations'] });
      toast.success('Immunization updated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update immunization');
    },
  });

  const handleSave = () => {
    if (!form.vaccineName.trim()) {
      toast.error('Vaccine name is required');
      return;
    }
    if (!form.dateAdministered) {
      toast.error('Date administered is required');
      return;
    }
    const data = {
      vaccineName: form.vaccineName,
      vaccineType: form.vaccineType || undefined,
      doseNumber: form.doseNumber ? parseInt(form.doseNumber) : undefined,
      dateAdministered: form.dateAdministered,
      administeredBy: form.administeredBy || undefined,
      lotNumber: form.lotNumber || undefined,
      nextDueDate: form.nextDueDate || undefined,
      notes: form.notes || undefined,
    };
    if (editingImmunization) {
      updateMutation.mutate({ id: editingImmunization.id, data });
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
                  {editingImmunization ? 'Edit Immunization' : 'Add Immunization Record'}
                </Dialog.Title>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vaccine Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.vaccineName}
                      onChange={(e) => setForm({ ...form, vaccineName: e.target.value })}
                      placeholder="e.g., COVID-19, MMR, Hepatitis B"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand/Type</label>
                    <input
                      type="text"
                      value={form.vaccineType}
                      onChange={(e) => setForm({ ...form, vaccineType: e.target.value })}
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
                      value={form.dateAdministered}
                      onChange={(e) => setForm({ ...form, dateAdministered: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dose Number</label>
                    <input
                      type="number"
                      value={form.doseNumber}
                      onChange={(e) => setForm({ ...form, doseNumber: e.target.value })}
                      placeholder="1, 2, 3..."
                      min="1"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Healthcare Provider/Clinic</label>
                    <input
                      type="text"
                      value={form.administeredBy}
                      onChange={(e) => setForm({ ...form, administeredBy: e.target.value })}
                      placeholder="e.g., City Health Clinic"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
                    <input
                      type="text"
                      value={form.lotNumber}
                      onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
                      placeholder="For tracking"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
                    <input
                      type="date"
                      value={form.nextDueDate}
                      onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
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
