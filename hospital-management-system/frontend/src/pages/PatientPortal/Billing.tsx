import { useState, Fragment, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Dialog, Transition } from '@headlessui/react';
import {
  CreditCardIcon,
  DocumentArrowDownIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChevronRightIcon,
  BuildingLibraryIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ReceiptPercentIcon,
  BanknotesIcon as BankIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import toast from 'react-hot-toast';

interface BillLineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date?: string;
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
  taxAmount?: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIAL' | 'CANCELLED';
  provider?: string;
  department?: string;
  visitDate?: string;
  visitType?: string;
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  referenceNumber: string;
  invoiceNumber: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
  cardLast4?: string;
}

interface InsuranceClaim {
  id: string;
  claimNumber: string;
  invoiceNumber: string;
  submittedDate: string;
  status: 'SUBMITTED' | 'PROCESSING' | 'APPROVED' | 'DENIED' | 'PARTIAL';
  claimedAmount: number;
  approvedAmount?: number;
  insuranceProvider: string;
  policyNumber: string;
  notes?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  PAID: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-500', label: 'Paid' },
  PENDING: { bg: 'bg-amber-100/80', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
  OVERDUE: { bg: 'bg-red-100/80', text: 'text-red-700', dot: 'bg-red-500', label: 'Overdue' },
  PARTIAL: { bg: 'bg-orange-100/80', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Partial' },
  CANCELLED: { bg: 'bg-gray-100/80', text: 'text-gray-700', dot: 'bg-gray-400', label: 'Cancelled' },
  SUCCESS: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-500', label: 'Success' },
  FAILED: { bg: 'bg-red-100/80', text: 'text-red-700', dot: 'bg-red-500', label: 'Failed' },
  REFUNDED: { bg: 'bg-purple-100/80', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Refunded' },
  SUBMITTED: { bg: 'bg-blue-100/80', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Submitted' },
  PROCESSING: { bg: 'bg-amber-100/80', text: 'text-amber-700', dot: 'bg-amber-500 animate-pulse', label: 'Processing' },
  APPROVED: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-500', label: 'Approved' },
  DENIED: { bg: 'bg-red-100/80', text: 'text-red-700', dot: 'bg-red-500', label: 'Denied' },
};

// Mock data for demonstration
const mockBills: Bill[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001234',
    date: '2024-12-20',
    dueDate: '2025-01-20',
    description: 'Cardiology Consultation',
    items: [
      { id: 'i1', description: 'Cardiology Consultation - New Patient', category: 'Consultation', quantity: 1, unitPrice: 250, totalPrice: 250 },
      { id: 'i2', description: 'ECG - 12 Lead', category: 'Diagnostic', quantity: 1, unitPrice: 150, totalPrice: 150 },
      { id: 'i3', description: 'Blood Panel - Lipid Profile', category: 'Laboratory', quantity: 1, unitPrice: 85, totalPrice: 85 },
    ],
    subtotal: 485,
    insuranceApplied: 340,
    adjustments: 0,
    totalAmount: 485,
    paidAmount: 0,
    balanceDue: 145,
    status: 'PENDING',
    provider: 'General Hospital',
    department: 'Cardiology',
    visitDate: '2024-12-20',
    visitType: 'Outpatient',
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-001180',
    date: '2024-12-05',
    dueDate: '2024-12-20',
    description: 'Emergency Room Visit',
    items: [
      { id: 'i4', description: 'Emergency Room Visit - Level 3', category: 'Emergency', quantity: 1, unitPrice: 800, totalPrice: 800 },
      { id: 'i5', description: 'X-Ray Chest PA', category: 'Radiology', quantity: 1, unitPrice: 200, totalPrice: 200 },
      { id: 'i6', description: 'IV Fluids Administration', category: 'Treatment', quantity: 1, unitPrice: 150, totalPrice: 150 },
    ],
    subtotal: 1150,
    insuranceApplied: 920,
    adjustments: -50,
    totalAmount: 1150,
    paidAmount: 0,
    balanceDue: 180,
    status: 'OVERDUE',
    provider: 'General Hospital',
    department: 'Emergency',
    visitDate: '2024-12-05',
    visitType: 'Emergency',
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-001050',
    date: '2024-11-15',
    dueDate: '2024-12-15',
    description: 'Annual Physical Exam',
    items: [
      { id: 'i7', description: 'Annual Physical Exam', category: 'Wellness', quantity: 1, unitPrice: 200, totalPrice: 200 },
      { id: 'i8', description: 'Complete Blood Count', category: 'Laboratory', quantity: 1, unitPrice: 45, totalPrice: 45 },
      { id: 'i9', description: 'Comprehensive Metabolic Panel', category: 'Laboratory', quantity: 1, unitPrice: 65, totalPrice: 65 },
    ],
    subtotal: 310,
    insuranceApplied: 310,
    adjustments: 0,
    totalAmount: 310,
    paidAmount: 310,
    balanceDue: 0,
    status: 'PAID',
    provider: 'General Hospital',
    department: 'Internal Medicine',
    visitDate: '2024-11-15',
    visitType: 'Wellness',
  },
];

const mockPaymentHistory: PaymentRecord[] = [
  { id: 'p1', date: '2024-11-20', amount: 310, method: 'Credit Card', referenceNumber: 'TXN-2024-001050', invoiceNumber: 'INV-2024-001050', status: 'SUCCESS', cardLast4: '4242' },
  { id: 'p2', date: '2024-10-15', amount: 150, method: 'Credit Card', referenceNumber: 'TXN-2024-000890', invoiceNumber: 'INV-2024-000890', status: 'SUCCESS', cardLast4: '4242' },
  { id: 'p3', date: '2024-09-01', amount: 275, method: 'Debit Card', referenceNumber: 'TXN-2024-000650', invoiceNumber: 'INV-2024-000650', status: 'SUCCESS', cardLast4: '1234' },
];

const mockInsuranceClaims: InsuranceClaim[] = [
  { id: 'c1', claimNumber: 'CLM-2024-001234', invoiceNumber: 'INV-2024-001234', submittedDate: '2024-12-21', status: 'PROCESSING', claimedAmount: 340, insuranceProvider: 'Blue Cross Blue Shield', policyNumber: 'BCB-12345678' },
  { id: 'c2', claimNumber: 'CLM-2024-001180', invoiceNumber: 'INV-2024-001180', submittedDate: '2024-12-06', status: 'APPROVED', claimedAmount: 920, approvedAmount: 920, insuranceProvider: 'Blue Cross Blue Shield', policyNumber: 'BCB-12345678' },
  { id: 'c3', claimNumber: 'CLM-2024-001050', invoiceNumber: 'INV-2024-001050', submittedDate: '2024-11-16', status: 'APPROVED', claimedAmount: 310, approvedAmount: 310, insuranceProvider: 'Blue Cross Blue Shield', policyNumber: 'BCB-12345678' },
];

export default function Billing() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'insurance'>('pending');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  // Fetch billing summary
  const { data: summaryData } = useQuery({
    queryKey: ['patient-billing-summary-page'],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getBillingSummary();
        return response.data?.data || response.data || {};
      } catch {
        return {
          totalBalance: 325,
          pendingBillsCount: 2,
          overdueBillsCount: 1,
        };
      }
    },
  });

