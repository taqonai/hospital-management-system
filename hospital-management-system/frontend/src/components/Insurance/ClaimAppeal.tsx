import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  DocumentArrowUpIcon,
  ExclamationCircleIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface ClaimAppealProps {
  claimId: string;
  claimNumber: string;
  claimAmount: number;
  denialReasonCode?: string;
  onSuccess?: () => void;
}

const ClaimAppeal: React.FC<ClaimAppealProps> = ({
  claimId,
  claimNumber,
  claimAmount,
  denialReasonCode,
  onSuccess,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    resubmissionCode: '',
    appealNotes: '',
    updatedClaimAmount: claimAmount,
    appealDocumentUrl: '',
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const queryClient = useQueryClient();

  // Fetch appeal history
  const { data: appealHistory } = useQuery({
    queryKey: ['claimAppealHistory', claimId],
    queryFn: async () => {
      const response = await api.get(`/billing/claims/${claimId}/appeal-history`);
      return response.data.data;
    },
  });

  // Create appeal mutation
  const createAppealMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/billing/claims/${claimId}/appeal`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['claimAppealHistory', claimId] });
      setShowForm(false);
      if (onSuccess) onSuccess();
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Upload to storage service
      const response = await api.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFormData((prev) => ({
        ...prev,
        appealDocumentUrl: response.data.data.url,
      }));
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAppealMutation.mutate(formData);
  };

  const resubmissionCodes = [
    { value: 'ADDITIONAL_INFO', label: 'Additional Information Provided' },
    { value: 'CODING_ERROR', label: 'Coding Error Correction' },
    { value: 'MEDICAL_NECESSITY', label: 'Medical Necessity Documentation' },
    { value: 'PRE_AUTH_OBTAINED', label: 'Pre-Authorization Obtained' },
    { value: 'POLICY_REVIEW', label: 'Policy Coverage Review' },
    { value: 'OTHER', label: 'Other' },
  ];

  return (
    <div>
      {/* Appeal Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <ExclamationCircleIcon className="h-5 w-5" />
          Appeal Claim
        </button>
      )}

      {/* Appeal Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Appeal Rejected Claim
          </h3>

          {/* Original Claim Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Original Claim:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {claimNumber}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Claim Amount:</span>
                <span className="ml-2 font-medium text-gray-900">
                  AED {claimAmount.toFixed(2)}
                </span>
              </div>
              {denialReasonCode && (
                <div className="col-span-2">
                  <span className="text-gray-600">Denial Reason:</span>
                  <span className="ml-2 font-medium text-red-600">
                    {denialReasonCode}
                  </span>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Resubmission Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Appeal <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.resubmissionCode}
                onChange={(e) =>
                  setFormData({ ...formData, resubmissionCode: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select reason...</option>
                {resubmissionCodes.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Appeal Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appeal Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.appealNotes}
                onChange={(e) =>
                  setFormData({ ...formData, appealNotes: e.target.value })
                }
                required
                rows={4}
                placeholder="Provide detailed justification for the appeal..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Updated Claim Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Updated Claim Amount (if different)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.updatedClaimAmount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    updatedClaimAmount: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Document Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supporting Documentation
              </label>
              <div className="mt-1 flex items-center gap-4">
                <label className="relative cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <span className="flex items-center gap-2">
                    <DocumentArrowUpIcon className="h-5 w-5 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {uploadingDoc ? 'Uploading...' : 'Upload File'}
                    </span>
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={uploadingDoc}
                  />
                </label>
                {formData.appealDocumentUrl && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>Document uploaded</span>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                PDF, JPG, or PNG. Max 10MB.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createAppealMutation.isPending}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createAppealMutation.isPending
                  ? 'Submitting...'
                  : 'Submit Appeal'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Appeal History */}
      {appealHistory && appealHistory.length > 1 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Appeal History
          </h4>
          <div className="space-y-3">
            {appealHistory.map((claim: any, index: number) => (
              <div
                key={claim.id}
                className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {claim.status === 'APPROVED' && (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  )}
                  {claim.status === 'REJECTED' && (
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                  )}
                  {claim.status === 'SUBMITTED' && (
                    <ClockIcon className="h-5 w-5 text-blue-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {claim.claimNumber} ({claim.type})
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(claim.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Status: <span className="font-medium">{claim.status}</span> •
                    Amount: AED {Number(claim.claimAmount).toFixed(2)}
                  </p>
                  {claim.appealNotes && (
                    <p className="text-xs text-gray-500 mt-1">
                      {claim.appealNotes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimAppeal;
