import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCardIcon,
  DocumentArrowDownIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  ReceiptPercentIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChevronRightIcon,
  BuildingLibraryIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { formatCurrency } from '../../../utils/currency';

interface BillLineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Bill {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  description: string;
  items: BillLineItem[];
  subtotal: number;
  insuranceApplied: number;
  adjustments: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIAL';
  provider?: string;
  department?: string;
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  referenceNumber: string;
  invoiceNumber: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

interface BillingSummary {
  totalBalance: number;
  pendingBillsCount: number;
  overdueBillsCount: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
}

// Status badge styling
const getStatusBadgeClasses = (status: string) => {
  const baseClasses =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border';
  const statusStyles: Record<string, string> = {
    PAID: 'bg-green-100/60 text-green-800 border-green-300/50',
    PENDING: 'bg-yellow-100/60 text-yellow-800 border-yellow-300/50',
    OVERDUE: 'bg-red-100/60 text-red-800 border-red-300/50',
    PARTIAL: 'bg-orange-100/60 text-orange-800 border-orange-300/50',
    SUCCESS: 'bg-green-100/60 text-green-800 border-green-300/50',
    FAILED: 'bg-red-100/60 text-red-800 border-red-300/50',
  };
  return `${baseClasses} ${statusStyles[status] || statusStyles.PENDING}`;
};

const getStatusDotColor = (status: string) => {
  const dotColors: Record<string, string> = {
    PAID: 'bg-green-500',
    PENDING: 'bg-yellow-500',
    OVERDUE: 'bg-red-500',
    PARTIAL: 'bg-orange-500',
    SUCCESS: 'bg-green-500',
    FAILED: 'bg-red-500',
  };
  return dotColors[status] || 'bg-gray-500';
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    PAID: CheckCircleIcon,
    PENDING: ClockIcon,
    OVERDUE: ExclamationCircleIcon,
    PARTIAL: ClockIcon,
    SUCCESS: CheckCircleIcon,
    FAILED: ExclamationCircleIcon,
  };
  return icons[status] || ClockIcon;
};


// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Bill Detail View Component
function BillDetailView({
  bill,
  onBack,
  onPay,
  onDownload,
}: {
  bill: Bill;
  onBack: () => void;
  onPay: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">Invoice #{bill.invoiceNumber}</h2>
          <p className="text-sm text-gray-500">
            {bill.department} - {formatDate(bill.date)}
          </p>
        </div>
        <span className={getStatusBadgeClasses(bill.status)}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', getStatusDotColor(bill.status))} />
          {bill.status}
        </span>
      </div>

      {/* Bill Info */}
      <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200/50 shadow-xl p-6">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        {/* Provider Info */}
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200/50 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
            <BuildingLibraryIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Provider</p>
            <p className="font-semibold text-gray-900">{bill.provider || 'Healthcare Provider'}</p>
            <p className="text-sm text-gray-600">{bill.department}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Services & Charges</h3>
          <div className="space-y-2">
            {bill.items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-start justify-between py-2 px-3 bg-gray-50/70 rounded-lg"
                style={{
                  animation: 'fadeIn 0.3s ease-out',
                  animationDelay: `${idx * 0.05}s`,
                  animationFillMode: 'both',
                }}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  <p className="text-sm text-gray-500">
                    {item.category} - Qty: {item.quantity} x {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <span className="font-medium text-gray-900">{formatCurrency(item.totalPrice)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="border-t border-gray-200/50 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium text-gray-900">{formatCurrency(bill.subtotal)}</span>
          </div>
          {bill.insuranceApplied > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1">
                <ShieldCheckIcon className="h-4 w-4 text-green-600" />
                Insurance Applied
              </span>
              <span className="font-medium text-green-600">
                -{formatCurrency(bill.insuranceApplied)}
              </span>
            </div>
          )}
          {bill.adjustments !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Adjustments</span>
              <span
                className={clsx(
                  'font-medium',
                  bill.adjustments > 0 ? 'text-red-600' : 'text-green-600'
                )}
              >
                {bill.adjustments > 0 ? '+' : '-'}
                {formatCurrency(Math.abs(bill.adjustments))}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Amount</span>
            <span className="font-medium text-gray-900">{formatCurrency(bill.totalAmount)}</span>
          </div>
          {bill.paidAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Amount Paid</span>
              <span className="font-medium text-green-600">
                -{formatCurrency(bill.paidAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-3 border-t border-gray-200/50">
            <span className="font-semibold text-gray-900">Balance Due</span>
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
              {formatCurrency(bill.balanceDue)}
            </span>
          </div>
        </div>

        {/* Due Date Warning */}
        {bill.status === 'OVERDUE' && (
          <div className="mt-4 p-3 bg-red-50/70 border border-red-200/50 rounded-xl flex items-center gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Payment Overdue</p>
              <p className="text-sm text-red-700">
                This bill was due on {formatDate(bill.dueDate)}
              </p>
            </div>
          </div>
        )}
        {bill.status === 'PENDING' && (
          <div className="mt-4 p-3 bg-yellow-50/70 border border-yellow-200/50 rounded-xl flex items-center gap-3">
            <ClockIcon className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-800">Payment Due</p>
              <p className="text-sm text-yellow-700">Due by {formatDate(bill.dueDate)}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200/50">
          <button
            onClick={onDownload}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300/50 text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            Download Invoice
          </button>
          {bill.balanceDue > 0 && (
            <button
              onClick={onPay}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              <CreditCardIcon className="h-5 w-5" />
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Payment Modal Component
function PaymentModal({
  bill,
  onClose,
  onSuccess,
}: {
  bill: Bill;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [paymentAmount, setPaymentAmount] = useState(String(bill.balanceDue));
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
      toast.error('Please enter a valid 16-digit card number');
      return;
    }
    if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
      toast.error('Please enter a valid expiry date (MM/YY)');
      return;
    }
    if (!cvv || cvv.length < 3) {
      toast.error('Please enter a valid CVV');
      return;
    }
    if (!cardholderName.trim()) {
      toast.error('Please enter the cardholder name');
      return;
    }

    setProcessing(true);
    try {
      await patientPortalApi.makePayment({
        billId: bill.id,
        amount: Number(paymentAmount),
        paymentMethod: 'CARD',
        cardLast4: cardNumber.replace(/\s/g, '').slice(-4),
      });
      toast.success('Payment successful!');
      onSuccess();
    } catch (error: any) {
      console.error('Payment failed:', error);
      toast.error(error.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  // Format expiry date
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCardIcon className="h-6 w-6 text-white" />
                <h2 className="text-xl font-bold text-white">Make Payment</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Amount */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Invoice #{bill.invoiceNumber}</p>
                  <p className="font-medium text-gray-900">{bill.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Balance Due</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(bill.balanceDue)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  min="1"
                  max={bill.balanceDue}
                  step="0.01"
                  className="w-full rounded-xl border border-gray-300 bg-white pl-8 pr-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                You can pay the full amount or make a partial payment
              </p>
            </div>

            {/* Card Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                required
              />
            </div>

            {/* Expiry and CVV */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CVV <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Cardholder Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cardholder Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="John Doe"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                required
              />
            </div>

            {/* Security Note */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                Your payment is secured with 256-bit SSL encryption
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCardIcon className="h-5 w-5" />
                    Pay {formatCurrency(paymentAmount)}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Main BillingOverview Component
export default function BillingOverview() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch billing summary
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['patient-billing-summary'],
    queryFn: async () => {
      const response = await patientPortalApi.getBillingSummary();
      return response.data?.data || response.data || {};
    },
  });

  // Fetch bills based on active tab
  const { data: bills = [], isLoading: loadingBills, error } = useQuery({
    queryKey: ['patient-bills', activeTab],
    queryFn: async () => {
      const response = await patientPortalApi.getBills({ type: activeTab });
      return response.data?.data || response.data || [];
    },
  });

  // Fetch payment history
  const { data: paymentHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['patient-payment-history'],
    queryFn: async () => {
      const response = await patientPortalApi.getPaymentHistory();
      return response.data?.data || response.data || [];
    },
    enabled: activeTab === 'history',
  });

  const handleDownloadInvoice = async (bill: Bill) => {
    try {
      toast.success('Downloading invoice...');
      await patientPortalApi.downloadInvoice(bill.id);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download invoice');
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedBill(null);
    queryClient.invalidateQueries({ queryKey: ['patient-billing-summary'] });
    queryClient.invalidateQueries({ queryKey: ['patient-bills'] });
    queryClient.invalidateQueries({ queryKey: ['patient-payment-history'] });
  };

  // Bill detail view
  if (selectedBill && !showPaymentModal) {
    return (
      <BillDetailView
        bill={selectedBill}
        onBack={() => setSelectedBill(null)}
        onPay={() => setShowPaymentModal(true)}
        onDownload={() => handleDownloadInvoice(selectedBill)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-8">
        {/* Floating orbs */}
        <div className="absolute top-4 right-12 w-24 h-24 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div
          className="absolute bottom-2 right-32 w-32 h-32 bg-cyan-300/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-16 h-16 bg-teal-300/30 rounded-full blur-xl animate-pulse"
          style={{ animationDelay: '0.5s' }}
        />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-3">
            <BanknotesIcon className="h-4 w-4" />
            Patient Portal
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">Billing & Payments</h1>
          <p className="mt-2 text-white/80">View your bills, make payments, and download receipts</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl p-5 border border-gray-200/50 shadow-lg">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
              <BanknotesIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {loadingSummary ? (
                  <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
                ) : (
                  formatCurrency(summary?.totalBalance)
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl p-5 border border-gray-200/50 shadow-lg">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
              <ClockIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Bills</p>
              <p className="text-2xl font-bold text-gray-900">
                {loadingSummary ? (
                  <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
                ) : (
                  summary?.pendingBillsCount || 0
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl p-5 border border-gray-200/50 shadow-lg">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
              <ExclamationCircleIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">
                {loadingSummary ? (
                  <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
                ) : (
                  summary?.overdueBillsCount || 0
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative backdrop-blur-xl bg-white/70 rounded-xl p-1.5 border border-gray-200/50">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveTab('pending')}
            className={clsx(
              'relative py-2.5 px-6 font-medium text-sm whitespace-nowrap flex items-center gap-2 rounded-lg transition-all duration-300 flex-1 justify-center',
              activeTab === 'pending'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : 'text-gray-600 hover:bg-gray-100/50'
            )}
          >
            <ReceiptPercentIcon className="h-5 w-5" />
            Pending Bills
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={clsx(
              'relative py-2.5 px-6 font-medium text-sm whitespace-nowrap flex items-center gap-2 rounded-lg transition-all duration-300 flex-1 justify-center',
              activeTab === 'history'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : 'text-gray-600 hover:bg-gray-100/50'
            )}
          >
            <DocumentTextIcon className="h-5 w-5" />
            Payment History
          </button>
        </nav>
      </div>

      {/* Bills List */}
      {activeTab === 'pending' && (
        <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200/50 shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {loadingBills ? (
            <div className="p-8 text-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
              <p className="mt-2 text-gray-500">Loading bills...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <ExclamationCircleIcon className="h-12 w-12 mx-auto text-red-400 mb-4" />
              <p className="text-red-600">Failed to load bills</p>
            </div>
          ) : bills.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircleIcon className="h-12 w-12 mx-auto text-green-400 mb-4" />
              <p className="text-gray-900 font-medium">All caught up!</p>
              <p className="text-gray-500">You have no pending bills</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/50">
              {bills.map((bill: Bill, index: number) => {
                const StatusIcon = getStatusIcon(bill.status);
                return (
                  <div
                    key={bill.id}
                    onClick={() => setSelectedBill(bill)}
                    className={clsx(
                      'p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50/50',
                      bill.status === 'OVERDUE' && 'bg-red-50/30'
                    )}
                    style={{
                      animation: 'fadeIn 0.5s ease-out',
                      animationDelay: `${index * 0.05}s`,
                      animationFillMode: 'both',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={clsx(
                          'p-3 rounded-xl',
                          bill.status === 'OVERDUE'
                            ? 'bg-red-100'
                            : bill.status === 'PAID'
                            ? 'bg-green-100'
                            : 'bg-amber-100'
                        )}
                      >
                        <StatusIcon
                          className={clsx(
                            'h-6 w-6',
                            bill.status === 'OVERDUE'
                              ? 'text-red-600'
                              : bill.status === 'PAID'
                              ? 'text-green-600'
                              : 'text-amber-600'
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {bill.description}
                          </h3>
                          <span className={getStatusBadgeClasses(bill.status)}>
                            <span
                              className={clsx(
                                'w-1.5 h-1.5 rounded-full',
                                getStatusDotColor(bill.status)
                              )}
                            />
                            {bill.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <DocumentTextIcon className="h-4 w-4" />
                            #{bill.invoiceNumber}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {formatDate(bill.date)}
                          </span>
                          {bill.department && <span>{bill.department}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(bill.balanceDue)}
                        </p>
                        <p className="text-sm text-gray-500">Due: {formatDate(bill.dueDate)}</p>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payment History */}
      {activeTab === 'history' && (
        <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200/50 shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {loadingHistory ? (
            <div className="p-8 text-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
              <p className="mt-2 text-gray-500">Loading payment history...</p>
            </div>
          ) : paymentHistory.length === 0 ? (
            <div className="p-8 text-center">
              <CreditCardIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No payment history found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/50">
              {paymentHistory.map((payment: PaymentRecord, index: number) => (
                <div
                  key={payment.id}
                  className="p-4 hover:bg-gray-50/50 transition-colors"
                  style={{
                    animation: 'fadeIn 0.5s ease-out',
                    animationDelay: `${index * 0.05}s`,
                    animationFillMode: 'both',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={clsx(
                        'p-3 rounded-xl',
                        payment.status === 'SUCCESS'
                          ? 'bg-green-100'
                          : payment.status === 'FAILED'
                          ? 'bg-red-100'
                          : 'bg-yellow-100'
                      )}
                    >
                      <CreditCardIcon
                        className={clsx(
                          'h-6 w-6',
                          payment.status === 'SUCCESS'
                            ? 'text-green-600'
                            : payment.status === 'FAILED'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">Payment</h3>
                        <span className={getStatusBadgeClasses(payment.status)}>
                          <span
                            className={clsx(
                              'w-1.5 h-1.5 rounded-full',
                              getStatusDotColor(payment.status)
                            )}
                          />
                          {payment.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Invoice #{payment.invoiceNumber}</span>
                        <span>{payment.method}</span>
                        <span>Ref: {payment.referenceNumber}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(payment.date)}</p>
                    </div>
                    <button
                      onClick={() => handleDownloadInvoice({ id: payment.id } as Bill)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Download Receipt"
                    >
                      <DocumentArrowDownIcon className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <PaymentModal
          bill={selectedBill}
          onClose={() => {
            setShowPaymentModal(false);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Fade animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
