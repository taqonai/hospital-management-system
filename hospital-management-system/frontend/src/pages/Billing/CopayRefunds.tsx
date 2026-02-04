import { useState, useEffect } from 'react';
import {
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  BanknotesIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { billingApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface CopayRefund {
  id: string;
  copayPaymentId: string;
  patientId: string;
  refundAmount: number;
  refundReason: string;
  reasonDetails?: string;
  refundMethod?: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSED' | 'REJECTED';
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  processedBy?: string;
  processedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  copayPayment?: {
    id: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    patient?: {
      firstName: string;
      lastName: string;
      mrn?: string;
    };
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: ClockIcon },
  APPROVED: { label: 'Approved', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircleIcon },
  PROCESSED: { label: 'Processed', color: 'bg-green-100 text-green-800 border-green-200', icon: BanknotesIcon },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircleIcon },
};

const reasonLabels: Record<string, string> = {
  APPOINTMENT_CANCELLED: 'Appointment Cancelled',
  INSURANCE_UPDATED: 'Insurance Updated',
  OVERCHARGE: 'Overcharge',
  DOCTOR_WAIVED: 'Doctor Waived',
  OTHER: 'Other',
};

const statusTabs = [
  { id: '', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'PROCESSED', label: 'Processed' },
  { id: 'REJECTED', label: 'Rejected' },
];

export default function CopayRefunds() {
  const { user } = useAuth();
  const [refunds, setRefunds] = useState<CopayRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [activeTab, setActiveTab] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    copayPaymentId: '',
    refundAmount: '',
    refundReason: 'APPOINTMENT_CANCELLED',
    reasonDetails: '',
    refundMethod: 'CASH',
  });

  const canApproveReject = user?.role === 'HOSPITAL_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ACCOUNTANT';
  const canDelete = user?.role === 'SUPER_ADMIN';
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;

  useEffect(() => {
    fetchRefunds();
  }, [pagination.page, activeTab]);

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (activeTab) params.status = activeTab;

      const response = await billingApi.listCopayRefunds(params);
      const data = response.data;
      setRefunds(data.data || []);
      if (data.pagination) {
        setPagination(prev => ({ ...prev, total: data.pagination.total || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch copay refunds:', error);
      toast.error('Failed to load copay refunds');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await billingApi.approveCopayRefund(id);
      toast.success('Refund approved');
      fetchRefunds();
    } catch (error) {
      console.error('Failed to approve refund:', error);
      toast.error('Failed to approve refund');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      setActionLoading(id);
      await billingApi.rejectCopayRefund(id, rejectionReason);
      toast.success('Refund rejected');
      setShowRejectModal(null);
      setRejectionReason('');
      fetchRefunds();
    } catch (error) {
      console.error('Failed to reject refund:', error);
      toast.error('Failed to reject refund');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProcess = async (id: string) => {
    try {
      setActionLoading(id);
      await billingApi.processCopayRefund(id);
      toast.success('Refund processed');
      fetchRefunds();
    } catch (error) {
      console.error('Failed to process refund:', error);
      toast.error('Failed to process refund');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this refund request?')) return;
    try {
      setActionLoading(id);
      await billingApi.rejectCopayRefund(id, 'Deleted by admin');
      toast.success('Refund deleted');
      fetchRefunds();
    } catch (error) {
      console.error('Failed to delete refund:', error);
      toast.error('Failed to delete refund');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestRefund = async () => {
    if (!requestForm.copayPaymentId.trim()) {
      toast.error('Copay Payment ID is required');
      return;
    }
    const amount = parseFloat(requestForm.refundAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }
    try {
      setActionLoading('request');
      await billingApi.requestCopayRefund({
        copayPaymentId: requestForm.copayPaymentId.trim(),
        refundAmount: amount,
        refundReason: requestForm.refundReason,
        reasonDetails: requestForm.reasonDetails || undefined,
        refundMethod: requestForm.refundMethod,
      });
      toast.success('Refund request submitted');
      setShowRequestModal(false);
      setRequestForm({ copayPaymentId: '', refundAmount: '', refundReason: 'APPOINTMENT_CANCELLED', reasonDetails: '', refundMethod: 'CASH' });
      fetchRefunds();
    } catch (error: any) {
      console.error('Failed to request refund:', error);
      toast.error(error?.response?.data?.message || 'Failed to submit refund request');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTJ2Mmgydi0yem0tNiAwSDI4djJoMnYtMnptMTIgMGgtMnYyaDJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Copay Refunds</h1>
            <p className="mt-2 text-white/80">Manage copay refund requests, approvals, and processing</p>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-white/90 text-orange-600 font-semibold rounded-xl transition-all"
          >
            <PlusIcon className="h-5 w-5" />
            Request Refund
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="relative backdrop-blur-xl bg-white/70 rounded-xl p-1.5 border border-gray-200/50">
        <nav className="flex space-x-1 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPagination(p => ({ ...p, page: 1 })); }}
              className={clsx(
                'relative py-2.5 px-4 font-medium text-sm whitespace-nowrap flex items-center gap-2 rounded-lg transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100/50'
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={fetchRefunds}
            className="p-2.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Refresh"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </nav>
      </div>

      {/* Refund List */}
      <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl border border-gray-200/50 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-200/40 to-transparent" />
        {loading ? (
          <div className="p-12 text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-orange-500" />
            <p className="mt-3 text-gray-500">Loading refunds...</p>
          </div>
        ) : refunds.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowUturnLeftIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No copay refunds found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200/50">
            {refunds.map((refund) => {
              const config = statusConfig[refund.status] || statusConfig.PENDING;
              const StatusIcon = config.icon;
              return (
                <div key={refund.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          AED {Number(refund.refundAmount || 0).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(refund.requestedAt).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {refund.copayPayment?.patient && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{refund.copayPayment.patient.firstName} {refund.copayPayment.patient.lastName}</span>
                            {refund.copayPayment.patient.mrn && (
                              <span className="text-gray-400 ml-2">MRN: {refund.copayPayment.patient.mrn}</span>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Reason: {reasonLabels[refund.refundReason] || refund.refundReason}
                          {refund.reasonDetails && <span className="ml-1">— {refund.reasonDetails}</span>}
                        </p>
                        {refund.copayPayment && (
                          <p className="text-xs text-gray-400">
                            Original payment: AED {Number(refund.copayPayment.amount || 0).toFixed(2)} via {refund.copayPayment.paymentMethod}
                          </p>
                        )}
                        {refund.rejectionReason && (
                          <p className="text-xs text-red-600">Rejection: {refund.rejectionReason}</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons — visible only to HOSPITAL_ADMIN and SUPER_ADMIN */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {refund.status === 'PENDING' && canApproveReject && (
                        <>
                          <button
                            onClick={() => handleApprove(refund.id)}
                            disabled={actionLoading === refund.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setShowRejectModal(refund.id)}
                            disabled={actionLoading === refund.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {refund.status === 'APPROVED' && canApproveReject && (
                        <button
                          onClick={() => handleProcess(refund.id)}
                          disabled={actionLoading === refund.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                        >
                          Process Refund
                        </button>
                      )}
                      {canDelete && refund.status === 'PENDING' && (
                        <button
                          onClick={() => handleDelete(refund.id)}
                          disabled={actionLoading === refund.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Delete refund request"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200/50">
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {totalPages} ({pagination.total} refunds)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Request Refund Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Request Copay Refund</h3>
            <p className="mt-1 text-sm text-gray-500">Submit a refund request for a collected copay payment.</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Copay Payment ID</label>
                <input
                  type="text"
                  value={requestForm.copayPaymentId}
                  onChange={(e) => setRequestForm(f => ({ ...f, copayPaymentId: e.target.value }))}
                  placeholder="Enter the copay payment ID..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={requestForm.refundAmount}
                  onChange={(e) => setRequestForm(f => ({ ...f, refundAmount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={requestForm.refundReason}
                  onChange={(e) => setRequestForm(f => ({ ...f, refundReason: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="APPOINTMENT_CANCELLED">Appointment Cancelled</option>
                  <option value="INSURANCE_UPDATED">Insurance Updated</option>
                  <option value="OVERCHARGE">Overcharge</option>
                  <option value="DOCTOR_WAIVED">Doctor Waived</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Details (optional)</label>
                <textarea
                  value={requestForm.reasonDetails}
                  onChange={(e) => setRequestForm(f => ({ ...f, reasonDetails: e.target.value }))}
                  placeholder="Provide additional context..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Method</label>
                <select
                  value={requestForm.refundMethod}
                  onChange={(e) => setRequestForm(f => ({ ...f, refundMethod: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="DEPOSIT">Patient Deposit</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRefund}
                disabled={actionLoading === 'request'}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
              >
                {actionLoading === 'request' ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Reject Refund</h3>
            <p className="mt-1 text-sm text-gray-500">Please provide a reason for rejection.</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={3}
              className="mt-4 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setShowRejectModal(null); setRejectionReason(''); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={actionLoading === showRejectModal}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
