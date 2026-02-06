import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheckIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CameraIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi, insuranceProviderApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface InsurancePolicy {
  id: string;
  providerName: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberId: string;
  relationship: string;
  effectiveDate: string;
  expiryDate?: string;
  coverageType: string;
  copay?: number;
  copayPercentage?: number;
  networkTier: string;
  isPrimary: boolean;
  isActive: boolean;
  cardFrontUrl?: string;
  cardBackUrl?: string;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

interface InsuranceFormData {
  providerName: string;
  policyNumber: string;
  groupNumber: string;
  subscriberName: string;
  subscriberId: string;
  relationship: string;
  effectiveDate: string;
  expiryDate: string;
  coverageType: string;
  isPrimary: boolean;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'Self', label: 'Self (Primary Holder)' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Child', label: 'Child' },
  { value: 'Parent', label: 'Parent' },
  { value: 'Other', label: 'Other Dependent' },
];

const COVERAGE_TYPES = [
  { value: 'Basic', label: 'Basic (DHA Essential)' },
  { value: 'Enhanced', label: 'Enhanced' },
  { value: 'VIP', label: 'VIP / Executive' },
  { value: 'International', label: 'International' },
];

// Insurance providers fetched from API

const emptyForm: InsuranceFormData = {
  providerName: '',
  policyNumber: '',
  groupNumber: '',
  subscriberName: '',
  subscriberId: '',
  relationship: 'Self',
  effectiveDate: '',
  expiryDate: '',
  coverageType: 'Basic',
  isPrimary: false,
};

export default function PatientPortalInsurance() {
  const queryClient = useQueryClient();

  // Fetch active insurance providers from API
  const { data: providersData } = useQuery({
    queryKey: ['insurance-providers-active'],
    queryFn: () => insuranceProviderApi.getActive(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  const insuranceProviders = providersData?.data || [];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InsuranceFormData>(emptyForm);
  const [customProvider, setCustomProvider] = useState(false);

  // Fetch insurance policies
  const { data: insuranceData, isLoading } = useQuery({
    queryKey: ['patient-insurance'],
    queryFn: async () => {
      const response = await patientPortalApi.getInsurance();
      return response.data.data as InsurancePolicy[];
    },
  });

  // Add insurance mutation
  const addInsurance = useMutation({
    mutationFn: async (data: InsuranceFormData) => {
      return patientPortalApi.addInsurance(data);
    },
    onSuccess: () => {
      toast.success('Insurance added successfully! Pending verification.');
      queryClient.invalidateQueries({ queryKey: ['patient-insurance'] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add insurance');
    },
  });

  // Update insurance mutation
  const updateInsurance = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsuranceFormData }) => {
      return patientPortalApi.updateInsurance(id, data);
    },
    onSuccess: () => {
      toast.success('Insurance updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['patient-insurance'] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update insurance');
    },
  });

  // Delete insurance mutation
  const deleteInsurance = useMutation({
    mutationFn: async (id: string) => {
      return patientPortalApi.deleteInsurance(id);
    },
    onSuccess: () => {
      toast.success('Insurance removed');
      queryClient.invalidateQueries({ queryKey: ['patient-insurance'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove insurance');
    },
  });

  // Set as primary mutation
  const setPrimary = useMutation({
    mutationFn: async (id: string) => {
      return patientPortalApi.setPrimaryInsurance(id);
    },
    onSuccess: () => {
      toast.success('Primary insurance updated');
      queryClient.invalidateQueries({ queryKey: ['patient-insurance'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to set primary insurance');
    },
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setCustomProvider(false);
  };

  const handleEdit = (policy: InsurancePolicy) => {
    setFormData({
      providerName: policy.providerName,
      policyNumber: policy.policyNumber,
      groupNumber: policy.groupNumber || '',
      subscriberName: policy.subscriberName,
      subscriberId: policy.subscriberId,
      relationship: policy.relationship,
      effectiveDate: policy.effectiveDate.split('T')[0],
      expiryDate: policy.expiryDate ? policy.expiryDate.split('T')[0] : '',
      coverageType: policy.coverageType,
      isPrimary: policy.isPrimary,
    });
    setCustomProvider(!insuranceProviders.some((p: { name: string }) => p.name === policy.providerName));
    setEditingId(policy.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.providerName || !formData.policyNumber || !formData.subscriberName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingId) {
      updateInsurance.mutate({ id: editingId, data: formData });
    } else {
      addInsurance.mutate(formData);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Verified
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XMarkIcon className="h-3.5 w-3.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Pending
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const policies = insuranceData || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Information</h1>
          <p className="text-gray-600 mt-1">Manage your health insurance policies</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all"
          >
            <PlusIcon className="h-5 w-5" />
            Add Insurance
          </button>
        )}
      </div>

      {/* DHA Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">UAE Health Insurance Requirement</h3>
            <p className="text-sm text-blue-700 mt-1">
              All UAE residents are required to have valid health insurance. Adding your insurance 
              information helps us verify coverage and process claims faster during your visits.
            </p>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Insurance Policy' : 'Add New Insurance Policy'}
            </h2>
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Insurance Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Insurance Provider <span className="text-red-500">*</span>
              </label>
              {!customProvider ? (
                <div className="space-y-2">
                  <select
                    value={formData.providerName}
                    onChange={(e) => {
                      if (e.target.value === 'Other') {
                        setCustomProvider(true);
                        setFormData({ ...formData, providerName: '' });
                      } else {
                        setFormData({ ...formData, providerName: e.target.value });
                      }
                    }}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  >
                    <option value="">Select insurance provider...</option>
                    {insuranceProviders.map((provider: { id: string; name: string }) => (
                      <option key={provider.id} value={provider.name}>{provider.name}</option>
                    ))}
                    <option value="Other">Other (Not Listed)</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.providerName}
                    onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                    placeholder="Enter insurance provider name"
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomProvider(false);
                      setFormData({ ...formData, providerName: '' });
                    }}
                    className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    Choose from list
                  </button>
                </div>
              )}
            </div>

            {/* Policy & Group Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Policy Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.policyNumber}
                  onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                  placeholder="e.g., POL-123456789"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Number (if applicable)
                </label>
                <input
                  type="text"
                  value={formData.groupNumber}
                  onChange={(e) => setFormData({ ...formData, groupNumber: e.target.value })}
                  placeholder="e.g., GRP-001"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            {/* Subscriber Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscriber Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subscriberName}
                  onChange={(e) => setFormData({ ...formData, subscriberName: e.target.value })}
                  placeholder="Name on insurance card"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Member / Subscriber ID
                </label>
                <input
                  type="text"
                  value={formData.subscriberId}
                  onChange={(e) => setFormData({ ...formData, subscriberId: e.target.value })}
                  placeholder="Member ID on card"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            {/* Relationship & Coverage Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship to Subscriber
                </label>
                <select
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coverage Type
                </label>
                <select
                  value={formData.coverageType}
                  onChange={(e) => setFormData({ ...formData, coverageType: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {COVERAGE_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            {/* Primary Insurance Toggle */}
            {policies.length > 0 && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPrimary" className="text-sm text-gray-700">
                  Set as primary insurance (used first for claims)
                </label>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addInsurance.isPending || updateInsurance.isPending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(addInsurance.isPending || updateInsurance.isPending) && (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                )}
                {editingId ? 'Update Insurance' : 'Add Insurance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Insurance Cards List */}
      {policies.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
          <ShieldCheckIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Insurance on File</h3>
          <p className="text-gray-500 mb-6">
            Add your insurance information to streamline your visits and enable faster claims processing.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all"
          >
            <PlusIcon className="h-5 w-5" />
            Add Your Insurance
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className={clsx(
                'bg-white rounded-xl shadow-lg border-2 p-6 transition-all',
                policy.isPrimary ? 'border-blue-300 bg-gradient-to-br from-blue-50/50 to-white' : 'border-gray-200'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={clsx(
                    'p-3 rounded-xl',
                    policy.isPrimary ? 'bg-blue-100' : 'bg-gray-100'
                  )}>
                    <ShieldCheckIcon className={clsx(
                      'h-6 w-6',
                      policy.isPrimary ? 'text-blue-600' : 'text-gray-500'
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{policy.providerName}</h3>
                      {policy.isPrimary && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Primary
                        </span>
                      )}
                      {getStatusBadge(policy.verificationStatus)}
                    </div>
                    <p className="text-sm text-gray-600">
                      Policy: {policy.policyNumber}
                      {policy.groupNumber && ` | Group: ${policy.groupNumber}`}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {policy.subscriberName} ({policy.relationship}) | {policy.coverageType}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Valid: {new Date(policy.effectiveDate).toLocaleDateString()}
                      {policy.expiryDate && ` - ${new Date(policy.expiryDate).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!policy.isPrimary && (
                    <button
                      onClick={() => setPrimary.mutate(policy.id)}
                      disabled={setPrimary.isPending}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(policy)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this insurance?')) {
                        deleteInsurance.mutate(policy.id);
                      }
                    }}
                    disabled={deleteInsurance.isPending}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Network & Coverage Info */}
              {policy.networkTier && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6">
                  <div className="text-sm">
                    <span className="text-gray-500">Network:</span>
                    <span className={clsx(
                      'ml-2 font-medium',
                      policy.networkTier === 'IN_NETWORK' ? 'text-green-600' : 'text-orange-600'
                    )}>
                      {policy.networkTier === 'IN_NETWORK' ? '✅ In-Network' : '⚠️ Out-of-Network'}
                    </span>
                  </div>
                  {policy.copayPercentage && (
                    <div className="text-sm">
                      <span className="text-gray-500">Copay:</span>
                      <span className="ml-2 font-medium text-gray-900">{policy.copayPercentage}%</span>
                    </div>
                  )}
                  {policy.copay && (
                    <div className="text-sm">
                      <span className="text-gray-500">Fixed Copay:</span>
                      <span className="ml-2 font-medium text-gray-900">AED {policy.copay}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
        <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
          <IdentificationIcon className="h-5 w-5" />
          Tips for Insurance Information
        </h3>
        <ul className="text-sm text-purple-800 space-y-2">
          <li>• Have your insurance card ready when adding new insurance</li>
          <li>• The policy number is usually on the front of your card</li>
          <li>• Set your most comprehensive plan as the primary insurance</li>
          <li>• Update your insurance before it expires to avoid coverage gaps</li>
          <li>• Staff will verify your insurance at check-in using your Emirates ID</li>
        </ul>
      </div>
    </div>
  );
}
