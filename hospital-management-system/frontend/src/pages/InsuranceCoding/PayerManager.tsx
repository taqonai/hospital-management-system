import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  ClockIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { GlassCard } from '../../components/ui/GlassCard';
import { insuranceCodingApi } from '../../services/api';
import clsx from 'clsx';
import PayerRulesEditor from './PayerRulesEditor';

interface Payer {
  id: string;
  name: string;
  code: string;
  regulator?: string;
  claimPlatform?: string;
  claimSubmissionDeadline?: number;
  appealDeadline?: number;
  preAuthRequired: boolean;
  preAuthPhone?: string;
  preAuthEmail?: string;
  preAuthPortal?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  paymentTerms?: number;
  isActive: boolean;
  notes?: string;
  _count?: {
    icdRules: number;
    cptRules: number;
  };
}

interface PayerFormData {
  name: string;
  code: string;
  regulator: string;
  claimPlatform: string;
  claimSubmissionDeadline: string;
  appealDeadline: string;
  preAuthRequired: boolean;
  preAuthPhone: string;
  preAuthEmail: string;
  preAuthPortal: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  paymentTerms: string;
  isActive: boolean;
  notes: string;
}

const initialFormData: PayerFormData = {
  name: '',
  code: '',
  regulator: 'DHA',
  claimPlatform: '',
  claimSubmissionDeadline: '180',
  appealDeadline: '90',
  preAuthRequired: false,
  preAuthPhone: '',
  preAuthEmail: '',
  preAuthPortal: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  paymentTerms: '30',
  isActive: true,
  notes: '',
};

