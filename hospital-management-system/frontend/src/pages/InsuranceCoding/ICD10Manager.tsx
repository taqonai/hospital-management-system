import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  FunnelIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline';
import { insuranceCodingApi } from '../../services/api';
import CSVImportModal from '../../components/insurance/CSVImportModal';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ICD10Code {
  id: string;
  code: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  dhaApproved: boolean;
  specificityLevel: number;
  isUnspecified: boolean;
  preferredCode?: string;
  isActive: boolean;
  isBillable: boolean;
  notes?: string;
}

interface CodeFormData {
  code: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  dhaApproved: boolean;
  specificityLevel: number;
  isUnspecified: boolean;
  preferredCode?: string;
  isActive: boolean;
  isBillable: boolean;
  notes?: string;
}

const defaultFormData: CodeFormData = {
  code: '',
  description: '',
  shortDescription: '',
  category: '',
  subcategory: '',
  dhaApproved: true,
  specificityLevel: 3,
  isUnspecified: false,
  preferredCode: '',
  isActive: true,
  isBillable: true,
  notes: '',
};

export default function ICD10Manager() {
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showOnlyDHA, setShowOnlyDHA] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingCode, setEditingCode] = useState<ICD10Code | null>(null);
  const [formData, setFormData] = useState<CodeFormData>(defaultFormData);

  // Fetch codes
  const { data: codesData, isLoading, refetch } = useQuery({
    queryKey: ['icd10-codes', { page, limit, searchTerm, selectedCategory, showOnlyDHA, showOnlyActive }],
    queryFn: () => insuranceCodingApi.getICD10Codes({
      page,
      limit,
      search: searchTerm || undefined,
      category: selectedCategory || undefined,
      dhaApproved: showOnlyDHA ? true : undefined,
      isActive: showOnlyActive ? true : undefined,
    }).then(r => r.data),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['icd10-categories'],
    queryFn: () => insuranceCodingApi.getICD10Categories().then(r => r.data),
  });

  const codes = codesData?.data || [];
  const pagination = codesData?.pagination;
  const categories: string[] = categoriesData?.data || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CodeFormData) => insuranceCodingApi.createICD10(data),
    onSuccess: () => {
      toast.success('ICD-10 code created successfully');
      queryClient.invalidateQueries({ queryKey: ['icd10-codes'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create code');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CodeFormData> }) =>
      insuranceCodingApi.updateICD10(id, data),
    onSuccess: () => {
      toast.success('ICD-10 code updated successfully');
      queryClient.invalidateQueries({ queryKey: ['icd10-codes'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update code');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => insuranceCodingApi.deleteICD10(id),
    onSuccess: () => {
      toast.success('ICD-10 code deactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['icd10-codes'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete code');
    },
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, showOnlyDHA, showOnlyActive]);

  const openCreateModal = () => {
    setEditingCode(null);
    setFormData(defaultFormData);
    setShowModal(true);
  };

  const openEditModal = (code: ICD10Code) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description,
      shortDescription: code.shortDescription || '',
      category: code.category,
      subcategory: code.subcategory || '',
      dhaApproved: code.dhaApproved,
      specificityLevel: code.specificityLevel,
      isUnspecified: code.isUnspecified,
      preferredCode: code.preferredCode || '',
      isActive: code.isActive,
      isBillable: code.isBillable,
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

  const handleDelete = (code: ICD10Code) => {
    if (confirm(`Are you sure you want to deactivate ICD-10 code ${code.code}?`)) {
      deleteMutation.mutate(code.id);
    }
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
            checked={showOnlyDHA}
            onChange={(e) => setShowOnlyDHA(e.target.checked)}
            className="rounded text-primary-500 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">DHA Approved</span>
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
          onClick={() => setShowCSVImport(true)}
          className="flex items-center gap-2 px-4 py-2 border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
        >
          <DocumentArrowUpIcon className="h-5 w-5" />
          Import CSV
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
              <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Level</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">DHA</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : codes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No ICD-10 codes found
                </td>
              </tr>
            ) : (
              codes.map((code: ICD10Code) => (
                <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-gray-900 dark:text-white">
                        {code.code}
                      </span>
                      {code.isUnspecified && (
                        <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
                          Unspec
                        </span>
                      )}
                    </div>
                    {code.preferredCode && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Prefer: {code.preferredCode}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900 dark:text-white line-clamp-2">
                      {code.description}
                    </div>
                    {code.shortDescription && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {code.shortDescription}
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
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'px-2 py-1 text-xs rounded-full',
                      code.specificityLevel >= 5 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      code.specificityLevel >= 4 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {code.specificityLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {code.dhaApproved ? (
                      <CheckBadgeIcon className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mx-auto" />
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
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingCode ? 'Edit ICD-10 Code' : 'Add ICD-10 Code'}
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
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono"
                      placeholder="e.g., J18.9"
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
                      placeholder="e.g., Respiratory"
                      list="categories-list"
                    />
                    <datalist id="categories-list">
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
                    placeholder="Full description of the diagnosis"
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
                      placeholder="e.g., Lower Respiratory"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Specificity Level
                    </label>
                    <select
                      value={formData.specificityLevel}
                      onChange={(e) => setFormData({ ...formData, specificityLevel: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      <option value={3}>3 - Category</option>
                      <option value={4}>4 - Subcategory</option>
                      <option value={5}>5 - Specific</option>
                      <option value={6}>6 - More Specific</option>
                      <option value={7}>7 - Most Specific</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Preferred Code
                    </label>
                    <input
                      type="text"
                      value={formData.preferredCode}
                      onChange={(e) => setFormData({ ...formData, preferredCode: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono"
                      placeholder="More specific code to use"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.dhaApproved}
                      onChange={(e) => setFormData({ ...formData, dhaApproved: e.target.checked })}
                      className="rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">DHA Approved</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isUnspecified}
                      onChange={(e) => setFormData({ ...formData, isUnspecified: e.target.checked })}
                      className="rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Unspecified Code</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isBillable}
                      onChange={(e) => setFormData({ ...formData, isBillable: e.target.checked })}
                      className="rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Billable</span>
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

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['icd10-codes'] });
          setShowCSVImport(false);
        }}
        title="Import ICD-10 Codes"
        description="Upload a CSV file with ICD-10 diagnosis codes"
        importFn={insuranceCodingApi.importICD10CSV}
        downloadTemplateFn={insuranceCodingApi.getICD10CSVTemplate}
        templateFilename="icd10-template.csv"
        fields={[
          { name: 'code', required: true, example: 'J18.9' },
          { name: 'description', required: true, example: 'Pneumonia, unspecified organism' },
          { name: 'shortDescription', required: false, example: 'Pneumonia NOS' },
          { name: 'category', required: true, example: 'Respiratory' },
          { name: 'subcategory', required: false, example: 'Lower Respiratory' },
          { name: 'dhaApproved', required: false, example: 'true' },
          { name: 'specificityLevel', required: false, example: '4' },
          { name: 'isUnspecified', required: false, example: 'true' },
          { name: 'preferredCode', required: false, example: 'J18.1' },
          { name: 'isBillable', required: false, example: 'true' },
          { name: 'notes', required: false, example: 'Common diagnosis code' },
        ]}
      />
    </div>
  );
}
