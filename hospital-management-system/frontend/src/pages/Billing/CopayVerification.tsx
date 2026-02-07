/**
 * Copay Verification Dashboard - Phase 3: Staff Automation + System-Level Features
 * Staff-side verification for patient copay payments with auto-verification
 */
import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Dialog, Transition, Tab } from '@headlessui/react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CreditCardIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  FunnelIcon,
  EyeIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  UserIcon,
  PhoneIcon,
  CalendarDaysIcon,
  BellAlertIcon,
  ChevronDownIcon,
  XMarkIcon,
  CheckBadgeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';
import { CurrencyDisplay } from '../../components/common';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

// Types
interface CopayAppointment {
  appointment: {
    id: string;
    patientId: string;
    patientName: string;
    mrn: string;
    phone?: string;
    doctorName: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    tokenNumber?: number;
    checkedInAt?: string;
  };
  paymentStatus: 'pending' | 'pay_at_clinic' | 'paid_online' | 'paid_cash' | 'refunded';
  copayAmount: number;
  paidAmount?: number;
  paymentMethod?: string;
  paidAt?: string;
  transactionId?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationStatus?: 'pending' | 'verified' | 'mismatch' | 'fraud_alert' | 'underpayment' | 'overpayment' | 'auto_verified';
  verificationFlag?: string;
  copayWaived?: boolean;
}

interface PendingVerification {
  appointmentId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  doctorName: string;
  appointmentDate: string;
  expectedAmount: number;
  paidAmount: number;
  difference: number;
  amountMatches: boolean;
  paymentMethod?: string;
  paidAt?: string;
  verificationStatus?: string;
  verificationFlag?: string;
  autoVerified?: boolean;
}

interface VerificationAction {
  appointmentId: string;
  action: 'verify' | 'mark_incorrect' | 'convert_selfpay' | 'flag_fraud' | 'request_refund';
  reason?: string;
  notes?: string;
}

// Payment Status Config
const paymentStatusConfig = {
  pending: { 
    label: 'Pending', 
    bg: 'bg-amber-100', 
    text: 'text-amber-700', 
    icon: ClockIcon,
    dot: 'bg-amber-500'
  },
  pay_at_clinic: { 
    label: 'Cash Due', 
    bg: 'bg-blue-100', 
    text: 'text-blue-700', 
    icon: BanknotesIcon,
    dot: 'bg-blue-500'
  },
  paid_online: { 
    label: 'Paid Online', 
    bg: 'bg-green-100', 
    text: 'text-green-700', 
    icon: CreditCardIcon,
    dot: 'bg-green-500'
  },
  paid_cash: { 
    label: 'Paid Cash', 
    bg: 'bg-emerald-100', 
    text: 'text-emerald-700', 
    icon: BanknotesIcon,
    dot: 'bg-emerald-500'
  },
  refunded: { 
    label: 'Refunded', 
    bg: 'bg-gray-100', 
    text: 'text-gray-700', 
    icon: ArrowPathIcon,
    dot: 'bg-gray-500'
  },
};

const verificationStatusConfig = {
  pending: { label: 'Pending Verification', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: ClockIcon },
  verified: { label: 'Verified', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircleIcon },
  auto_verified: { label: 'Auto-Verified', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: SparklesIcon },
  mismatch: { label: 'Amount Mismatch', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: ExclamationTriangleIcon },
  underpayment: { label: 'Underpayment', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: ArrowTrendingDownIcon },
  overpayment: { label: 'Overpayment', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: ArrowTrendingUpIcon },
  fraud_alert: { label: 'Fraud Alert', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: ShieldExclamationIcon },
};

// Staff Copay API
const staffCopayApi = {
  getCheckInAppointments: (params?: { date?: string; doctorId?: string }) =>
    api.get('/staff/checkin/appointments', { params }),
  getPaymentSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/staff/payment-summary', { params }),
  collectPayment: (appointmentId: string, data: { amount: number; paymentMethod: 'CASH' | 'CARD'; notes?: string }) =>
    api.post(`/staff/checkin/appointments/${appointmentId}/collect-payment`, data),
  verifyPayment: (appointmentId: string, data: VerificationAction) =>
    api.post(`/staff/checkin/appointments/${appointmentId}/verify`, data),
  quickVerify: (appointmentId: string) =>
    api.post(`/staff/checkin/appointments/${appointmentId}/quick-verify`),
  getAuditLog: (appointmentId: string) =>
    api.get(`/staff/checkin/appointments/${appointmentId}/audit-log`),
  getPendingVerifications: (filter?: 'all' | 'pending' | 'flagged') =>
    api.get('/staff/copay/pending-verifications', { params: { filter } }),
  getMismatchAlerts: () =>
    api.get('/staff/copay/mismatch-alerts'),
  getDailyReconciliation: (date?: string) =>
    api.get('/staff/copay/daily-reconciliation', { params: { date } }),
};

