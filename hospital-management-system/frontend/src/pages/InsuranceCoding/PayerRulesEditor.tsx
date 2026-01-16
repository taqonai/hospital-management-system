import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { GlassCard } from '../../components/ui/GlassCard';
import { insuranceCodingApi } from '../../services/api';
import clsx from 'clsx';

interface Payer {
  id: string;
  name: string;
  code: string;
}

interface ICDRule {
  id: string;
  icd10CodeId: string;
  isCovered: boolean;
  requiresPreAuth: boolean;
  maxVisitsPerYear?: number;
  waitingPeriodDays?: number;
  copayAmount?: number;
  copayPercentage?: number;
  deductibleApplies: boolean;
  ageMinimum?: number;
  ageMaximum?: number;
  genderRestriction?: string;
  priorDiagRequired?: string;
  documentationNotes?: string;
  isActive: boolean;
  icd10Code: {
    id: string;
    code: string;
    description: string;
    category?: string;
  };
}

interface CPTRule {
  id: string;
  cptCodeId: string;
  isCovered: boolean;
  requiresPreAuth: boolean;
  priceOverride?: number;
  maxUnitsPerVisit?: number;
  maxUnitsPerYear?: number;
  frequencyLimit?: string;
  ageMinimum?: number;
  ageMaximum?: number;
  genderRestriction?: string;
  placeOfService: string[];
  requiresModifier: string[];
  documentationNotes?: string;
  isActive: boolean;
  cptCode: {
    id: string;
    code: string;
    description: string;
    category?: string;
    basePrice?: number;
  };
}

interface PayerRulesEditorProps {
  payer: Payer;
  onBack: () => void;
}

type RuleType = 'icd' | 'cpt';

