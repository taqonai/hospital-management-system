import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  LinkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { GlassCard } from '../../components/ui/GlassCard';
import { insuranceCodingApi } from '../../services/api';
import clsx from 'clsx';

interface Mapping {
  id: string;
  icd10CodeId: string;
  cptCodeId: string;
  validityScore: number;
  isRequired: boolean;
  isCommon: boolean;
  documentation?: string;
  notes?: string;
  isActive: boolean;
  icd10Code: {
    id: string;
    code: string;
    description: string;
    category?: string;
  };
  cptCode: {
    id: string;
    code: string;
    description: string;
    category?: string;
    basePrice?: number;
  };
}

interface MappingFormData {
  validityScore: string;
  isRequired: boolean;
  isCommon: boolean;
  documentation: string;
  notes: string;
  isActive: boolean;
}

const initialFormData: MappingFormData = {
  validityScore: '1.0',
  isRequired: false,
  isCommon: true,
  documentation: '',
  notes: '',
  isActive: true,
};

export default function MedicalNecessity() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showRequired, setShowRequired] = useState(false);
  const [showCommon, setShowCommon] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Mapping | null>(null);
  const [formData, setFormData] = useState<MappingFormData>(initialFormData);
  const [icdSearch, setIcdSearch] = useState('');
  const [cptSearch, setCptSearch] = useState('');
  const [selectedICD, setSelectedICD] = useState<{ id: string; code: string; description: string } | null>(null);
  const [selectedCPT, setSelectedCPT] = useState<{ id: string; code: string; description: string } | null>(null);

  // Fetch mappings
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['icd-cpt-mappings', { page, search, isRequired: showRequired, isCommon: showCommon, isActive: showActiveOnly }],
    queryFn: () => insuranceCodingApi.getICDCPTMappings({
      page,
      limit: 25,
      search: search || undefined,
      isRequired: showRequired || undefined,
      isCommon: showCommon || undefined,
      isActive: showActiveOnly || undefined,
    }).then(r => r.data),
  });

  // Search ICD codes
  const { data: icdResults } = useQuery({
    queryKey: ['icd-search', icdSearch],
    queryFn: () => insuranceCodingApi.searchICD10(icdSearch, 10).then(r => r.data),
    enabled: icdSearch.length >= 2 && isModalOpen && !editingMapping,
  });

  // Search CPT codes
  const { data: cptResults } = useQuery({
    queryKey: ['cpt-search', cptSearch],
    queryFn: () => insuranceCodingApi.searchCPT(cptSearch, 10).then(r => r.data),
    enabled: cptSearch.length >= 2 && isModalOpen && !editingMapping,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => insuranceCodingApi.createICDCPTMapping(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icd-cpt-mappings'] });
      closeModal();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => insuranceCodingApi.updateICDCPTMapping(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icd-cpt-mappings'] });
      closeModal();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => insuranceCodingApi.deleteICDCPTMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icd-cpt-mappings'] });
    },
  });

  const mappings: Mapping[] = data?.data || [];
  const pagination = data?.pagination;
  const icdCodes = icdResults?.data || [];
  const cptCodes = cptResults?.data || [];

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMapping(null);
    setFormData(initialFormData);
    setIcdSearch('');
    setCptSearch('');
    setSelectedICD(null);
    setSelectedCPT(null);
  };

  const openAddModal = () => {
    setEditingMapping(null);
    setFormData(initialFormData);
    setIcdSearch('');
    setCptSearch('');
    setSelectedICD(null);
    setSelectedCPT(null);
    setIsModalOpen(true);
  };

  const openEditModal = (mapping: Mapping) => {
    setEditingMapping(mapping);
    setFormData({
      validityScore: mapping.validityScore?.toString() || '1.0',
      isRequired: mapping.isRequired,
      isCommon: mapping.isCommon,
      documentation: mapping.documentation || '',
      notes: mapping.notes || '',
      isActive: mapping.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData: any = {
      validityScore: formData.validityScore ? Number(formData.validityScore) : 1.0,
      isRequired: formData.isRequired,
      isCommon: formData.isCommon,
      documentation: formData.documentation || undefined,
      notes: formData.notes || undefined,
      isActive: formData.isActive,
    };

    if (!editingMapping) {
      if (!selectedICD || !selectedCPT) return;
      submitData.icd10CodeId = selectedICD.id;
      submitData.cptCodeId = selectedCPT.id;
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate({ id: editingMapping.id, data: submitData });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (score >= 0.7) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <LinkIcon className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100">Medical Necessity Mappings</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Define valid ICD-10 to CPT code pairs for medical necessity validation.
              These mappings help ensure procedures are justified by diagnoses.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search ICD or CPT codes..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
            <input
              type="checkbox"
              checked={showRequired}
              onChange={(e) => { setShowRequired(e.target.checked); setPage(1); }}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
          </label>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
            <input
              type="checkbox"
              checked={showCommon}
              onChange={(e) => { setShowCommon(e.target.checked); setPage(1); }}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Common</span>
          </label>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => { setShowActiveOnly(e.target.checked); setPage(1); }}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Active Only</span>
          </label>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 whitespace-nowrap"
        >
          <PlusIcon className="w-5 h-5" />
          Add Mapping
        </button>
      </div>

      {/* Mappings Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : mappings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No mappings found. Add your first ICD-CPT mapping.
        </div>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    ICD-10 Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    CPT Code
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Flags
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Documentation
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-mono text-sm font-medium text-blue-600">
                          {mapping.icd10Code.code}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                          {mapping.icd10Code.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-mono text-sm font-medium text-green-600">
                          {mapping.cptCode.code}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                          {mapping.cptCode.description}
                        </p>
                        {mapping.cptCode.basePrice && (
                          <span className="text-xs text-gray-400">
                            ${Number(mapping.cptCode.basePrice).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        getScoreColor(Number(mapping.validityScore))
                      )}>
                        {(Number(mapping.validityScore) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {mapping.isRequired && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-full">
                            <ExclamationTriangleIcon className="w-3 h-3" />
                            Required
                          </span>
                        )}
                        {mapping.isCommon && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full">
                            <StarIconSolid className="w-3 h-3" />
                            Common
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[150px] truncate">
                      {mapping.documentation || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx(
                        'px-2 py-0.5 text-xs rounded-full',
                        mapping.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      )}>
                        {mapping.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(mapping)}
                          className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this mapping?')) {
                              deleteMutation.mutate(mapping.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((page - 1) * 25) + 1} to {Math.min(page * 25, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingMapping ? 'Edit ICD-CPT Mapping' : 'Add ICD-CPT Mapping'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Code Selection - only for new mappings */}
              {!editingMapping ? (
                <>
                  {/* ICD-10 Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ICD-10 Code *
                    </label>
                    {selectedICD ? (
                      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div>
                          <span className="font-mono font-medium text-blue-600">{selectedICD.code}</span>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{selectedICD.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedICD(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={icdSearch}
                          onChange={(e) => setIcdSearch(e.target.value)}
                          placeholder="Search ICD-10 codes..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        />
                        {icdCodes.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {icdCodes.map((code: any) => (
                              <button
                                key={code.id}
                                type="button"
                                onClick={() => { setSelectedICD(code); setIcdSearch(''); }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <span className="font-mono text-sm text-blue-600">{code.code}</span>
                                <p className="text-xs text-gray-500 truncate">{code.description}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CPT Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      CPT Code *
                    </label>
                    {selectedCPT ? (
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div>
                          <span className="font-mono font-medium text-green-600">{selectedCPT.code}</span>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{selectedCPT.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCPT(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={cptSearch}
                          onChange={(e) => setCptSearch(e.target.value)}
                          placeholder="Search CPT codes..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        />
                        {cptCodes.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {cptCodes.map((code: any) => (
                              <button
                                key={code.id}
                                type="button"
                                onClick={() => { setSelectedCPT(code); setCptSearch(''); }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <span className="font-mono text-sm text-green-600">{code.code}</span>
                                <p className="text-xs text-gray-500 truncate">{code.description}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Display existing codes for editing */
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="font-mono font-medium text-blue-600">{editingMapping.icd10Code.code}</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{editingMapping.icd10Code.description}</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <LinkIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="font-mono font-medium text-green-600">{editingMapping.cptCode.code}</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{editingMapping.cptCode.description}</p>
                  </div>
                </div>
              )}

              {/* Validity Score */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Validity Score (0.0 - 1.0)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.validityScore}
                  onChange={(e) => setFormData({ ...formData, validityScore: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher score = stronger medical necessity relationship
                </p>
              </div>

              {/* Flags */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isRequired}
                    onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                    className="rounded border-gray-300 text-red-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Required Mapping</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isCommon}
                    onChange={(e) => setFormData({ ...formData, isCommon: e.target.checked })}
                    className="rounded border-gray-300 text-yellow-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Common Pairing</span>
                </label>
              </div>

              {/* Documentation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Documentation Requirements
                </label>
                <textarea
                  value={formData.documentation}
                  onChange={(e) => setFormData({ ...formData, documentation: e.target.value })}
                  rows={2}
                  placeholder="e.g., Requires documented symptoms and physical exam findings"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>

              {/* Active Status */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
              </label>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || (!editingMapping && (!selectedICD || !selectedCPT))}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingMapping ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