export default function CopayVerification() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedAppointment, setSelectedAppointment] = useState<CopayAppointment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  // Payment collection state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Verification state
  const [verificationAction, setVerificationAction] = useState<string>('');
  const [verificationReason, setVerificationReason] = useState('');

  const queryClient = useQueryClient();

  // Fetch today's appointments with payment status
  const { data: appointmentsData, isLoading, refetch } = useQuery({
    queryKey: ['staff-checkin-appointments', selectedDate],
    queryFn: async () => {
      const response = await staffCopayApi.getCheckInAppointments({ date: selectedDate });
      return response.data?.data || response.data;
    },
  });

  const appointments = appointmentsData?.appointments || [];
  const summary = appointmentsData?.summary || { total: 0, paid: 0, cashDue: 0, pending: 0, pendingVerification: 0, flagged: 0 };

  // Fetch pending verifications (Phase 3 Feature #1)
  const { data: pendingVerifications, refetch: refetchPending } = useQuery({
    queryKey: ['pending-verifications'],
    queryFn: async () => {
      const response = await staffCopayApi.getPendingVerifications('pending');
      return response.data?.data || response.data || [];
    },
  });

  // Fetch flagged payments
  const { data: flaggedPayments } = useQuery({
    queryKey: ['flagged-payments'],
    queryFn: async () => {
      const response = await staffCopayApi.getPendingVerifications('flagged');
      return response.data?.data || response.data || [];
    },
  });

  // Fetch payment summary
  const { data: paymentSummary } = useQuery({
    queryKey: ['staff-payment-summary', selectedDate],
    queryFn: async () => {
      const response = await staffCopayApi.getPaymentSummary({ 
        startDate: selectedDate,
        endDate: selectedDate 
      });
      return response.data?.data || response.data;
    },
  });

  // Collect payment mutation
  const collectPaymentMutation = useMutation({
    mutationFn: ({ appointmentId, data }: { appointmentId: string; data: any }) =>
      staffCopayApi.collectPayment(appointmentId, data),
    onSuccess: () => {
      toast.success('Payment collected successfully');
      queryClient.invalidateQueries({ queryKey: ['staff-checkin-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['staff-payment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['pending-verifications'] });
      setShowPaymentModal(false);
      resetPaymentForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to collect payment');
    },
  });

  // Verify payment mutation  
  const verifyPaymentMutation = useMutation({
    mutationFn: ({ appointmentId, data }: { appointmentId: string; data: VerificationAction }) =>
      staffCopayApi.verifyPayment(appointmentId, data),
    onSuccess: () => {
      toast.success('Payment verification recorded');
      queryClient.invalidateQueries({ queryKey: ['staff-checkin-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['flagged-payments'] });
      setShowVerificationModal(false);
      resetVerificationForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to verify payment');
    },
  });

  // Quick verify mutation (Phase 3 Feature #2)
  const quickVerifyMutation = useMutation({
    mutationFn: (appointmentId: string) => staffCopayApi.quickVerify(appointmentId),
    onSuccess: () => {
      toast.success('Payment quick verified!');
      queryClient.invalidateQueries({ queryKey: ['staff-checkin-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-verifications'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Cannot quick verify - amount mismatch');
    },
  });

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setPaymentMethod('CASH');
    setPaymentNotes('');
    setSelectedAppointment(null);
  };

  const resetVerificationForm = () => {
    setVerificationAction('');
    setVerificationReason('');
    setSelectedAppointment(null);
  };

  const handleCollectPayment = () => {
    if (!selectedAppointment || !paymentAmount) {
      toast.error('Please enter payment amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount !== selectedAppointment.copayAmount) {
      const confirmed = window.confirm(
        `Warning: Amount entered (AED ${amount}) doesn't match expected copay (AED ${selectedAppointment.copayAmount}). Continue anyway?`
      );
      if (!confirmed) return;
    }

    collectPaymentMutation.mutate({
      appointmentId: selectedAppointment.appointment.id,
      data: {
        amount,
        paymentMethod,
        notes: paymentNotes,
      },
    });
  };

  const handleVerifyPayment = () => {
    if (!selectedAppointment || !verificationAction) {
      toast.error('Please select an action');
      return;
    }

    verifyPaymentMutation.mutate({
      appointmentId: selectedAppointment.appointment.id,
      data: {
        appointmentId: selectedAppointment.appointment.id,
        action: verificationAction as any,
        reason: verificationReason,
      },
    });
  };

  // Handle quick verify (Phase 3 Feature #2)
  const handleQuickVerify = (appointmentId: string) => {
    quickVerifyMutation.mutate(appointmentId);
  };

  // Filter appointments
  const filteredAppointments = appointments.filter((apt: CopayAppointment) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !apt.appointment.patientName.toLowerCase().includes(search) &&
        !apt.appointment.mrn.toLowerCase().includes(search) &&
        !apt.appointment.doctorName.toLowerCase().includes(search)
      ) {
        return false;
      }
    }

    if (statusFilter && apt.paymentStatus !== statusFilter) {
      return false;
    }

    return true;
  });

  // Get payments needing verification (paid but not verified)
  const paidNotVerified = appointments.filter((apt: CopayAppointment) => 
    (apt.paymentStatus === 'paid_online' || apt.paymentStatus === 'paid_cash') &&
    (!apt.verificationStatus || apt.verificationStatus === 'pending')
  );

  const renderAppointmentRow = (apt: CopayAppointment) => {
    const status = paymentStatusConfig[apt.paymentStatus] || paymentStatusConfig.pending;
    const StatusIcon = status.icon;
    const verificationStatus = apt.verificationStatus ? verificationStatusConfig[apt.verificationStatus] : null;
    const hasAmountMismatch = apt.paidAmount && apt.paidAmount !== apt.copayAmount;
    const canQuickVerify = apt.paidAmount && Math.abs(apt.paidAmount - apt.copayAmount) <= 0.01 && 
                          (!apt.verificationStatus || apt.verificationStatus === 'pending');

    return (
      <tr key={apt.appointment.id} className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{apt.appointment.patientName}</p>
              <p className="text-sm text-gray-500">MRN: {apt.appointment.mrn}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm">
            <p className="text-gray-900">{apt.appointment.doctorName}</p>
            <p className="text-gray-500">{apt.appointment.startTime} - {apt.appointment.endTime}</p>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            {hasAmountMismatch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                <ExclamationTriangleIcon className="h-3 w-3" />
                Mismatch
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-right">
            <p className="font-semibold text-gray-900">
              <CurrencyDisplay amount={apt.copayAmount} />
            </p>
            {apt.paidAmount && apt.paidAmount !== apt.copayAmount && (
              <p className={`text-sm ${apt.paidAmount < apt.copayAmount ? 'text-red-600' : 'text-purple-600'}`}>
                Paid: <CurrencyDisplay amount={apt.paidAmount} />
              </p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          {verificationStatus && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${verificationStatus.bg} ${verificationStatus.text} border ${verificationStatus.border}`}>
              <verificationStatus.icon className="h-3.5 w-3.5" />
              {verificationStatus.label}
            </span>
          )}
          {apt.copayWaived && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 ml-1">
              Waived
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            {/* Collect Payment - Only for pending/pay_at_clinic */}
            {['pending', 'pay_at_clinic'].includes(apt.paymentStatus) && (
              <button
                onClick={() => {
                  setSelectedAppointment(apt);
                  setPaymentAmount(apt.copayAmount.toString());
                  setShowPaymentModal(true);
                }}
                className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                title="Collect Payment"
              >
                <BanknotesIcon className="h-5 w-5" />
              </button>
            )}

            {/* Quick Verify - Phase 3 Feature #2 */}
            {canQuickVerify && (
              <button
                onClick={() => handleQuickVerify(apt.appointment.id)}
                disabled={quickVerifyMutation.isPending}
                className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                title="Quick Verify (Exact Match)"
              >
                <CheckBadgeIcon className="h-5 w-5" />
              </button>
            )}

            {/* Verify Payment - For paid appointments */}
            {['paid_online', 'paid_cash'].includes(apt.paymentStatus) && (
              <button
                onClick={() => {
                  setSelectedAppointment(apt);
                  setShowVerificationModal(true);
                }}
                className={`p-2 rounded-lg transition-colors ${
                  apt.verificationStatus === 'verified' || apt.verificationStatus === 'auto_verified'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                }`}
                title="Verify Payment"
              >
                {apt.verificationStatus === 'verified' || apt.verificationStatus === 'auto_verified' ? (
                  <ShieldCheckIcon className="h-5 w-5" />
                ) : (
                  <ShieldExclamationIcon className="h-5 w-5" />
                )}
              </button>
            )}

            {/* View Audit Log */}
            <button
              onClick={() => {
                setSelectedAppointment(apt);
                setShowAuditModal(true);
              }}
              className="p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
              title="View Audit Log"
            >
              <DocumentTextIcon className="h-5 w-5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // Render pending verification row (Phase 3 Feature #1)
  const renderPendingVerificationRow = (item: PendingVerification) => {
    const canQuickVerify = item.amountMatches;

    return (
      <tr key={item.appointmentId} className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-gray-900">{item.patientName}</p>
            <p className="text-sm text-gray-500">MRN: {item.mrn}</p>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{item.doctorName}</td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {format(new Date(item.appointmentDate), 'MMM d, yyyy')}
        </td>
        <td className="px-4 py-3 text-right">
          <p className="font-medium"><CurrencyDisplay amount={item.expectedAmount} /></p>
        </td>
        <td className="px-4 py-3 text-right">
          <p className={`font-medium ${item.difference !== 0 ? (item.difference < 0 ? 'text-red-600' : 'text-purple-600') : 'text-green-600'}`}>
            <CurrencyDisplay amount={item.paidAmount} />
          </p>
        </td>
        <td className="px-4 py-3">
          {item.difference !== 0 ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              item.difference < 0 ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {item.difference < 0 ? <ArrowTrendingDownIcon className="h-3 w-3" /> : <ArrowTrendingUpIcon className="h-3 w-3" />}
              <CurrencyDisplay amount={Math.abs(item.difference)} />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <CheckCircleIcon className="h-3 w-3" />
              Match
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            {canQuickVerify && (
              <button
                onClick={() => handleQuickVerify(item.appointmentId)}
                disabled={quickVerifyMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                title="Quick Verify"
              >
                <CheckBadgeIcon className="h-4 w-4" />
                Quick Verify
              </button>
            )}
            {!canQuickVerify && (
              <button
                onClick={() => {
                  // Open full verification modal
                  const apt = appointments.find((a: CopayAppointment) => a.appointment.id === item.appointmentId);
                  if (apt) {
                    setSelectedAppointment(apt);
                    setShowVerificationModal(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                <EyeIcon className="h-4 w-4" />
                Review
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const tabs = [
    { name: 'All Appointments', count: appointments.length },
    { name: 'Pending Verification', count: paidNotVerified.length || (pendingVerifications?.length || 0) },
    { name: 'Flagged', count: summary.flagged || (flaggedPayments?.length || 0) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Copay Payment Verification</h1>
              <p className="text-gray-500 mt-1">Verify and manage patient copay payments</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/billing/copay-reconciliation"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 transition-colors"
              >
                <ChartBarIcon className="h-5 w-5" />
                Reconciliation Report
              </Link>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => {
                  refetch();
                  refetchPending();
                }}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{summary.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{summary.paid}</p>
                <p className="text-xs text-gray-500">Paid</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <BanknotesIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{summary.cashDue}</p>
                <p className="text-xs text-gray-500">Cash Due</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ClockIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{summary.pending}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShieldExclamationIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{summary.pendingVerification || paidNotVerified.length}</p>
                <p className="text-xs text-gray-500">To Verify</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{summary.flagged || 0}</p>
                <p className="text-xs text-gray-500">Flagged</p>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        {paymentSummary && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Today's Collection Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-sm text-green-600 font-medium">Online Payments</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  <CurrencyDisplay amount={paymentSummary.payments?.online?.amount || 0} />
                </p>
                <p className="text-xs text-green-600 mt-1">{paymentSummary.payments?.online?.count || 0} transactions</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-600 font-medium">Cash Payments</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">
                  <CurrencyDisplay amount={paymentSummary.payments?.cash?.amount || 0} />
                </p>
                <p className="text-xs text-blue-600 mt-1">{paymentSummary.payments?.cash?.count || 0} transactions</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-sm text-amber-600 font-medium">Pending Collection</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">
                  <CurrencyDisplay amount={paymentSummary.payments?.pending?.expectedAmount || 0} />
                </p>
                <p className="text-xs text-amber-600 mt-1">{paymentSummary.payments?.pending?.count || 0} appointments</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
            <Tab.List className="flex border-b border-gray-200">
              {tabs.map((tab, index) => (
                <Tab
                  key={tab.name}
                  className={({ selected }) =>
                    `flex-1 py-4 px-6 text-sm font-medium focus:outline-none ${
                      selected
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <span className="flex items-center justify-center gap-2">
                    {tab.name}
                    {tab.count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        index === 2 ? 'bg-red-100 text-red-700' : 
                        index === 1 ? 'bg-amber-100 text-amber-700' : 
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </span>
                </Tab>
              ))}
            </Tab.List>

            <Tab.Panels>
              {/* All Appointments Tab */}
              <Tab.Panel>
                {/* Filters and Search */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="relative flex-1">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by patient name, MRN, or doctor..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="pl-9 pr-8 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white"
                        >
                          <option value="">All Status</option>
                          <option value="pending">Pending</option>
                          <option value="pay_at_clinic">Cash Due</option>
                          <option value="paid_online">Paid Online</option>
                          <option value="paid_cash">Paid Cash</option>
                        </select>
                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-12 text-center">
                    <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
                    <p className="text-gray-500 mt-2">Loading appointments...</p>
                  </div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="p-12 text-center">
                    <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No appointments found for the selected date</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Appointment</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Verification</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredAppointments.map((apt: CopayAppointment) => renderAppointmentRow(apt))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Tab.Panel>

              {/* Pending Verification Tab - Phase 3 Feature #1 */}
              <Tab.Panel>
                <div className="p-4 border-b border-gray-200 bg-amber-50">
                  <div className="flex items-center gap-2 text-amber-700">
                    <ClockIcon className="h-5 w-5" />
                    <p className="text-sm font-medium">
                      These payments have been received but require staff verification. Sorted by oldest first (FIFO).
                    </p>
                  </div>
                </div>
                
                {(!pendingVerifications || pendingVerifications.length === 0) && paidNotVerified.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircleIcon className="h-12 w-12 text-green-300 mx-auto mb-3" />
                    <p className="text-gray-500">All payments have been verified!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Patient</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Doctor</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Expected</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Paid</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Difference</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(pendingVerifications || []).map((item: PendingVerification) => renderPendingVerificationRow(item))}
                        {pendingVerifications?.length === 0 && paidNotVerified.map((apt: CopayAppointment) => (
                          <tr key={apt.appointment.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{apt.appointment.patientName}</p>
                                <p className="text-sm text-gray-500">MRN: {apt.appointment.mrn}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{apt.appointment.doctorName}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {format(new Date(apt.appointment.appointmentDate), 'MMM d, yyyy')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-medium"><CurrencyDisplay amount={apt.copayAmount} /></p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-medium"><CurrencyDisplay amount={apt.paidAmount || 0} /></p>
                            </td>
                            <td className="px-4 py-3">
                              {apt.paidAmount && Math.abs(apt.paidAmount - apt.copayAmount) <= 0.01 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  <CheckCircleIcon className="h-3 w-3" />
                                  Match
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                  <ExclamationTriangleIcon className="h-3 w-3" />
                                  Mismatch
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                {apt.paidAmount && Math.abs(apt.paidAmount - apt.copayAmount) <= 0.01 && (
                                  <button
                                    onClick={() => handleQuickVerify(apt.appointment.id)}
                                    disabled={quickVerifyMutation.isPending}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                                  >
                                    <CheckBadgeIcon className="h-4 w-4" />
                                    Quick Verify
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedAppointment(apt);
                                    setShowVerificationModal(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                  Review
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Tab.Panel>

              {/* Flagged Tab - Phase 3 Features #5, #6 */}
              <Tab.Panel>
                <div className="p-4 border-b border-gray-200 bg-red-50">
                  <div className="flex items-center gap-2 text-red-700">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                    <p className="text-sm font-medium">
                      These payments have been flagged for review due to amount discrepancies or other issues.
                    </p>
                  </div>
                </div>
                
                {(!flaggedPayments || flaggedPayments.length === 0) ? (
                  <div className="p-12 text-center">
                    <CheckCircleIcon className="h-12 w-12 text-green-300 mx-auto mb-3" />
                    <p className="text-gray-500">No flagged payments</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Patient</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Flag Type</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Expected</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Paid</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Difference</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(flaggedPayments || []).map((item: PendingVerification) => (
                          <tr key={item.appointmentId} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{item.patientName}</p>
                                <p className="text-sm text-gray-500">MRN: {item.mrn}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {item.verificationFlag && (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  item.verificationFlag.includes('Underpayment') 
                                    ? 'bg-red-100 text-red-700' 
                                    : item.verificationFlag.includes('Overpayment')
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {item.verificationFlag.includes('Underpayment') ? (
                                    <ArrowTrendingDownIcon className="h-3.5 w-3.5" />
                                  ) : item.verificationFlag.includes('Overpayment') ? (
                                    <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
                                  ) : (
                                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                                  )}
                                  {item.verificationFlag}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-medium"><CurrencyDisplay amount={item.expectedAmount} /></p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className={`font-medium ${item.difference < 0 ? 'text-red-600' : 'text-purple-600'}`}>
                                <CurrencyDisplay amount={item.paidAmount} />
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.difference < 0 ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {item.difference < 0 ? '-' : '+'}<CurrencyDisplay amount={Math.abs(item.difference)} />
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  const apt = appointments.find((a: CopayAppointment) => a.appointment.id === item.appointmentId);
                                  if (apt) {
                                    setSelectedAppointment(apt);
                                    setShowVerificationModal(true);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                              >
                                <EyeIcon className="h-4 w-4" />
                                Review & Resolve
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>

        {/* Collect Payment Modal */}
        <Transition appear show={showPaymentModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowPaymentModal(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl">
                    <div className="p-6">
                      <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">
                        Collect Payment
                      </Dialog.Title>

                      {selectedAppointment && (
                        <div className="space-y-4">
                          <div className="p-4 bg-gray-50 rounded-xl">
                            <p className="font-medium text-gray-900">{selectedAppointment.appointment.patientName}</p>
                            <p className="text-sm text-gray-500">MRN: {selectedAppointment.appointment.mrn}</p>
                            <p className="text-sm text-gray-500">{selectedAppointment.appointment.doctorName}</p>
                          </div>

                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-sm text-blue-600">Expected Copay</p>
                            <p className="text-2xl font-bold text-blue-700">
                              <CurrencyDisplay amount={selectedAppointment.copayAmount} />
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Amount Received *
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                              <input
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="w-full pl-14 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                                step="0.01"
                              />
                            </div>
                            {paymentAmount && parseFloat(paymentAmount) !== selectedAppointment.copayAmount && (
                              <p className="mt-1 text-sm text-orange-600 flex items-center gap-1">
                                <ExclamationTriangleIcon className="h-4 w-4" />
                                Amount doesn't match expected copay
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Payment Method
                            </label>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('CASH')}
                                className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                                  paymentMethod === 'CASH'
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <BanknotesIcon className="h-5 w-5" />
                                Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('CARD')}
                                className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                                  paymentMethod === 'CARD'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <CreditCardIcon className="h-5 w-5" />
                                Card
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Notes (Optional)
                            </label>
                            <textarea
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={2}
                              placeholder="Any additional notes..."
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-4 bg-gray-50 flex gap-3 rounded-b-2xl">
                      <button
                        onClick={() => {
                          setShowPaymentModal(false);
                          resetPaymentForm();
                        }}
                        className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCollectPayment}
                        disabled={collectPaymentMutation.isPending || !paymentAmount}
                        className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {collectPaymentMutation.isPending ? (
                          <>
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-5 w-5" />
                            Collect Payment
                          </>
                        )}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Verification Modal */}
        <Transition appear show={showVerificationModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowVerificationModal(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl">
                    <div className="p-6">
                      <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">
                        Verify Payment
                      </Dialog.Title>

                      {selectedAppointment && (
                        <div className="space-y-4">
                          <div className="p-4 bg-gray-50 rounded-xl">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{selectedAppointment.appointment.patientName}</p>
                                <p className="text-sm text-gray-500">MRN: {selectedAppointment.appointment.mrn}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">
                                  <CurrencyDisplay amount={selectedAppointment.paidAmount || selectedAppointment.copayAmount} />
                                </p>
                                <p className="text-xs text-gray-500">
                                  {selectedAppointment.paymentStatus === 'paid_online' ? 'Paid Online' : 'Paid Cash'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {selectedAppointment.paidAmount && selectedAppointment.paidAmount !== selectedAppointment.copayAmount && (
                            <div className={`p-3 rounded-xl border ${
                              selectedAppointment.paidAmount < selectedAppointment.copayAmount
                                ? 'bg-red-50 border-red-200'
                                : 'bg-purple-50 border-purple-200'
                            }`}>
                              <div className="flex items-start gap-2">
                                {selectedAppointment.paidAmount < selectedAppointment.copayAmount ? (
                                  <ArrowTrendingDownIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                                ) : (
                                  <ArrowTrendingUpIcon className="h-5 w-5 text-purple-500 flex-shrink-0" />
                                )}
                                <div>
                                  <p className={`text-sm font-medium ${
                                    selectedAppointment.paidAmount < selectedAppointment.copayAmount
                                      ? 'text-red-800'
                                      : 'text-purple-800'
                                  }`}>
                                    {selectedAppointment.paidAmount < selectedAppointment.copayAmount
                                      ? 'Underpayment Detected'
                                      : 'Overpayment Detected - Refund may be needed'}
                                  </p>
                                  <p className="text-xs mt-0.5">
                                    Expected: <CurrencyDisplay amount={selectedAppointment.copayAmount} /> | 
                                    Received: <CurrencyDisplay amount={selectedAppointment.paidAmount} />
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Select Action
                            </label>
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => setVerificationAction('verify')}
                                className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                                  verificationAction === 'verify'
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <CheckCircleIcon className={`h-5 w-5 ${verificationAction === 'verify' ? 'text-green-600' : 'text-gray-400'}`} />
                                <div>
                                  <p className="font-medium text-gray-900">Verify Payment</p>
                                  <p className="text-xs text-gray-500">Confirm payment matches records</p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setVerificationAction('mark_incorrect')}
                                className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                                  verificationAction === 'mark_incorrect'
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <ExclamationTriangleIcon className={`h-5 w-5 ${verificationAction === 'mark_incorrect' ? 'text-orange-600' : 'text-gray-400'}`} />
                                <div>
                                  <p className="font-medium text-gray-900">Mark as Incorrect</p>
                                  <p className="text-xs text-gray-500">Payment doesn't match expected amount</p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setVerificationAction('convert_selfpay')}
                                className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                                  verificationAction === 'convert_selfpay'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <UserIcon className={`h-5 w-5 ${verificationAction === 'convert_selfpay' ? 'text-blue-600' : 'text-gray-400'}`} />
                                <div>
                                  <p className="font-medium text-gray-900">Convert to Self-Pay</p>
                                  <p className="text-xs text-gray-500">Insurance declined, patient pays full</p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setVerificationAction('flag_fraud')}
                                className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                                  verificationAction === 'flag_fraud'
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <ShieldExclamationIcon className={`h-5 w-5 ${verificationAction === 'flag_fraud' ? 'text-red-600' : 'text-gray-400'}`} />
                                <div>
                                  <p className="font-medium text-gray-900">Flag as Fraud</p>
                                  <p className="text-xs text-gray-500">Suspicious payment - investigate</p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setVerificationAction('request_refund')}
                                className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                                  verificationAction === 'request_refund'
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <ArrowPathIcon className={`h-5 w-5 ${verificationAction === 'request_refund' ? 'text-purple-600' : 'text-gray-400'}`} />
                                <div>
                                  <p className="font-medium text-gray-900">Request Refund</p>
                                  <p className="text-xs text-gray-500">Overpayment - needs admin approval</p>
                                </div>
                              </button>
                            </div>
                          </div>

                          {verificationAction && verificationAction !== 'verify' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason *
                              </label>
                              <textarea
                                value={verificationReason}
                                onChange={(e) => setVerificationReason(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                rows={3}
                                placeholder="Please provide a reason..."
                                required
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-4 bg-gray-50 flex gap-3 rounded-b-2xl">
                      <button
                        onClick={() => {
                          setShowVerificationModal(false);
                          resetVerificationForm();
                        }}
                        className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleVerifyPayment}
                        disabled={verifyPaymentMutation.isPending || !verificationAction || (verificationAction !== 'verify' && !verificationReason)}
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {verifyPaymentMutation.isPending ? (
                          <>
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <ShieldCheckIcon className="h-5 w-5" />
                            Submit
                          </>
                        )}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
}