  // Fetch bills
  const { data: billsData, isLoading: loadingBills } = useQuery({
    queryKey: ['patient-bills-page', activeTab, statusFilter],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getBills({ type: activeTab === 'pending' ? 'pending' : 'all' });
        return response.data?.data || response.data || [];
      } catch {
        return mockBills;
      }
    },
  });

  // Fetch payment history
  const { data: paymentHistoryData, isLoading: loadingHistory } = useQuery({
    queryKey: ['patient-payment-history-page'],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getPaymentHistory();
        return response.data?.data || response.data || [];
      } catch {
        return mockPaymentHistory;
      }
    },
    enabled: activeTab === 'history',
  });

  // Fetch insurance claims
  const { data: insuranceClaimsData, isLoading: loadingClaims } = useQuery({
    queryKey: ['patient-insurance-claims-page'],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getInsuranceClaims();
        return response.data?.data || response.data || [];
      } catch {
        return mockInsuranceClaims;
      }
    },
    enabled: activeTab === 'insurance',
  });

  const bills: Bill[] = Array.isArray(billsData) ? billsData : [];
  const paymentHistory: PaymentRecord[] = Array.isArray(paymentHistoryData) ? paymentHistoryData : [];
  const insuranceClaims: InsuranceClaim[] = Array.isArray(insuranceClaimsData) ? insuranceClaimsData : [];

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: (data: { billId: string; amount: number; paymentMethod: string; cardLast4: string }) =>
      patientPortalApi.makePayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-billing-summary-page'] });
      queryClient.invalidateQueries({ queryKey: ['patient-bills-page'] });
      queryClient.invalidateQueries({ queryKey: ['patient-payment-history-page'] });
      toast.success('Payment successful!');
      setShowPaymentModal(false);
      setShowDetailView(false);
      setSelectedBill(null);
      resetPaymentForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Payment failed. Please try again.');
    },
  });

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardholderName('');
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      // Tab filter
      if (activeTab === 'pending' && ['PAID', 'CANCELLED'].includes(bill.status)) return false;

      // Status filter
      if (statusFilter && bill.status !== statusFilter) return false;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const invoiceNum = bill.invoiceNumber.toLowerCase();
        const description = bill.description.toLowerCase();
        const department = bill.department?.toLowerCase() || '';

        if (!invoiceNum.includes(searchLower) &&
            !description.includes(searchLower) &&
            !department.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [bills, activeTab, statusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const paginatedBills = filteredBills.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleViewBill = (bill: Bill) => {
    setSelectedBill(bill);
    setShowDetailView(true);
  };

  const handleOpenPayment = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentAmount(bill.balanceDue.toFixed(2));
    setShowPaymentModal(true);
  };

  const handleDownloadInvoice = async (bill: Bill) => {
    setIsDownloading(bill.id);
    try {
      await patientPortalApi.downloadInvoice(bill.id);
      toast.success('Invoice downloaded successfully');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download invoice');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleSubmitPayment = () => {
    if (!selectedBill) return;

    // Basic validation
    if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
      toast.error('Please enter a valid 16-digit card number');
      return;
    }
    if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      toast.error('Please enter a valid expiry date (MM/YY)');
      return;
    }
    if (!cardCvv || cardCvv.length < 3) {
      toast.error('Please enter a valid CVV');
      return;
    }
    if (!cardholderName.trim()) {
      toast.error('Please enter the cardholder name');
      return;
    }

    paymentMutation.mutate({
      billId: selectedBill.id,
      amount: Number(paymentAmount),
      paymentMethod: 'CARD',
      cardLast4: cardNumber.replace(/\s/g, '').slice(-4),
    });
  };

  const formatCurrency = (amount: number | string | undefined | null) => {
    const num = Number(amount || 0);
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  // Bill Detail View
  if (showDetailView && selectedBill) {
    const bill = selectedBill;
    const status = statusConfig[bill.status] || statusConfig.PENDING;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Button */}
          <button
            onClick={() => { setShowDetailView(false); setSelectedBill(null); }}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span>Back to Billing</span>
          </button>

          {/* Header Card */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Invoice #{bill.invoiceNumber}</h1>
                <p className="text-gray-500">{bill.department} - {formatDate(bill.date)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.bg} ${status.text}`}>
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
          </div>

          {/* Bill Details Card */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg overflow-hidden">
            {/* Provider Info */}
            <div className="p-6 border-b border-gray-200/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                  <BuildingLibraryIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Provider</p>
                  <p className="font-semibold text-gray-900">{bill.provider || 'Healthcare Provider'}</p>
                  <p className="text-sm text-gray-600">{bill.department}</p>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="p-6 border-b border-gray-200/50">
              <h3 className="font-semibold text-gray-900 mb-4">Services & Charges</h3>
              <div className="space-y-3">
                {bill.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
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
            <div className="p-6 space-y-3">
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
                  <span className="font-medium text-green-600">-{formatCurrency(bill.insuranceApplied)}</span>
                </div>
              )}
              {bill.adjustments !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Adjustments</span>
                  <span className={`font-medium ${bill.adjustments > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {bill.adjustments > 0 ? '+' : ''}{formatCurrency(bill.adjustments)}
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
                  <span className="font-medium text-green-600">-{formatCurrency(bill.paidAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Balance Due</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                  {formatCurrency(bill.balanceDue)}
                </span>
              </div>
            </div>

            {/* Due Date Warning */}
            {bill.status === 'OVERDUE' && (
              <div className="mx-6 mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800">Payment Overdue</p>
                  <p className="text-sm text-red-700">This bill was due on {formatDate(bill.dueDate)}</p>
                </div>
              </div>
            )}
            {bill.status === 'PENDING' && (
              <div className="mx-6 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <ClockIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">Payment Due</p>
                  <p className="text-sm text-amber-700">Due by {formatDate(bill.dueDate)}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-6 bg-gray-50 flex flex-wrap gap-3">
              <button
                onClick={() => handleDownloadInvoice(bill)}
                disabled={isDownloading === bill.id}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-white transition-colors disabled:opacity-50"
              >
                {isDownloading === bill.id ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600" />
                ) : (
                  <DocumentArrowDownIcon className="h-5 w-5" />
                )}
                Download Invoice
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-white transition-colors"
              >
                <PrinterIcon className="h-5 w-5" />
                Print
              </button>
              {bill.balanceDue > 0 && (
                <button
                  onClick={() => handleOpenPayment(bill)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg"
                >
                  <CreditCardIcon className="h-5 w-5" />
                  Pay Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-8">
          <div className="absolute top-4 right-12 w-24 h-24 bg-white/20 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-2 right-32 w-32 h-32 bg-cyan-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-3">
              <BanknotesIcon className="h-4 w-4" />
              Patient Portal
            </div>
            <h1 className="text-3xl font-bold text-white">Billing & Payments</h1>
            <p className="mt-2 text-white/80">View your bills, make payments, and track insurance claims</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                <BankIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Balance</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(summaryData?.totalBalance)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Bills</p>
                <p className="text-2xl font-bold text-gray-900">{summaryData?.pendingBillsCount || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
                <ExclamationCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{summaryData?.overdueBillsCount || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/20 p-1.5">
          <nav className="flex space-x-1">
            <button
              onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
              className={`relative py-2.5 px-6 font-medium text-sm whitespace-nowrap flex items-center gap-2 rounded-lg transition-all flex-1 justify-center ${
                activeTab === 'pending'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ReceiptPercentIcon className="h-5 w-5" />
              Pending Bills
            </button>
            <button
              onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
              className={`relative py-2.5 px-6 font-medium text-sm whitespace-nowrap flex items-center gap-2 rounded-lg transition-all flex-1 justify-center ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <DocumentTextIcon className="h-5 w-5" />
              Payment History
            </button>
            <button
              onClick={() => { setActiveTab('insurance'); setCurrentPage(1); }}
              className={`relative py-2.5 px-6 font-medium text-sm whitespace-nowrap flex items-center gap-2 rounded-lg transition-all flex-1 justify-center ${
                activeTab === 'insurance'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ShieldCheckIcon className="h-5 w-5" />
              Insurance Claims
            </button>
          </nav>
        </div>

        {/* Search & Filters (for pending bills) */}
        {activeTab === 'pending' && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  placeholder="Search by invoice number or description..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm min-w-[140px]"
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="PARTIAL">Partial</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          {/* Pending Bills */}
          {activeTab === 'pending' && (
            loadingBills ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
                <p className="mt-4 text-gray-500">Loading bills...</p>
              </div>
            ) : paginatedBills.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircleIcon className="h-16 w-16 mx-auto text-green-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                <p className="text-gray-500">You have no pending bills</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200/50">
                {paginatedBills.map((bill) => {
                  const status = statusConfig[bill.status] || statusConfig.PENDING;
                  return (
                    <div
                      key={bill.id}
                      onClick={() => handleViewBill(bill)}
                      className={`p-5 cursor-pointer transition-all hover:bg-gray-50 ${
                        bill.status === 'OVERDUE' ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${
                          bill.status === 'OVERDUE' ? 'bg-red-100' :
                          bill.status === 'PAID' ? 'bg-green-100' : 'bg-amber-100'
                        }`}>
                          {bill.status === 'OVERDUE' ? (
                            <ExclamationCircleIcon className="h-6 w-6 text-red-600" />
                          ) : bill.status === 'PAID' ? (
                            <CheckCircleIcon className="h-6 w-6 text-green-600" />
                          ) : (
                            <ClockIcon className="h-6 w-6 text-amber-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">{bill.description}</h3>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                              {status.label}
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
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(bill.balanceDue)}</p>
                          <p className="text-sm text-gray-500">Due: {formatDate(bill.dueDate)}</p>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Payment History */}
          {activeTab === 'history' && (
            loadingHistory ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
                <p className="mt-4 text-gray-500">Loading payment history...</p>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="p-12 text-center">
                <CreditCardIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Payment History</h3>
                <p className="text-gray-500">You have not made any payments yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200/50">
                {paymentHistory.map((payment) => {
                  const status = statusConfig[payment.status] || statusConfig.PENDING;
                  return (
                    <div key={payment.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${
                          payment.status === 'SUCCESS' ? 'bg-green-100' :
                          payment.status === 'FAILED' ? 'bg-red-100' : 'bg-amber-100'
                        }`}>
                          <CreditCardIcon className={`h-6 w-6 ${
                            payment.status === 'SUCCESS' ? 'text-green-600' :
                            payment.status === 'FAILED' ? 'text-red-600' : 'text-amber-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-gray-900">Payment</h3>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Invoice #{payment.invoiceNumber}</span>
                            <span>{payment.method}{payment.cardLast4 && ` ****${payment.cardLast4}`}</span>
                            <span>Ref: {payment.referenceNumber}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                          <p className="text-sm text-gray-500">{formatDate(payment.date)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Insurance Claims */}
          {activeTab === 'insurance' && (
            loadingClaims ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
                <p className="mt-4 text-gray-500">Loading insurance claims...</p>
              </div>
            ) : insuranceClaims.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldCheckIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Insurance Claims</h3>
                <p className="text-gray-500">You have no insurance claims on file</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200/50">
                {insuranceClaims.map((claim) => {
                  const status = statusConfig[claim.status] || statusConfig.SUBMITTED;
                  return (
                    <div key={claim.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${
                          claim.status === 'APPROVED' ? 'bg-green-100' :
                          claim.status === 'DENIED' ? 'bg-red-100' :
                          claim.status === 'PROCESSING' ? 'bg-amber-100' : 'bg-blue-100'
                        }`}>
                          <ShieldCheckIcon className={`h-6 w-6 ${
                            claim.status === 'APPROVED' ? 'text-green-600' :
                            claim.status === 'DENIED' ? 'text-red-600' :
                            claim.status === 'PROCESSING' ? 'text-amber-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-gray-900">Claim #{claim.claimNumber}</h3>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                              {status.label}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                            <span>{claim.insuranceProvider}</span>
                            <span>Policy: {claim.policyNumber}</span>
                            <span>Invoice: #{claim.invoiceNumber}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(claim.claimedAmount)}</p>
                          {claim.approvedAmount !== undefined && (
                            <p className="text-sm text-green-600">Approved: {formatCurrency(claim.approvedAmount)}</p>
                          )}
                          <p className="text-sm text-gray-500">Submitted: {formatDate(claim.submittedDate)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Pagination (for pending bills) */}
        {activeTab === 'pending' && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        )}

        {/* Payment Modal */}
        <Transition appear show={showPaymentModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => { setShowPaymentModal(false); resetPaymentForm(); }}>
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
                  <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CreditCardIcon className="h-6 w-6 text-white" />
                          <h2 className="text-xl font-bold text-white">Make Payment</h2>
                        </div>
                        <button
                          onClick={() => { setShowPaymentModal(false); resetPaymentForm(); }}
                          className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <XMarkIcon className="h-5 w-5 text-white" />
                        </button>
                      </div>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleSubmitPayment(); }} className="p-6 space-y-5">
                      {/* Bill Summary */}
                      {selectedBill && (
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-500">Invoice #{selectedBill.invoiceNumber}</p>
                              <p className="font-medium text-gray-900">{selectedBill.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Balance Due</p>
                              <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedBill.balanceDue)}</p>
                            </div>
                          </div>
                        </div>
                      )}

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
                            max={selectedBill?.balanceDue}
                            step="0.01"
                            className="w-full rounded-xl border border-gray-300 bg-white pl-8 pr-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">You can pay the full amount or make a partial payment</p>
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
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                            placeholder="MM/YY"
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            CVV <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>

                      {/* Security Note */}
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
                        <ShieldCheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <p className="text-sm text-blue-700">Your payment is secured with 256-bit SSL encryption</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => { setShowPaymentModal(false); resetPaymentForm(); }}
                          className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={paymentMutation.isPending}
                          className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {paymentMutation.isPending ? (
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
