import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { insuranceCodingApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface CPTCode {
  id: string;
  code: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  basePrice: number;
  dhaPrice?: number;
  cashPrice?: number;
  requiresPreAuth: boolean;
  isActive: boolean;
  workRVU?: number;
  globalPeriod?: number;
  professionalComponent: boolean;
  technicalComponent: boolean;
  notes?: string;
}

interface CPTFormData {
  code: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  basePrice: number;
  dhaPrice?: number;
  cashPrice?: number;
  requiresPreAuth: boolean;
  isActive: boolean;
  workRVU?: number;
  globalPeriod?: number;
  professionalComponent: boolean;
  technicalComponent: boolean;
  notes?: string;
}

const defaultFormData: CPTFormData = {
  code: '',
  description: '',
  shortDescription: '',
  category: '',
  subcategory: '',
  basePrice: 0,
  dhaPrice: undefined,
  cashPrice: undefined,
  requiresPreAuth: false,
  isActive: true,
  workRVU: undefined,
  globalPeriod: undefined,
  professionalComponent: false,
  technicalComponent: false,
  notes: '',
};

export default function CPTManager() {
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showOnlyPreAuth, setShowOnlyPreAuth] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<CPTCode | null>(null);
  const [formData, setFormData] = useState<CPTFormData>(defaultFormData);

  // Fetch codes
  const { data: codesData, isLoading, refetch } = useQuery({
    queryKey: ['cpt-codes', { page, limit, searchTerm, selectedCategory, showOnlyPreAuth, showOnlyActive }],
    queryFn: () => insuranceCodingApi.getCPTCodes({
      page,
      limit,
      search: searchTerm || undefined,
      category: selectedCategory || undefined,
      requiresPreAuth: showOnlyPreAuth ? true : undefined,
      isActive: showOnlyActive ? true : undefined,
    }).then(r => r.data),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['cpt-categories'],
    queryFn: () => insuranceCodingApi.getCPTCategories().then(r => r.data),
  });

  const codes = codesData?.data || [];
  const pagination = codesData?.pagination;
  const categories: string[] = categoriesData?.data || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CPTFormData) => insuranceCodingApi.createCPT(data),
    onSuccess: () => {
      toast.success('CPT code created successfully');
      queryClient.invalidateQueries({ queryKey: ['cpt-codes'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create code');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CPTFormData> }) =>
      insuranceCodingApi.updateCPT(id, data),
    onSuccess: () => {
      toast.success('CPT code updated successfully');
      queryClient.invalidateQueries({ queryKey: ['cpt-codes'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update code');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => insuranceCodingApi.deleteCPT(id),
    onSuccess: () => {
      toast.success('CPT code deactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['cpt-codes'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete code');
    },
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, showOnlyPreAuth, showOnlyActive]);

  const openCreateModal = () => {
    setEditingCode(null);
    setFormData(defaultFormData);
    setShowModal(true);
  };

  const openEditModal = (code: CPTCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description,
      shortDescription: code.shortDescription || '',
      category: code.category,
      subcategory: code.subcategory || '',
      basePrice: Number(code.basePrice),
      dhaPrice: code.dhaPrice ? Number(code.dhaPrice) : undefined,
      cashPrice: code.cashPrice ? Number(code.cashPrice) : undefined,
      requiresPreAuth: code.requiresPreAuth,
      isActive: code.isActive,
      workRVU: code.workRVU ? Number(code.workRVU) : undefined,
      globalPeriod: code.globalPeriod || undefined,
      professionalComponent: code.professionalComponent,
      technicalComponent: code.technicalComponent,
      notes: code.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCode(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (code: CPTCode) => {
    if (confirm(`Are you sure you want to deactivate CPT code ${code.code}?`)) {
      deleteMutation.mutate(code.id);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return `${Number(value).toFixed(2)} AED`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyPreAuth}
            onChange={(e) => setShowOnlyPreAuth(e.target.checked)}
            className="rounded text-primary-500 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Pre-Auth Required</span>
        </label>

        <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyActive}
            onChange={(e) => setShowOnlyActive(e.target.checked)}
            className="rounded text-primary-500 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Active Only</span>
        </label>

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
          Add Code
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Code</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Description</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Base Price</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">DHA Price</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Pre-Auth</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : codes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No CPT codes found
                </td>
              </tr>
            ) : (
              codes.map((code: CPTCode) => (
                <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-gray-900 dark:text-white">
                      {code.code}
                    </span>
                    {(code.professionalComponent || code.technicalComponent) && (
                      <div className="flex gap-1 mt-1">
                        {code.professionalComponent && (
                          <span className="text-xs px-1 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                            26
                          </span>
                        )}
                        {code.technicalComponent && (
                          <span className="text-xs px-1 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                            TC
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900 dark:text-white line-clamp-2">
                      {code.shortDescription || code.description}
                    </div>
                    {code.workRVU && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        RVU: {Number(code.workRVU).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700 dark:text-gray-300">{code.category}</span>
                    {code.subcategory && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {code.subcategory}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                    {formatCurrency(Number(code.basePrice))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                    {formatCurrency(code.dhaPrice ? Number(code.dhaPrice) : undefined)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {code.requiresPreAuth ? (
                      <ShieldCheckIcon className="h-5 w-5 text-amber-500 mx-auto" />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'px-2 py-1 text-xs rounded-full',
                      code.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      {code.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(code)}
                        className="p-1 text-gray-400 hover:text-primary-500"
                      >
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(code)}
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingCode ? 'Edit CPT Code' : 'Add CPT Code'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-1 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono"
                      placeholder="e.g., 99213"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., E&M"
                      list="cpt-categories-list"
                    />
                    <datalist id="cpt-categories-list">
                      {categories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    placeholder="Full description of the procedure"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Short Description
                    </label>
                    <input
                      type="text"
                      value={formData.shortDescription}
                      onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      placeholder="Short display name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Subcategory
                    </label>
                    <input
                      type="text"
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., Office Visit"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Base Price (AED) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      DHA Price (AED)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.dhaPrice || ''}
                      onChange={(e) => setFormData({ ...formData, dhaPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cash Price (AED)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.cashPrice || ''}
                      onChange={(e) => setFormData({ ...formData, cashPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Work RVU
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.workRVU || ''}
                      onChange={(e) => setFormData({ ...formData, workRVU: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Global Period (Days)
                    </label>
                    <select
                      value={formData.globalPeriod || ''}
                      onChange={(e) => setFormData({ ...formData, globalPeriod: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">None</option>
                      <option value="0">0 - No global period</option>
                      <option value="10">10 days</option>
                      <option value="90">90 days</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresPreAuth}
                      onChange={(e) => setFormData({ ...formData, requiresPreAuth: e.target.checked })}
                      className="rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Requires Pre-Authorization</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.professionalComponent}
                      onChange={(e) => setFormData({ ...formData, professionalComponent: e.target.checked })}
                      className="rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Has Professional Component (26)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.technicalComponent}
                      onChange={(e) => setFormData({ ...formData, technicalComponent: e.target.checked })}
                      className="rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Has Technical Component (TC)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
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
                    {editingCode ? 'Update' : 'Create'}
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
