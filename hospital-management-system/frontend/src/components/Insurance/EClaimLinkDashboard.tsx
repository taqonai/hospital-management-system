import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PaperAirplaneIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface ClaimSubmission {
  id: string;
  claimNumber: string;
  eclaimLinkId?: string;
  eclaimLinkStatus?: string;
  submittedAt?: string;
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
  };
  claimAmount: number;
  payer?: {
    name: string;
    code: string;
  };
}

const EClaimLinkDashboard: React.FC = () => {
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch claims ready for submission
  const { data: claims, isLoading } = useQuery({
    queryKey: ['eclaimClaims'],
    queryFn: async () => {
      const response = await api.get('/billing/claims', {
        params: { status: 'SUBMITTED' },
      });
      return response.data.data;
    },
  });

  // Submit to eClaimLink mutation
  const submitMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const response = await api.post(
        `/billing/claims/${claimId}/submit-eclaim`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eclaimClaims'] });
    },
  });

  // Check status mutation
  const checkStatusMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const response = await api.get(`/billing/claims/${claimId}/eclaim-status`);
      return response.data;
    },
  });

  const getStatusBadge = (status?: string) => {
    if (!status) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <ClockIcon className="h-4 w-4" />
          Not Submitted
        </span>
      );
    }

    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      PENDING: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: ClockIcon,
      },
      SUBMITTED: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        icon: PaperAirplaneIcon,
      },
      ACCEPTED: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircleIcon,
      },
      REJECTED: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: XCircleIcon,
      },
      ERROR: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: ExclamationTriangleIcon,
      },
    };

    const badge = badges[status] || badges.PENDING;
    const Icon = badge.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
      >
        <Icon className="h-4 w-4" />
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          eClaimLink Submission Dashboard
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Submit and track insurance claims via DHA eClaimLink
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ready to Submit</p>
              <p className="text-2xl font-bold text-gray-900">
                {claims?.filter((c: any) => !c.eclaimLinkStatus).length || 0}
              </p>
            </div>
            <ClockIcon className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Submitted</p>
              <p className="text-2xl font-bold text-blue-600">
                {claims?.filter((c: any) => c.eclaimLinkStatus === 'SUBMITTED')
                  .length || 0}
              </p>
            </div>
            <PaperAirplaneIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Accepted</p>
              <p className="text-2xl font-bold text-green-600">
                {claims?.filter((c: any) => c.eclaimLinkStatus === 'ACCEPTED')
                  .length || 0}
              </p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected/Errors</p>
              <p className="text-2xl font-bold text-red-600">
                {claims?.filter(
                  (c: any) =>
                    c.eclaimLinkStatus === 'REJECTED' ||
                    c.eclaimLinkStatus === 'ERROR'
                ).length || 0}
              </p>
            </div>
            <XCircleIcon className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Claims Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading claims...</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Claim #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  eClaimLink Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DHA Claim ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {claims?.map((claim: any) => (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {claim.claimNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {claim.invoice?.patient?.firstName}{' '}
                      {claim.invoice?.patient?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      MRN: {claim.invoice?.patient?.mrn}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.insurancePayer?.name || claim.insuranceProvider}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    AED {Number(claim.claimAmount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(claim.eclaimLinkStatus)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.eclaimLinkId || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {!claim.eclaimLinkStatus && (
                      <button
                        onClick={() => submitMutation.mutate(claim.id)}
                        disabled={submitMutation.isPending}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                      >
                        {submitMutation.isPending ? (
                          <span className="flex items-center gap-1">
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            Submitting
                          </span>
                        ) : (
                          'Submit'
                        )}
                      </button>
                    )}
                    {claim.eclaimLinkId && (
                      <button
                        onClick={() => checkStatusMutation.mutate(claim.id)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Check Status
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {claims?.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No claims ready for submission
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Feature Flag Warning */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">eClaimLink API Integration</p>
            <p className="mt-1">
              This feature requires <code>ENABLE_ECLAIM_API_SUBMISSION</code> to
              be enabled in hospital settings. If disabled, XML will be generated
              but not submitted to DHA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EClaimLinkDashboard;