export default function PayerRulesEditor({ payer, onBack }: PayerRulesEditorProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<RuleType>('icd');
  const [search, setSearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ICDRule | CPTRule | null>(null);
  const [codeSearch, setCodeSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<{ id: string; code: string; description: string } | null>(null);

  // Fetch ICD rules
  const { data: icdRulesData, isLoading: icdLoading } = useQuery({
    queryKey: ['payer-icd-rules', payer.id, search, showActiveOnly],
    queryFn: () => insuranceCodingApi.getPayerICDRules(payer.id, {
      search: search || undefined,
      isActive: showActiveOnly || undefined,
    }).then(r => r.data),
    enabled: activeTab === 'icd',
  });

  // Fetch CPT rules
  const { data: cptRulesData, isLoading: cptLoading } = useQuery({
    queryKey: ['payer-cpt-rules', payer.id, search, showActiveOnly],
    queryFn: () => insuranceCodingApi.getPayerCPTRules(payer.id, {
      search: search || undefined,
      isActive: showActiveOnly || undefined,
    }).then(r => r.data),
    enabled: activeTab === 'cpt',
  });

  // Search codes for adding rules
  const { data: searchResults } = useQuery({
    queryKey: ['code-search', activeTab, codeSearch],
    queryFn: () => activeTab === 'icd'
      ? insuranceCodingApi.searchICD10(codeSearch, 10).then(r => r.data)
      : insuranceCodingApi.searchCPT(codeSearch, 10).then(r => r.data),
    enabled: codeSearch.length >= 2 && isModalOpen && !editingRule,
  });

  // ICD Rule mutations
  const createICDRuleMutation = useMutation({
    mutationFn: (data: any) => insuranceCodingApi.createPayerICDRule(payer.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-icd-rules', payer.id] });
      closeModal();
    },
  });

  const updateICDRuleMutation = useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: any }) =>
      insuranceCodingApi.updatePayerICDRule(payer.id, ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-icd-rules', payer.id] });
      closeModal();
    },
  });

  const deleteICDRuleMutation = useMutation({
    mutationFn: (ruleId: string) => insuranceCodingApi.deletePayerICDRule(payer.id, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-icd-rules', payer.id] });
    },
  });

  // CPT Rule mutations
  const createCPTRuleMutation = useMutation({
    mutationFn: (data: any) => insuranceCodingApi.createPayerCPTRule(payer.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-cpt-rules', payer.id] });
      closeModal();
    },
  });

  const updateCPTRuleMutation = useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: any }) =>
      insuranceCodingApi.updatePayerCPTRule(payer.id, ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-cpt-rules', payer.id] });
      closeModal();
    },
  });

  const deleteCPTRuleMutation = useMutation({
    mutationFn: (ruleId: string) => insuranceCodingApi.deletePayerCPTRule(payer.id, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-cpt-rules', payer.id] });
    },
  });

  const icdRules: ICDRule[] = icdRulesData?.data || [];
  const cptRules: CPTRule[] = cptRulesData?.data || [];
  const codes = searchResults?.data || [];

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
    setCodeSearch('');
    setSelectedCode(null);
  };

  const openAddModal = () => {
    setEditingRule(null);
    setCodeSearch('');
    setSelectedCode(null);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: ICDRule | CPTRule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {payer.name} ({payer.code})
          </h2>
          <p className="text-sm text-gray-500">Manage coverage rules for this payer</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => { setActiveTab('icd'); setSearch(''); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm',
            activeTab === 'icd'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <DocumentTextIcon className="w-5 h-5" />
          ICD-10 Rules ({icdRules.length})
        </button>
        <button
          onClick={() => { setActiveTab('cpt'); setSearch(''); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm',
            activeTab === 'cpt'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <ClipboardDocumentListIcon className="w-5 h-5" />
          CPT Rules ({cptRules.length})
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'icd' ? 'ICD-10' : 'CPT'} rules...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Active Only</span>
        </label>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <PlusIcon className="w-5 h-5" />
          Add {activeTab === 'icd' ? 'ICD' : 'CPT'} Rule
        </button>
      </div>

      {/* Rules Table */}
      {(activeTab === 'icd' ? icdLoading : cptLoading) ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : (activeTab === 'icd' ? icdRules : cptRules).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No {activeTab === 'icd' ? 'ICD-10' : 'CPT'} rules found. Add your first rule.
        </div>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Covered
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Pre-Auth
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Limits
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
                {activeTab === 'icd' ? (
                  icdRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-primary-600">
                          {rule.icd10Code.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {rule.icd10Code.description}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rule.isCovered ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircleIcon className="w-5 h-5 text-red-500 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rule.requiresPreAuth ? (
                          <ShieldExclamationIcon className="w-5 h-5 text-yellow-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {rule.maxVisitsPerYear && <div>{rule.maxVisitsPerYear} visits/year</div>}
                        {rule.copayAmount && <div>Copay: ${Number(rule.copayAmount).toFixed(2)}</div>}
                        {rule.copayPercentage && <div>Copay: {Number(rule.copayPercentage)}%</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx(
                          'px-2 py-0.5 text-xs rounded-full',
                          rule.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        )}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(rule)}
                            className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this rule?')) {
                                deleteICDRuleMutation.mutate(rule.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  cptRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-primary-600">
                          {rule.cptCode.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {rule.cptCode.description}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rule.isCovered ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircleIcon className="w-5 h-5 text-red-500 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rule.requiresPreAuth ? (
                          <ShieldExclamationIcon className="w-5 h-5 text-yellow-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {rule.priceOverride && <div>Price: ${Number(rule.priceOverride).toFixed(2)}</div>}
                        {rule.maxUnitsPerVisit && <div>Max: {rule.maxUnitsPerVisit}/visit</div>}
                        {rule.frequencyLimit && <div>{rule.frequencyLimit}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx(
                          'px-2 py-0.5 text-xs rounded-full',
                          rule.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        )}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(rule)}
                            className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this rule?')) {
                                deleteCPTRuleMutation.mutate(rule.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <RuleModal
          type={activeTab}
          editingRule={editingRule}
          selectedCode={selectedCode}
          codeSearch={codeSearch}
          codes={codes}
          onCodeSearchChange={setCodeSearch}
          onCodeSelect={setSelectedCode}
          onClose={closeModal}
          onSave={(data) => {
            if (activeTab === 'icd') {
              if (editingRule) {
                updateICDRuleMutation.mutate({ ruleId: editingRule.id, data });
              } else {
                createICDRuleMutation.mutate(data);
              }
            } else {
              if (editingRule) {
                updateCPTRuleMutation.mutate({ ruleId: editingRule.id, data });
              } else {
                createCPTRuleMutation.mutate(data);
              }
            }
          }}
          isSaving={
            createICDRuleMutation.isPending || updateICDRuleMutation.isPending ||
            createCPTRuleMutation.isPending || updateCPTRuleMutation.isPending
          }
        />
      )}
    </div>
  );
}

// Rule Modal Component
interface RuleModalProps {
  type: RuleType;
  editingRule: ICDRule | CPTRule | null;
  selectedCode: { id: string; code: string; description: string } | null;
  codeSearch: string;
  codes: any[];
  onCodeSearchChange: (value: string) => void;
  onCodeSelect: (code: { id: string; code: string; description: string }) => void;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}

function RuleModal({
  type,
  editingRule,
  selectedCode,
  codeSearch,
  codes,
  onCodeSearchChange,
  onCodeSelect,
  onClose,
  onSave,
  isSaving,
}: RuleModalProps) {
  // Unified form state that includes all fields for both ICD and CPT rules
  const getInitialFormData = () => {
    const base = {
      isCovered: true,
      requiresPreAuth: false,
      maxVisitsPerYear: '',
      waitingPeriodDays: '',
      copayAmount: '',
      copayPercentage: '',
      deductibleApplies: true,
      priceOverride: '',
      maxUnitsPerVisit: '',
      maxUnitsPerYear: '',
      frequencyLimit: '',
      ageMinimum: '',
      ageMaximum: '',
      genderRestriction: '',
      documentationNotes: '',
      isActive: true,
    };

    if (editingRule) {
      if (type === 'icd') {
        const rule = editingRule as ICDRule;
        return {
          ...base,
          isCovered: rule.isCovered,
          requiresPreAuth: rule.requiresPreAuth,
          maxVisitsPerYear: rule.maxVisitsPerYear?.toString() || '',
          waitingPeriodDays: rule.waitingPeriodDays?.toString() || '',
          copayAmount: rule.copayAmount?.toString() || '',
          copayPercentage: rule.copayPercentage?.toString() || '',
          deductibleApplies: rule.deductibleApplies,
          ageMinimum: rule.ageMinimum?.toString() || '',
          ageMaximum: rule.ageMaximum?.toString() || '',
          genderRestriction: rule.genderRestriction || '',
          documentationNotes: rule.documentationNotes || '',
          isActive: rule.isActive,
        };
      } else {
        const rule = editingRule as CPTRule;
        return {
          ...base,
          isCovered: rule.isCovered,
          requiresPreAuth: rule.requiresPreAuth,
          priceOverride: rule.priceOverride?.toString() || '',
          maxUnitsPerVisit: rule.maxUnitsPerVisit?.toString() || '',
          maxUnitsPerYear: rule.maxUnitsPerYear?.toString() || '',
          frequencyLimit: rule.frequencyLimit || '',
          ageMinimum: rule.ageMinimum?.toString() || '',
          ageMaximum: rule.ageMaximum?.toString() || '',
          genderRestriction: rule.genderRestriction || '',
          documentationNotes: rule.documentationNotes || '',
          isActive: rule.isActive,
        };
      }
    }
    return base;
  };

  const [formData, setFormData] = useState(getInitialFormData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingRule && !selectedCode) {
      return;
    }

    const data: any = {
      isCovered: formData.isCovered,
      requiresPreAuth: formData.requiresPreAuth,
      ageMinimum: formData.ageMinimum ? Number(formData.ageMinimum) : undefined,
      ageMaximum: formData.ageMaximum ? Number(formData.ageMaximum) : undefined,
      genderRestriction: formData.genderRestriction || undefined,
      documentationNotes: formData.documentationNotes || undefined,
      isActive: formData.isActive,
    };

    if (!editingRule && selectedCode) {
      data[type === 'icd' ? 'icd10CodeId' : 'cptCodeId'] = selectedCode.id;
    }

    if (type === 'icd') {
      data.maxVisitsPerYear = formData.maxVisitsPerYear ? Number(formData.maxVisitsPerYear) : undefined;
      data.waitingPeriodDays = formData.waitingPeriodDays ? Number(formData.waitingPeriodDays) : undefined;
      data.copayAmount = formData.copayAmount ? Number(formData.copayAmount) : undefined;
      data.copayPercentage = formData.copayPercentage ? Number(formData.copayPercentage) : undefined;
      data.deductibleApplies = formData.deductibleApplies;
    } else {
      data.priceOverride = formData.priceOverride ? Number(formData.priceOverride) : undefined;
      data.maxUnitsPerVisit = formData.maxUnitsPerVisit ? Number(formData.maxUnitsPerVisit) : undefined;
      data.maxUnitsPerYear = formData.maxUnitsPerYear ? Number(formData.maxUnitsPerYear) : undefined;
      data.frequencyLimit = formData.frequencyLimit || undefined;
    }

    onSave(data);
  };

  const codeLabel = editingRule
    ? (type === 'icd' ? (editingRule as ICDRule).icd10Code : (editingRule as CPTRule).cptCode)
    : selectedCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingRule ? 'Edit' : 'Add'} {type === 'icd' ? 'ICD-10' : 'CPT'} Rule
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Code Selection */}
          {!editingRule ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select {type === 'icd' ? 'ICD-10' : 'CPT'} Code *
              </label>
              {selectedCode ? (
                <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <div>
                    <span className="font-mono font-medium text-primary-600">{selectedCode.code}</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedCode.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCodeSelect(null as any)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={codeSearch}
                    onChange={(e) => onCodeSearchChange(e.target.value)}
                    placeholder={`Search ${type === 'icd' ? 'ICD-10' : 'CPT'} codes...`}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                  {codes.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {codes.map((code: any) => (
                        <button
                          key={code.id}
                          type="button"
                          onClick={() => onCodeSelect(code)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <span className="font-mono text-sm text-primary-600">{code.code}</span>
                          <p className="text-xs text-gray-500 truncate">{code.description}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="font-mono font-medium text-primary-600">{codeLabel?.code}</span>
              <p className="text-sm text-gray-600 dark:text-gray-400">{codeLabel?.description}</p>
            </div>
          )}

          {/* Coverage Settings */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isCovered}
                onChange={(e) => setFormData({ ...formData, isCovered: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Covered</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requiresPreAuth}
                onChange={(e) => setFormData({ ...formData, requiresPreAuth: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Requires Pre-Auth</span>
            </label>
          </div>

          {/* Type-specific fields */}
          {type === 'icd' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Visits/Year
                  </label>
                  <input
                    type="number"
                    value={formData.maxVisitsPerYear}
                    onChange={(e) => setFormData({ ...formData, maxVisitsPerYear: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Waiting Period (days)
                  </label>
                  <input
                    type="number"
                    value={formData.waitingPeriodDays}
                    onChange={(e) => setFormData({ ...formData, waitingPeriodDays: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Copay Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.copayAmount}
                    onChange={(e) => setFormData({ ...formData, copayAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Copay Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.copayPercentage}
                    onChange={(e) => setFormData({ ...formData, copayPercentage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.deductibleApplies}
                  onChange={(e) => setFormData({ ...formData, deductibleApplies: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Deductible Applies</span>
              </label>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price Override ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.priceOverride}
                    onChange={(e) => setFormData({ ...formData, priceOverride: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Units/Visit
                  </label>
                  <input
                    type="number"
                    value={formData.maxUnitsPerVisit}
                    onChange={(e) => setFormData({ ...formData, maxUnitsPerVisit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Units/Year
                  </label>
                  <input
                    type="number"
                    value={formData.maxUnitsPerYear}
                    onChange={(e) => setFormData({ ...formData, maxUnitsPerYear: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequency Limit
                  </label>
                  <input
                    type="text"
                    value={formData.frequencyLimit}
                    onChange={(e) => setFormData({ ...formData, frequencyLimit: e.target.value })}
                    placeholder="e.g., 1 per 30 days"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
            </>
          )}

          {/* Age and Gender Restrictions */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Age
              </label>
              <input
                type="number"
                value={formData.ageMinimum}
                onChange={(e) => setFormData({ ...formData, ageMinimum: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Age
              </label>
              <input
                type="number"
                value={formData.ageMaximum}
                onChange={(e) => setFormData({ ...formData, ageMaximum: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gender
              </label>
              <select
                value={formData.genderRestriction}
                onChange={(e) => setFormData({ ...formData, genderRestriction: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <option value="">Any</option>
                <option value="M">Male Only</option>
                <option value="F">Female Only</option>
              </select>
            </div>
          </div>

          {/* Documentation Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Documentation Notes
            </label>
            <textarea
              value={formData.documentationNotes}
              onChange={(e) => setFormData({ ...formData, documentationNotes: e.target.value })}
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
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || (!editingRule && !selectedCode)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingRule ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