export default function PayerManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedRegulator, setSelectedRegulator] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayer, setEditingPayer] = useState<Payer | null>(null);
  const [formData, setFormData] = useState<PayerFormData>(initialFormData);
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null);
  const [showRulesPanel, setShowRulesPanel] = useState(false);

  // Fetch payers
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payers', { page, search, regulator: selectedRegulator, isActive: showActiveOnly || undefined }],
    queryFn: () => insuranceCodingApi.getPayers({
      page,
      limit: 20,
      search: search || undefined,
      regulator: selectedRegulator || undefined,
      isActive: showActiveOnly || undefined,
    }).then(r => r.data),
  });

  // Fetch regulators for filter
  const { data: regulatorsData } = useQuery({
    queryKey: ['regulators'],
    queryFn: () => insuranceCodingApi.getRegulators().then(r => r.data),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => insuranceCodingApi.createPayer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payers'] });
      setIsModalOpen(false);
      setFormData(initialFormData);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => insuranceCodingApi.updatePayer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payers'] });
      setIsModalOpen(false);
      setEditingPayer(null);
      setFormData(initialFormData);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => insuranceCodingApi.deletePayer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payers'] });
    },
  });

  const payers: Payer[] = data?.data || [];
  const pagination = data?.pagination;
  const regulators: string[] = regulatorsData?.data || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      name: formData.name,
      code: formData.code,
      regulator: formData.regulator || undefined,
      claimPlatform: formData.claimPlatform || undefined,
      claimSubmissionDeadline: formData.claimSubmissionDeadline ? Number(formData.claimSubmissionDeadline) : undefined,
      appealDeadline: formData.appealDeadline ? Number(formData.appealDeadline) : undefined,
      preAuthRequired: formData.preAuthRequired,
      preAuthPhone: formData.preAuthPhone || undefined,
      preAuthEmail: formData.preAuthEmail || undefined,
      preAuthPortal: formData.preAuthPortal || undefined,
      contactPhone: formData.contactPhone || undefined,
      contactEmail: formData.contactEmail || undefined,
      address: formData.address || undefined,
      paymentTerms: formData.paymentTerms ? Number(formData.paymentTerms) : undefined,
      isActive: formData.isActive,
      notes: formData.notes || undefined,
    };

    if (editingPayer) {
      updateMutation.mutate({ id: editingPayer.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const openEditModal = (payer: Payer) => {
    setEditingPayer(payer);
    setFormData({
      name: payer.name,
      code: payer.code,
      regulator: payer.regulator || 'DHA',
      claimPlatform: payer.claimPlatform || '',
      claimSubmissionDeadline: payer.claimSubmissionDeadline?.toString() || '180',
      appealDeadline: payer.appealDeadline?.toString() || '90',
      preAuthRequired: payer.preAuthRequired,
      preAuthPhone: payer.preAuthPhone || '',
      preAuthEmail: payer.preAuthEmail || '',
      preAuthPortal: payer.preAuthPortal || '',
      contactPhone: payer.contactPhone || '',
      contactEmail: payer.contactEmail || '',
      address: payer.address || '',
      paymentTerms: payer.paymentTerms?.toString() || '30',
      isActive: payer.isActive,
      notes: payer.notes || '',
    });
    setIsModalOpen(true);
  };

  const openRulesPanel = (payer: Payer) => {
    setSelectedPayer(payer);
    setShowRulesPanel(true);
  };

  if (showRulesPanel && selectedPayer) {
    return (
      <PayerRulesEditor
        payer={selectedPayer}
        onBack={() => {
          setShowRulesPanel(false);
          setSelectedPayer(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search payers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedRegulator}
          onChange={(e) => { setSelectedRegulator(e.target.value); setPage(1); }}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Regulators</option>
          {regulators.map((reg) => (
            <option key={reg} value={reg}>{reg}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => { setShowActiveOnly(e.target.checked); setPage(1); }}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Active Only</span>
        </label>
        <button
          onClick={() => { setEditingPayer(null); setFormData(initialFormData); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <PlusIcon className="w-5 h-5" />
          Add Payer
        </button>
      </div>

      {/* Payers Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : payers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No payers found. Add your first insurance payer.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {payers.map((payer) => (
            <GlassCard key={payer.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'p-2 rounded-lg',
                    payer.isActive ? 'bg-green-500/10' : 'bg-gray-500/10'
                  )}>
                    <BuildingOffice2Icon className={clsx(
                      'w-6 h-6',
                      payer.isActive ? 'text-green-500' : 'text-gray-500'
                    )} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{payer.name}</h3>
                    <p className="text-sm text-gray-500">{payer.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openRulesPanel(payer)}
                    className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Manage Rules"
                  >
                    <AdjustmentsHorizontalIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openEditModal(payer)}
                    className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Edit"
                  >
                    <PencilSquareIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to deactivate this payer?')) {
                        deleteMutation.mutate(payer.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Deactivate"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                {payer.regulator && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <ShieldCheckIcon className="w-4 h-4" />
                    <span>Regulator: {payer.regulator}</span>
                  </div>
                )}
                {payer.claimPlatform && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <GlobeAltIcon className="w-4 h-4" />
                    <span>{payer.claimPlatform}</span>
                  </div>
                )}
                {payer.contactPhone && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <PhoneIcon className="w-4 h-4" />
                    <span>{payer.contactPhone}</span>
                  </div>
                )}
                {payer.contactEmail && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <EnvelopeIcon className="w-4 h-4" />
                    <span className="truncate">{payer.contactEmail}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-gray-500">
                    <DocumentTextIcon className="w-4 h-4" />
                    {payer._count?.icdRules || 0} ICD Rules
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <AdjustmentsHorizontalIcon className="w-4 h-4" />
                    {payer._count?.cptRules || 0} CPT Rules
                  </span>
                </div>
                {payer.preAuthRequired && (
                  <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full">
                    Pre-Auth Required
                  </span>
                )}
              </div>

              {payer.paymentTerms && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <ClockIcon className="w-4 h-4" />
                  Payment Terms: {payer.paymentTerms} days
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingPayer ? 'Edit Insurance Payer' : 'Add Insurance Payer'}
              </h2>
              <button
                onClick={() => { setIsModalOpen(false); setEditingPayer(null); setFormData(initialFormData); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payer Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Dubai Insurance Company"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payer Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., DIC"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Regulator
                  </label>
                  <select
                    value={formData.regulator}
                    onChange={(e) => setFormData({ ...formData, regulator: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="DHA">DHA (Dubai Health Authority)</option>
                    <option value="HAAD">HAAD (Abu Dhabi)</option>
                    <option value="MOH">MOH (Ministry of Health)</option>
                    <option value="ISAHD">ISAHD (Sharjah)</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Claim Platform
                  </label>
                  <input
                    type="text"
                    value={formData.claimPlatform}
                    onChange={(e) => setFormData({ ...formData, claimPlatform: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Shafafiya, Riayati"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Claim Deadline (days)
                  </label>
                  <input
                    type="number"
                    value={formData.claimSubmissionDeadline}
                    onChange={(e) => setFormData({ ...formData, claimSubmissionDeadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Appeal Deadline (days)
                  </label>
                  <input
                    type="number"
                    value={formData.appealDeadline}
                    onChange={(e) => setFormData({ ...formData, appealDeadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payment Terms (days)
                  </label>
                  <input
                    type="number"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Pre-Authorization</h3>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.preAuthRequired}
                      onChange={(e) => setFormData({ ...formData, preAuthRequired: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Pre-Authorization Required</span>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pre-Auth Phone
                    </label>
                    <input
                      type="text"
                      value={formData.preAuthPhone}
                      onChange={(e) => setFormData({ ...formData, preAuthPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pre-Auth Email
                    </label>
                    <input
                      type="email"
                      value={formData.preAuthEmail}
                      onChange={(e) => setFormData({ ...formData, preAuthEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pre-Auth Portal
                    </label>
                    <input
                      type="url"
                      value={formData.preAuthPortal}
                      onChange={(e) => setFormData({ ...formData, preAuthPortal: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingPayer(null); setFormData(initialFormData); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingPayer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
