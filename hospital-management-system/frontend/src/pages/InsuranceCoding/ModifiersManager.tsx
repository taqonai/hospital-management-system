import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { insuranceCodingApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface CPTModifier {
  id: string;
  code: string;
  description: string;
  priceImpact?: number;
  isActive: boolean;
  notes?: string;
}

interface ModifierFormData {
  code: string;
  description: string;
  priceImpact?: number;
  isActive: boolean;
  notes?: string;
}

const defaultFormData: ModifierFormData = {
  code: '',
  description: '',
  priceImpact: undefined,
  isActive: true,
  notes: '',
};

export default function ModifiersManager() {
  const queryClient = useQueryClient();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingModifier, setEditingModifier] = useState<CPTModifier | null>(null);
  const [formData, setFormData] = useState<ModifierFormData>(defaultFormData);

  // Fetch modifiers
  const { data: modifiersData, isLoading, refetch } = useQuery({
    queryKey: ['cpt-modifiers'],
    queryFn: () => insuranceCodingApi.getModifiers().then(r => r.data),
  });

  const modifiers: CPTModifier[] = modifiersData?.data || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: ModifierFormData) => insuranceCodingApi.createModifier(data),
    onSuccess: () => {
      toast.success('Modifier created successfully');
      queryClient.invalidateQueries({ queryKey: ['cpt-modifiers'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create modifier');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ModifierFormData> }) =>
      insuranceCodingApi.updateModifier(id, data),
    onSuccess: () => {
      toast.success('Modifier updated successfully');
      queryClient.invalidateQueries({ queryKey: ['cpt-modifiers'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update modifier');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => insuranceCodingApi.deleteModifier(id),
    onSuccess: () => {
      toast.success('Modifier deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['cpt-modifiers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete modifier');
    },
  });

  const openCreateModal = () => {
    setEditingModifier(null);
    setFormData(defaultFormData);
    setShowModal(true);
  };

  const openEditModal = (modifier: CPTModifier) => {
    setEditingModifier(modifier);
    setFormData({
      code: modifier.code,
      description: modifier.description,
      priceImpact: modifier.priceImpact ? Number(modifier.priceImpact) : undefined,
      isActive: modifier.isActive,
      notes: modifier.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingModifier(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingModifier) {
      updateMutation.mutate({ id: editingModifier.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (modifier: CPTModifier) => {
    if (confirm(`Are you sure you want to delete modifier ${modifier.code}?`)) {
      deleteMutation.mutate(modifier.id);
    }
  };

  const formatPriceImpact = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    const percentage = (Number(value) * 100).toFixed(0);
    return `${percentage}%`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            CPT modifiers adjust the meaning of a procedure code, often affecting reimbursement.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Add Modifier
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Code</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Description</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Price Impact</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : modifiers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No modifiers found
                </td>
              </tr>
            ) : (
              modifiers.map((modifier) => (
                <tr key={modifier.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-gray-900 dark:text-white text-lg">
                      {modifier.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900 dark:text-white">
                      {modifier.description}
                    </div>
                    {modifier.notes && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {modifier.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'px-2 py-1 text-sm rounded font-mono',
                      modifier.priceImpact !== undefined && modifier.priceImpact !== null
                        ? Number(modifier.priceImpact) < 1
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : Number(modifier.priceImpact) > 1
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500'
                    )}>
                      {formatPriceImpact(modifier.priceImpact ? Number(modifier.priceImpact) : undefined)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'px-2 py-1 text-xs rounded-full',
                      modifier.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      {modifier.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(modifier)}
                        className="p-1 text-gray-400 hover:text-primary-500"
                      >
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(modifier)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Common Modifiers Info */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Common Modifiers Reference</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-200">25</span>
            <span className="text-blue-700 dark:text-blue-400 ml-2">Significant, separately identifiable E&M</span>
          </div>
          <div>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-200">26</span>
            <span className="text-blue-700 dark:text-blue-400 ml-2">Professional component only</span>
          </div>
          <div>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-200">TC</span>
            <span className="text-blue-700 dark:text-blue-400 ml-2">Technical component only</span>
          </div>
          <div>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-200">59</span>
            <span className="text-blue-700 dark:text-blue-400 ml-2">Distinct procedural service</span>
          </div>
          <div>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-200">50</span>
            <span className="text-blue-700 dark:text-blue-400 ml-2">Bilateral procedure</span>
          </div>
          <div>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-200">51</span>
            <span className="text-blue-700 dark:text-blue-400 ml-2">Multiple procedures</span>
          </div>
          <div>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-200">LT/RT</span>
            <span className="text-blue-700 dark:text-blue-400 ml-2">Left/Right side</span>
          </div>
          <div>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-200">76</span>
            <span className="text-blue-700 dark:text-blue-400 ml-2">Repeat procedure same physician</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingModifier ? 'Edit Modifier' : 'Add Modifier'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-1 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono"
                    placeholder="e.g., 25, TC, LT"
                    maxLength={5}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    placeholder="Description of what this modifier indicates"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price Impact (Multiplier)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.01"
                      value={formData.priceImpact || ''}
                      onChange={(e) => setFormData({ ...formData, priceImpact: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., 0.50 for 50%, 1.50 for 150%"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formData.priceImpact ? `${(formData.priceImpact * 100).toFixed(0)}%` : '100%'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    1.0 = 100% (no change), 0.5 = 50%, 1.5 = 150%
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    Active
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    placeholder="Additional notes"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    )}
                    {editingModifier ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
