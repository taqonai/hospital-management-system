import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface PreAuthRequest {
  id: string;
  requestNumber: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  procedureCPTCode: string;
  diagnosisICDCode: string;
  urgency: string;
  status: string;
  authorizationNumber?: string;
  approvedUnits?: number;
  denialReason?: string;
  createdAt: string;
}

const PreAuth: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const queryClient = useQueryClient();

  // Fetch pre-auth requests
  const { data: preAuthData, isLoading } = useQuery({
    queryKey: ['preAuthRequests', selectedStatus],
    queryFn: async () => {
      const params = selectedStatus !== 'all' ? { status: selectedStatus } : {};
      const response = await api.get('/pre-auth', { params });
      return response.data;
    },
  });

  // Create pre-auth mutation
  const createPreAuthMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/pre-auth', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preAuthRequests'] });
      setShowForm(false);
    },
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      PENDING: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: ClockIcon,
      },
      SUBMITTED: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        icon: ClockIcon,
      },
      APPROVED: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircleIcon,
      },
      DENIED: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: XCircleIcon,
      },
      EXPIRED: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        icon: XCircleIcon,
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

  const getUrgencyBadge = (urgency: string) => {
    const colors: Record<string, string> = {
      ROUTINE: 'bg-gray-100 text-gray-800',
      URGENT: 'bg-orange-100 text-orange-800',
      EMERGENCY: 'bg-red-100 text-red-800',
    };

    return (
      <span
        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
          colors[urgency] || colors.ROUTINE
        }`}
      >
        {urgency}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Pre-Authorization Requests
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage insurance pre-authorization requests for procedures
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5" />
            New Pre-Auth Request
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {['all', 'PENDING', 'APPROVED', 'DENIED'].map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              selectedStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Pre-Auth List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading pre-auth requests...</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Procedure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diagnosis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Urgency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auth #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {preAuthData?.data?.map((request: PreAuthRequest) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {request.requestNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {request.patient.firstName} {request.patient.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      MRN: {request.patient.mrn}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.procedureCPTCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.diagnosisICDCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getUrgencyBadge(request.urgency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.authorizationNumber || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {preAuthData?.data?.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No pre-authorization requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Form Modal (simplified - would be a separate component) */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">
              New Pre-Authorization Request
            </h2>
            <p className="text-gray-600 mb-4">
              Form implementation would go here...
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreAuth;
