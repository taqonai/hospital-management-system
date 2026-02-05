import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  IdentificationIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface PendingVerification {
  id: string;
  patientId: string;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    emiratesId?: string;
  };
  providerName: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberId: string;
  relationship: string;
  effectiveDate: string;
  expiryDate?: string;
  coverageType: string;
  isPrimary: boolean;
  createdAt: string;
  verificationStatus: string;
}

interface VerifyModalProps {
  insurance: PendingVerification | null;
  onClose: () => void;
  onVerify: (status: 'VERIFIED' | 'REJECTED', notes: string) => void;
  isLoading: boolean;
}

function VerifyModal({ insurance, onClose, onVerify, isLoading }: VerifyModalProps) {
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState<'VERIFIED' | 'REJECTED' | null>(null);

  if (!insurance) return null;

  const handleSubmit = () => {
    if (!action) {
      toast.error('Please select Verify or Reject');
      return;
    }
    onVerify(action, notes);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                  Verify Insurance
                </h3>
                
                {/* Patient Info */}
                <div className="mt-4 bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {insurance.patient.firstName} {insurance.patient.lastName}
                  </p>
                  <p className="text-xs text-gray-500">MRN: {insurance.patient.mrn}</p>
                  {insurance.patient.emiratesId && (
                    <p className="text-xs text-gray-500">EID: {insurance.patient.emiratesId}</p>
                  )}
                </div>

                {/* Insurance Info */}
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Provider:</span>
                    <span className="font-medium">{insurance.providerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Policy #:</span>
                    <span className="font-medium">{insurance.policyNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Member ID:</span>
                    <span className="font-medium">{insurance.subscriberId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Coverage:</span>
                    <span className="font-medium">{insurance.coverageType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Valid:</span>
                    <span className="font-medium">
                      {new Date(insurance.effectiveDate).toLocaleDateString()} 
                      {insurance.expiryDate && ` - ${new Date(insurance.expiryDate).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>

                {/* Action Selection */}
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAction('VERIFIED')}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors',
                      action === 'VERIFIED'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300'
                    )}
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('REJECTED')}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors',
                      action === 'REJECTED'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-red-300'
                    )}
                  >
                    <XCircleIcon className="h-5 w-5" />
                    Reject
                  </button>
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Notes {action === 'REJECTED' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder={action === 'VERIFIED' 
                      ? "e.g., Confirmed with Daman hotline, policy active"
                      : "e.g., Policy expired, invalid member ID"
                    }
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              disabled={isLoading || !action || (action === 'REJECTED' && !notes)}
              onClick={handleSubmit}
              className={clsx(
                'inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto',
                action === 'VERIFIED' 
                  ? 'bg-green-600 hover:bg-green-500 disabled:bg-green-300'
                  : action === 'REJECTED'
                    ? 'bg-red-600 hover:bg-red-500 disabled:bg-red-300'
                    : 'bg-gray-400',
                'disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? 'Processing...' : action === 'VERIFIED' ? 'Confirm Verification' : action === 'REJECTED' ? 'Confirm Rejection' : 'Select Action'}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PendingVerifications() {
  const queryClient = useQueryClient();
  const [selectedInsurance, setSelectedInsurance] = useState<PendingVerification | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch pending verifications
  const { data, isLoading, error } = useQuery({
    queryKey: ['pending-verifications'],
    queryFn: async () => {
      const response = await api.get('/insurance-advanced/verifications/pending');
      return response.data.data as { total: number; verifications: PendingVerification[] };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ patientId, insuranceId, status, notes }: {
      patientId: string;
      insuranceId: string;
      status: 'VERIFIED' | 'REJECTED';
      notes: string;
    }) => {
      return api.patch(`/patients/${patientId}/insurance/${insuranceId}/verify`, {
        status,
        notes,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Insurance ${variables.status.toLowerCase()} successfully`);
      queryClient.invalidateQueries({ queryKey: ['pending-verifications'] });
      setSelectedInsurance(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update verification status');
    },
  });

  const handleVerify = (status: 'VERIFIED' | 'REJECTED', notes: string) => {
    if (!selectedInsurance) return;
    
    verifyMutation.mutate({
      patientId: selectedInsurance.patientId,
      insuranceId: selectedInsurance.id,
      status,
      notes,
    });
  };

  // Filter verifications by search term
  const filteredVerifications = data?.verifications.filter(v => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      v.patient.firstName.toLowerCase().includes(search) ||
      v.patient.lastName.toLowerCase().includes(search) ||
      v.patient.mrn.toLowerCase().includes(search) ||
      v.providerName.toLowerCase().includes(search) ||
      v.policyNumber.toLowerCase().includes(search)
    );
  }) || [];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Failed to load pending verifications. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheckIcon className="h-7 w-7 text-blue-600" />
          Insurance Verification Queue
        </h1>
        <p className="text-gray-600 mt-1">
          Review and verify patient insurance policies
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center gap-3">
            <ClockIcon className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{data?.total || 0}</p>
              <p className="text-sm text-yellow-600">Pending Verification</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient name, MRN, or insurance..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Loading pending verifications...
          </div>
        ) : filteredVerifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ShieldCheckIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">No pending verifications</p>
            <p className="text-sm">All insurance policies have been verified</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Insurance Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Policy Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVerifications.map((verification) => (
                <tr key={verification.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {verification.patient.firstName} {verification.patient.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          MRN: {verification.patient.mrn}
                        </div>
                        {verification.patient.emiratesId && (
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <IdentificationIcon className="h-3 w-3" />
                            {verification.patient.emiratesId}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {verification.providerName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {verification.coverageType}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Policy: {verification.policyNumber}
                    </div>
                    <div className="text-sm text-gray-500">
                      Member: {verification.subscriberId}
                    </div>
                    {verification.groupNumber && (
                      <div className="text-xs text-gray-400">
                        Group: {verification.groupNumber}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(verification.createdAt).toLocaleDateString()}
                    <div className="text-xs text-gray-400">
                      {new Date(verification.createdAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <ClockIcon className="h-3 w-3 mr-1" />
                      Pending
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setSelectedInsurance(verification)}
                      className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      <ShieldCheckIcon className="h-4 w-4 mr-1" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Verify Modal */}
      <VerifyModal
        insurance={selectedInsurance}
        onClose={() => setSelectedInsurance(null)}
        onVerify={handleVerify}
        isLoading={verifyMutation.isPending}
      />
    </div>
  );
}
