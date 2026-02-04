import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { Allergy } from './types';
import { ALLERGY_TYPES, SEVERITY_LEVELS, COMMON_ALLERGIES } from './constants';

interface AllergyModalProps {
  show: boolean;
  onClose: () => void;
  editingAllergy: Allergy | null;
}

export default function AllergyModal({ show, onClose, editingAllergy }: AllergyModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    allergen: '',
    type: 'DRUG' as 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER',
    severity: 'MILD' as 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING',
    reaction: '',
    notes: '',
  });

  useEffect(() => {
    if (editingAllergy) {
      setForm({
        allergen: editingAllergy.allergen,
        type: editingAllergy.type,
        severity: editingAllergy.severity,
        reaction: editingAllergy.reaction || '',
        notes: editingAllergy.notes || '',
      });
    } else {
      setForm({ allergen: '', type: 'DRUG', severity: 'MILD', reaction: '', notes: '' });
    }
  }, [editingAllergy, show]);

  const addMutation = useMutation({
    mutationFn: (data: any) => patientPortalApi.addAllergy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-allergies'] });
      toast.success('Allergy added successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add allergy');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      patientPortalApi.updateAllergy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-allergies'] });
      toast.success('Allergy updated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update allergy');
    },
  });

  const handleSave = () => {
    if (!form.allergen.trim()) {
      toast.error('Allergen name is required');
      return;
    }
    if (editingAllergy) {
      updateMutation.mutate({ id: editingAllergy.id, data: form });
    } else {
      addMutation.mutate(form);
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
                      value={form.allergen}
                      onChange={(e) => setForm({ ...form, allergen: e.target.value })}
                      placeholder="e.g., Penicillin, Peanuts"
                      list="allergen-suggestions"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                    <datalist id="allergen-suggestions">
                      {COMMON_ALLERGIES[form.type as keyof typeof COMMON_ALLERGIES]?.map((a) => (
                        <option key={a} value={a} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as any })}
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
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value as any })}
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
                      value={form.reaction}
                      onChange={(e) => setForm({ ...form, reaction: e.target.value })}
                      placeholder="e.g., Skin rash, difficulty breathing"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Any additional notes..."
                      rows={2}
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
