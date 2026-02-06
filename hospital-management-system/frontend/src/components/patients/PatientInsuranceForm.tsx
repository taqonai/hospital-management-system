import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { XMarkIcon, PlusIcon, TrashIcon, ShieldCheckIcon, ShieldExclamationIcon, ClockIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import axios from 'axios';
import { insuranceProviderApi } from '../../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface InsuranceProvider {
  id: string;
  name: string;
  licenseNumber?: string;
}

interface InsurancePayer {
  id: string;
  name: string;
  code: string;
}

interface PatientInsurance {
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
  deductible?: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  // Verification fields
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedAt?: string;
  verificationNotes?: string;
}

interface PatientInsuranceFormProps {
  patientId: string;
}

export default function PatientInsuranceForm({ patientId }: PatientInsuranceFormProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    payerId: '',
    providerName: '',
    policyNumber: '',
    groupNumber: '',
    subscriberName: '',
    subscriberId: '',
    relationship: 'Self',
    effectiveDate: '',
    expiryDate: '',
    coverageType: 'Basic',
    copay: '',
    deductible: '',
    isPrimary: true,
  });

  // Fetch insurance providers from InsuranceProvider master
  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['insurance-providers-active'],
    queryFn: () => insuranceProviderApi.getActive(),
    staleTime: 5 * 60 * 1000,
  });
  const providers: InsuranceProvider[] = providersData?.data?.data || providersData?.data || [];

  // Fetch patient insurances
  const { data: insurances, isLoading: insurancesLoading } = useQuery<PatientInsurance[]>({
    queryKey: ['patient-insurances', patientId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/v1/patients/${patientId}/insurance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data;
    },
    enabled: !!patientId,
  });

  // Add insurance mutation
  const addInsuranceMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('token');
      return axios.post(`/api/v1/patients/${patientId}/insurance`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-insurances', patientId] });
      toast.success('Insurance added successfully');
      setShowForm(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add insurance');
    },
  });

  // Delete insurance mutation
  const deleteInsuranceMutation = useMutation({
    mutationFn: async (insuranceId: string) => {
      const token = localStorage.getItem('token');
      return axios.delete(`/api/v1/patients/${patientId}/insurance/${insuranceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-insurances', patientId] });
      toast.success('Insurance deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete insurance');
    },
  });

  // Get user role for admin verification buttons
  const { user } = useSelector((state: RootState) => state.auth);
  const isAdmin = user?.role === 'HOSPITAL_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Manual verification mutation (admin only)
  const verifyInsuranceMutation = useMutation({
    mutationFn: async ({ insuranceId, status, notes }: { insuranceId: string; status: 'VERIFIED' | 'REJECTED'; notes?: string }) => {
      const token = localStorage.getItem('token');
      return axios.post(`/api/v1/insurance-coding/insurance/${insuranceId}/verify`, 
        { status, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-insurances', patientId] });
      toast.success(`Insurance ${variables.status.toLowerCase()} successfully`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update verification status');
    },
  });

  // Reset verification mutation (admin only)
  const resetVerificationMutation = useMutation({
    mutationFn: async (insuranceId: string) => {
      const token = localStorage.getItem('token');
      return axios.post(`/api/v1/insurance-coding/insurance/${insuranceId}/reset-verification`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-insurances', patientId] });
      toast.success('Verification status reset to pending');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reset verification');
    },
  });

  const handleVerify = (insuranceId: string, status: 'VERIFIED' | 'REJECTED') => {
    const notes = status === 'REJECTED' 
      ? prompt('Reason for rejection (optional):') || undefined
      : undefined;
    verifyInsuranceMutation.mutate({ insuranceId, status, notes });
  };

  const resetForm = () => {
    setFormData({
      payerId: '',
      providerName: '',
      policyNumber: '',
      groupNumber: '',
      subscriberName: '',
      subscriberId: '',
      relationship: 'Self',
      effectiveDate: '',
      expiryDate: '',
      coverageType: 'Basic',
      copay: '',
      deductible: '',
      isPrimary: insurances?.length === 0,
    });
  };

  const handlePayerChange = (payerId: string) => {
    const provider = providers.find((p) => p.id === payerId);
    setFormData({
      ...formData,
      payerId,
      providerName: provider?.name || '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      providerName: formData.providerName,
      policyNumber: formData.policyNumber,
      groupNumber: formData.groupNumber || undefined,
      subscriberName: formData.subscriberName,
      subscriberId: formData.subscriberId,
      relationship: formData.relationship,
      effectiveDate: new Date(formData.effectiveDate).toISOString(),
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : undefined,
      coverageType: formData.coverageType,
      copay: formData.copay ? parseFloat(formData.copay) : undefined,
      deductible: formData.deductible ? parseFloat(formData.deductible) : undefined,
      isPrimary: formData.isPrimary,
    };

    addInsuranceMutation.mutate(submitData);
  };

  const handleDelete = (insuranceId: string) => {
    if (confirm('Are you sure you want to delete this insurance record?')) {
      deleteInsuranceMutation.mutate(insuranceId);
    }
  };

  if (insurancesLoading || providersLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Insurance Coverage</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Insurance
          </button>
        )}
      </div>

      {/* Add Insurance Form */}
      {showForm && (
        <div className="card p-6 border-2 border-primary-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Add New Insurance</h3>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Insurance Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance Provider *
                </label>
                <select
                  value={formData.payerId}
                  onChange={(e) => handlePayerChange(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select Provider</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Policy Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Number *
                </label>
                <input
                  type="text"
                  value={formData.policyNumber}
                  onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                  className="input"
                  required
                />
              </div>

              {/* Group Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Number
                </label>
                <input
                  type="text"
                  value={formData.groupNumber}
                  onChange={(e) => setFormData({ ...formData, groupNumber: e.target.value })}
                  className="input"
                />
              </div>

              {/* Subscriber Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscriber Name *
                </label>
                <input
                  type="text"
                  value={formData.subscriberName}
                  onChange={(e) => setFormData({ ...formData, subscriberName: e.target.value })}
                  className="input"
                  required
                />
              </div>

              {/* Subscriber ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscriber ID *
                </label>
                <input
                  type="text"
                  value={formData.subscriberId}
                  onChange={(e) => setFormData({ ...formData, subscriberId: e.target.value })}
                  className="input"
                  required
                />
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship to Subscriber *
                </label>
                <select
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  className="input"
                  required
                >
                  <option value="Self">Self</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Child">Child</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Effective Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective Date *
                </label>
                <input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  className="input"
                  required
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="input"
                />
              </div>

              {/* Coverage Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coverage Type *
                </label>
                <select
                  value={formData.coverageType}
                  onChange={(e) => setFormData({ ...formData, coverageType: e.target.value })}
                  className="input"
                  required
                >
                  <option value="Basic">Basic</option>
                  <option value="Enhanced">Enhanced</option>
                  <option value="VIP">VIP</option>
                  <option value="Comprehensive">Comprehensive</option>
                </select>
              </div>

              {/* Copay Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Copay Amount (AED)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.copay}
                  onChange={(e) => setFormData({ ...formData, copay: e.target.value })}
                  className="input"
                  placeholder="e.g., 20.00"
                />
              </div>

              {/* Deductible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deductible (AED)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.deductible}
                  onChange={(e) => setFormData({ ...formData, deductible: e.target.value })}
                  className="input"
                  placeholder="e.g., 500.00"
                />
              </div>

              {/* Is Primary */}
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isPrimary}
                    onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    This is the primary insurance
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addInsuranceMutation.isPending}
                className="btn-primary"
              >
                {addInsuranceMutation.isPending ? 'Saving...' : 'Save Insurance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Insurance List */}
      {insurances && insurances.length > 0 ? (
        <div className="space-y-4">
          {insurances.map((insurance) => (
            <div
              key={insurance.id}
              className={`card p-6 ${
                insurance.isPrimary ? 'border-2 border-primary-300 bg-primary-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {insurance.providerName}
                    </h3>
                    {insurance.isPrimary && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-800">
                        Primary
                      </span>
                    )}
                    {!insurance.isActive && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                    {/* Verification Status Badge */}
                    {insurance.verificationStatus === 'VERIFIED' && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                        <ShieldCheckIcon className="h-3 w-3" /> Verified
                      </span>
                    )}
                    {insurance.verificationStatus === 'REJECTED' && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                        <ShieldExclamationIcon className="h-3 w-3" /> Rejected
                      </span>
                    )}
                    {(!insurance.verificationStatus || insurance.verificationStatus === 'PENDING') && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Policy Number:</span>
                      <p className="font-medium">{insurance.policyNumber}</p>
                    </div>
                    {insurance.groupNumber && (
                      <div>
                        <span className="text-gray-500">Group Number:</span>
                        <p className="font-medium">{insurance.groupNumber}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Subscriber:</span>
                      <p className="font-medium">{insurance.subscriberName}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Subscriber ID:</span>
                      <p className="font-medium">{insurance.subscriberId}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Relationship:</span>
                      <p className="font-medium">{insurance.relationship}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Coverage Type:</span>
                      <p className="font-medium">{insurance.coverageType}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Effective Date:</span>
                      <p className="font-medium">
                        {format(new Date(insurance.effectiveDate), 'dd MMM yyyy')}
                      </p>
                    </div>
                    {insurance.expiryDate && (
                      <div>
                        <span className="text-gray-500">Expiry Date:</span>
                        <p className="font-medium">
                          {format(new Date(insurance.expiryDate), 'dd MMM yyyy')}
                        </p>
                      </div>
                    )}
                    {insurance.copay && (
                      <div>
                        <span className="text-gray-500">Copay:</span>
                        <p className="font-medium">AED {insurance.copay}</p>
                      </div>
                    )}
                    {insurance.deductible && (
                      <div>
                        <span className="text-gray-500">Deductible:</span>
                        <p className="font-medium">AED {insurance.deductible}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Admin Verification Buttons */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 mr-2 border-r pr-2">
                      {insurance.verificationStatus !== 'VERIFIED' && (
                        <button
                          onClick={() => handleVerify(insurance.id, 'VERIFIED')}
                          disabled={verifyInsuranceMutation.isPending}
                          className="text-green-600 hover:text-green-800 p-1.5 rounded hover:bg-green-50"
                          title="Mark as Verified"
                        >
                          <ShieldCheckIcon className="h-5 w-5" />
                        </button>
                      )}
                      {insurance.verificationStatus !== 'REJECTED' && (
                        <button
                          onClick={() => handleVerify(insurance.id, 'REJECTED')}
                          disabled={verifyInsuranceMutation.isPending}
                          className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50"
                          title="Mark as Rejected"
                        >
                          <ShieldExclamationIcon className="h-5 w-5" />
                        </button>
                      )}
                      {insurance.verificationStatus && insurance.verificationStatus !== 'PENDING' && (
                        <button
                          onClick={() => resetVerificationMutation.mutate(insurance.id)}
                          disabled={resetVerificationMutation.isPending}
                          className="text-gray-500 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100"
                          title="Reset to Pending"
                        >
                          <ClockIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(insurance.id)}
                    disabled={deleteInsuranceMutation.isPending}
                    className="text-red-600 hover:text-red-800 p-2"
                    title="Delete insurance"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">No insurance coverage found</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              Add Insurance Coverage
            </button>
          </div>
        )
      )}
    </div>
  );
}
