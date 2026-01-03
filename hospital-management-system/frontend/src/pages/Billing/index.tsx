import { useState, useEffect } from 'react';
import {
  CreditCardIcon,
  DocumentTextIcon,
  BanknotesIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CalculatorIcon,
  PlusIcon,
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon,
  CheckCircleIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { billingApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Invoice {
  id: string;
  invoiceNumber: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  totalAmount: number;
  paidAmount: number;
  status: string;
  createdAt: string;
  insuranceClaim?: boolean;
}

interface Claim {
  id: string;
  claimNumber: string;
  invoice: {
    patient: {
      firstName: string;
      lastName: string;
    };
  };
  insuranceProvider: string;
  claimAmount: number;
  status: string;
  submittedAt?: string;
  denialReason?: string;
}

interface BillingStats {
  todayRevenue: number;
  pendingPayments: number;
  claimsSubmitted: number;
  deniedClaims: number;
}

interface CapturedCharge {
  code: string;
  description: string;
  category: string;
  price: number;
  matchedKeyword: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SuggestedCode {
  code: string;
  description: string;
  category: string;
  price: number;
  reason: string;
}

interface CostBreakdown {
  item: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Glass-styled status badges with colored dots
const getStatusBadgeClasses = (status: string) => {
  const baseClasses = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border';
  const statusStyles: Record<string, string> = {
    PENDING: 'bg-yellow-100/60 text-yellow-800 border-yellow-300/50',
    PARTIAL: 'bg-orange-100/60 text-orange-800 border-orange-300/50',
    PAID: 'bg-green-100/60 text-green-800 border-green-300/50',
    SUBMITTED: 'bg-blue-100/60 text-blue-800 border-blue-300/50',
    APPROVED: 'bg-green-100/60 text-green-800 border-green-300/50',
    DENIED: 'bg-red-100/60 text-red-800 border-red-300/50',
    CANCELLED: 'bg-gray-100/60 text-gray-800 border-gray-300/50',
  };
  return `${baseClasses} ${statusStyles[status] || statusStyles.CANCELLED}`;
};

const getStatusDotColor = (status: string) => {
  const dotColors: Record<string, string> = {
    PENDING: 'bg-yellow-500',
    PARTIAL: 'bg-orange-500',
    PAID: 'bg-green-500',
    SUBMITTED: 'bg-blue-500',
    APPROVED: 'bg-green-500',
    DENIED: 'bg-red-500',
    CANCELLED: 'bg-gray-500',
  };
  return dotColors[status] || 'bg-gray-500';
};

const confidenceColors: Record<string, string> = {
  HIGH: 'bg-green-100/60 text-green-800 border-green-300/50',
  MEDIUM: 'bg-yellow-100/60 text-yellow-800 border-yellow-300/50',
  LOW: 'bg-orange-100/60 text-orange-800 border-orange-300/50',
};

export default function Billing() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'claims' | 'charge-capture' | 'estimator'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<BillingStats>({
    todayRevenue: 0,
    pendingPayments: 0,
    claimsSubmitted: 0,
    deniedClaims: 0,
  });
  const [loading, setLoading] = useState(true);
  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  // Charge Capture State
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [capturedCharges, setCapturedCharges] = useState<CapturedCharge[]>([]);
  const [chargeSubtotal, setChargeSubtotal] = useState(0);
  const [chargeSuggestions, setChargeSuggestions] = useState<string[]>([]);
  const [extractingCharges, setExtractingCharges] = useState(false);

  // Code Suggestion State
  const [diagnosis, setDiagnosis] = useState('');
  const [procedures, setProcedures] = useState('');
  const [isInpatient, setIsInpatient] = useState(false);
  const [lengthOfStay, setLengthOfStay] = useState(1);
  const [suggestedCodes, setSuggestedCodes] = useState<SuggestedCode[]>([]);
  const [codeEstimatedTotal, setCodeEstimatedTotal] = useState(0);
  const [missingCharges, setMissingCharges] = useState<string[]>([]);
  const [suggestingCodes, setSuggestingCodes] = useState(false);

  // Cost Estimator State
  const [procedureName, setProcedureName] = useState('');
  const [expectedStay, setExpectedStay] = useState(0);
  const [includeAnesthesia, setIncludeAnesthesia] = useState(false);
  const [insuranceCoverage, setInsuranceCoverage] = useState(80);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown[]>([]);
  const [costSubtotal, setCostSubtotal] = useState(0);
  const [patientResponsibility, setPatientResponsibility] = useState(0);
  const [estimatingCost, setEstimatingCost] = useState(false);

  // Fetch invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const response = await billingApi.getInvoices({ limit: 50 });
        setInvoices(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch invoices:', error);
        toast.error('Failed to load invoices');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  // Fetch claims
  useEffect(() => {
    const fetchClaims = async () => {
      try {
        const response = await billingApi.getClaims({ limit: 50 });
        setClaims(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch claims:', error);
      }
    };

    fetchClaims();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await billingApi.getStats();
        setStats(response.data.data || {
          todayRevenue: 0,
          pendingPayments: 0,
          claimsSubmitted: 0,
          deniedClaims: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  const handleExtractCharges = async () => {
    if (!clinicalNotes.trim()) {
      toast.error('Please enter clinical notes');
      return;
    }

    setExtractingCharges(true);
    try {
      const response = await billingApi.extractCharges(clinicalNotes);
      const data = response.data.data;
      setCapturedCharges(data.capturedCharges || []);
      setChargeSubtotal(data.subtotal || 0);
      setChargeSuggestions(data.suggestions || []);
      toast.success(`Extracted ${data.capturedCharges?.length || 0} charges from notes`);
    } catch (error) {
      console.error('Failed to extract charges:', error);
      toast.error('Failed to extract charges');
    } finally {
      setExtractingCharges(false);
    }
  };

  const handleSuggestCodes = async () => {
    if (!diagnosis && !procedures) {
      toast.error('Please enter diagnosis or procedures');
      return;
    }

    setSuggestingCodes(true);
    try {
      const response = await billingApi.suggestCodes({
        diagnosis,
        procedures: procedures ? procedures.split(',').map(p => p.trim()) : [],
        isInpatient,
        lengthOfStay: isInpatient ? lengthOfStay : undefined,
      });
      const data = response.data.data;
      setSuggestedCodes(data.suggestedCodes || []);
      setCodeEstimatedTotal(data.estimatedTotal || 0);
      setMissingCharges(data.missingCharges || []);
      toast.success(`Found ${data.suggestedCodes?.length || 0} billing codes`);
    } catch (error) {
      console.error('Failed to suggest codes:', error);
      toast.error('Failed to suggest billing codes');
    } finally {
      setSuggestingCodes(false);
    }
  };

  const handleEstimateCost = async () => {
    if (!procedureName) {
      toast.error('Please select a procedure');
      return;
    }

    setEstimatingCost(true);
    try {
      const response = await billingApi.estimateCost({
        procedureName,
        isInpatient: expectedStay > 0,
        expectedStay: expectedStay > 0 ? expectedStay : undefined,
        includeAnesthesia,
        insuranceCoverage,
      });
      const data = response.data.data;
      setCostBreakdown(data.breakdown || []);
      setCostSubtotal(data.subtotal || 0);
      setPatientResponsibility(data.patientResponsibility || 0);
      toast.success('Cost estimate calculated');
    } catch (error) {
      console.error('Failed to estimate cost:', error);
      toast.error('Failed to calculate estimate');
    } finally {
      setEstimatingCost(false);
    }
  };

  const handleOptimizeClaim = (_claimId: string) => {
    toast.success('AI is analyzing claim for optimization...');
  };

  const deniedClaimsList = claims.filter(c => c.status === 'DENIED');

  const tabs = [
    { id: 'invoices', label: 'Invoices', count: invoices.length },
    { id: 'payments', label: 'Payments' },
    { id: 'claims', label: 'Insurance Claims', count: claims.length },
    { id: 'charge-capture', label: 'AI Charge Capture', icon: SparklesIcon },
    { id: 'estimator', label: 'Cost Estimator' },
  ];

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header with gradient and floating orbs */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-8">
        {/* Floating orbs */}
        <div className="absolute top-4 right-12 w-24 h-24 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-2 right-32 w-32 h-32 bg-yellow-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-orange-300/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-3">
              <BanknotesIcon className="h-4 w-4" />
              Billing & Finance
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Billing & Revenue</h1>
            <p className="mt-2 text-white/80">
              Invoice management, payments, and AI-powered charge capture
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAIOnline && (
              <button
                onClick={() => setActiveTab('charge-capture')}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium rounded-xl border border-white/30 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                <SparklesIcon className="h-5 w-5" />
                AI Charge Capture
              </button>
            )}
            <button className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-white/90 text-orange-600 font-semibold rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg">
              <PlusIcon className="h-5 w-5" />
              New Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Denied Claims Alert - Glass styled */}
      {deniedClaimsList.length > 0 && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-red-50/70 border border-red-200/50 rounded-xl p-4 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100/60">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800">
                {deniedClaimsList.length} Denied Claims Require Attention
              </h3>
              <p className="text-sm text-red-700 mt-1">
                Review denied claims and consider AI-assisted appeal optimization.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Overview - Glass styled stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: `$${stats.todayRevenue.toLocaleString()}`, gradient: 'from-green-500 to-emerald-600', bgColor: 'bg-green-50/70', borderColor: 'border-green-200/50', textColor: 'text-green-700', icon: BanknotesIcon },
          { label: 'Pending Payments', value: `$${stats.pendingPayments.toLocaleString()}`, gradient: 'from-yellow-500 to-amber-600', bgColor: 'bg-yellow-50/70', borderColor: 'border-yellow-200/50', textColor: 'text-yellow-700', icon: ClockIcon },
          { label: 'Claims Submitted', value: stats.claimsSubmitted, gradient: 'from-blue-500 to-indigo-600', bgColor: 'bg-blue-50/70', borderColor: 'border-blue-200/50', textColor: 'text-blue-700', icon: DocumentTextIcon },
          { label: 'Denied Claims', value: stats.deniedClaims, gradient: 'from-red-500 to-rose-600', bgColor: 'bg-red-50/70', borderColor: 'border-red-200/50', textColor: 'text-red-700', icon: ExclamationTriangleIcon },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={clsx(
              'relative overflow-hidden backdrop-blur-xl rounded-xl p-4 border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg',
              stat.bgColor,
              stat.borderColor
            )}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="flex items-center gap-2">
              <div className={clsx('p-2 rounded-lg bg-gradient-to-br', stat.gradient)}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <p className={clsx('text-sm font-medium', stat.textColor)}>{stat.label}</p>
            </div>
            <p className={clsx('text-2xl font-bold mt-3', stat.textColor)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Animated Gradient Tabs */}
      <div className="relative backdrop-blur-xl bg-white/70 rounded-xl p-1.5 border border-gray-200/50">
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <nav className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'relative py-2.5 px-4 font-medium text-sm whitespace-nowrap flex items-center gap-2 rounded-lg transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-gray-600 hover:bg-gray-100/50'
              )}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              {tab.label}
              {tab.count !== undefined && (
                <span className={clsx(
                  'ml-1 py-0.5 px-2 rounded-full text-xs',
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200/60 text-gray-600'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl border border-gray-200/50 shadow-xl"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          {loading ? (
            <div className="p-8 text-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-orange-500" />
              <p className="mt-2 text-gray-500">Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>No invoices found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/50">
              {invoices.map((invoice, index) => (
                <div
                  key={invoice.id}
                  className="p-4 hover:bg-gray-50/50 transition-colors duration-200"
                  style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-gray-900">{invoice.invoiceNumber}</span>
                        <span className={getStatusBadgeClasses(invoice.status)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', getStatusDotColor(invoice.status))} />
                          {invoice.status}
                        </span>
                      </div>
                      <h3 className="mt-2 font-medium text-gray-900">
                        {invoice.patient?.firstName} {invoice.patient?.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Date: {new Date(invoice.createdAt).toLocaleDateString()}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="font-medium text-gray-900">
                          Total: ${invoice.totalAmount?.toLocaleString()}
                        </span>
                        <span className="text-green-600">
                          Paid: ${invoice.paidAmount?.toLocaleString()}
                        </span>
                        {invoice.totalAmount - invoice.paidAmount > 0 && (
                          <span className="text-red-600">
                            Due: ${(invoice.totalAmount - invoice.paidAmount).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300/50 text-gray-700 hover:bg-gray-100/50 backdrop-blur-sm transition-all duration-200">
                        View
                      </button>
                      {invoice.status !== 'PAID' && (
                        <button className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:scale-105">
                          Collect Payment
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Claims Tab */}
      {activeTab === 'claims' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl border border-gray-200/50 shadow-xl"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          {claims.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>No claims found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/50">
              {claims.map((claim, index) => (
                <div
                  key={claim.id}
                  className={clsx(
                    'p-4 transition-colors duration-200',
                    claim.status === 'DENIED'
                      ? 'bg-red-50/50 hover:bg-red-100/50'
                      : 'hover:bg-gray-50/50'
                  )}
                  style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm font-medium text-gray-900">{claim.claimNumber}</span>
                        <span className={getStatusBadgeClasses(claim.status)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', getStatusDotColor(claim.status))} />
                          {claim.status}
                        </span>
                        <span className="text-sm text-gray-500">{claim.insuranceProvider}</span>
                      </div>
                      <h3 className="mt-2 font-medium text-gray-900">
                        {claim.invoice?.patient?.firstName} {claim.invoice?.patient?.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Amount: ${claim.claimAmount?.toLocaleString()}
                        {claim.submittedAt && ` | Submitted: ${new Date(claim.submittedAt).toLocaleDateString()}`}
                      </p>
                      {claim.denialReason && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          Reason: {claim.denialReason}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300/50 text-gray-700 hover:bg-gray-100/50 backdrop-blur-sm transition-all duration-200">
                        View
                      </button>
                      {claim.status === 'PENDING' && (
                        <button className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:scale-105">
                          Submit Claim
                        </button>
                      )}
                      {claim.status === 'DENIED' && isAIOnline && (
                        <button
                          onClick={() => handleOptimizeClaim(claim.id)}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:scale-105 flex items-center gap-1"
                        >
                          <SparklesIcon className="h-4 w-4" />
                          AI Appeal
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl border border-gray-200/50 shadow-xl p-6 text-center"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="p-4 rounded-xl bg-gradient-to-br from-orange-100/50 to-amber-100/50 inline-block mb-4">
            <CreditCardIcon className="h-12 w-12 text-orange-500" />
          </div>
          <h3 className="font-semibold text-gray-900 text-lg">Payment Collection</h3>
          <p className="text-sm text-gray-500 mt-1">Collect payments and manage transactions</p>
        </div>
      )}

      {/* AI Charge Capture Tab */}
      {activeTab === 'charge-capture' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* NLP Charge Extraction */}
          <div
            className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl border border-gray-200/50 shadow-xl p-6"
            style={{ animation: 'fadeIn 0.5s ease-out' }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
                <DocumentMagnifyingGlassIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-lg text-gray-900">Extract Charges from Notes</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Paste clinical notes below and AI will automatically extract billable charges.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clinical Notes
                </label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Patient presented with chest pain. Performed ECG and chest X-ray. Administered IV fluids and morphine for pain management. Blood draw for CBC and metabolic panel..."
                  className="w-full h-40 resize-none rounded-xl border border-gray-300/50 bg-white/50 backdrop-blur-sm px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                />
              </div>

              <button
                onClick={handleExtractCharges}
                disabled={extractingCharges || !clinicalNotes.trim()}
                className="w-full py-3 px-4 flex items-center justify-center gap-2 font-medium rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {extractingCharges ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Extracting Charges...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5" />
                    Extract Charges
                  </>
                )}
              </button>

              {capturedCharges.length > 0 && (
                <div className="mt-4" style={{ animation: 'fadeIn 0.5s ease-out' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Captured Charges</h4>
                    <span className="text-lg font-bold text-green-600">
                      ${chargeSubtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {capturedCharges.map((charge, idx) => (
                      <div
                        key={idx}
                        className="relative overflow-hidden backdrop-blur-sm bg-gray-50/70 rounded-xl p-3 border border-gray-200/50"
                        style={{ animation: 'fadeIn 0.3s ease-out', animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-gray-900">{charge.code}</span>
                              <span className={clsx('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border backdrop-blur-sm', confidenceColors[charge.confidence])}>
                                {charge.confidence}
                              </span>
                            </div>
                            <p className="text-sm mt-1 text-gray-700">{charge.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Matched: "{charge.matchedKeyword}" | {charge.category}
                            </p>
                          </div>
                          <span className="font-medium text-gray-900">${charge.price.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {chargeSuggestions.length > 0 && (
                    <div className="mt-3 p-3 backdrop-blur-sm bg-yellow-50/70 rounded-xl border border-yellow-200/50">
                      <p className="text-sm font-medium text-yellow-800">Suggestions:</p>
                      <ul className="list-disc list-inside text-sm text-yellow-700 mt-1">
                        {chargeSuggestions.map((suggestion, idx) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Code Suggestion */}
          <div
            className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl border border-gray-200/50 shadow-xl p-6"
            style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.1s' }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600">
                <CodeBracketIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-lg text-gray-900">Suggest Billing Codes</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Enter diagnosis or procedures to get recommended billing codes.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diagnosis (ICD-10)
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g., Type 2 diabetes, Hypertension, Pneumonia"
                  className="w-full rounded-xl border border-gray-300/50 bg-white/50 backdrop-blur-sm px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Procedures (comma-separated)
                </label>
                <input
                  type="text"
                  value={procedures}
                  onChange={(e) => setProcedures(e.target.value)}
                  placeholder="e.g., Appendectomy, CT scan, Blood draw"
                  className="w-full rounded-xl border border-gray-300/50 bg-white/50 backdrop-blur-sm px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isInpatient}
                    onChange={(e) => setIsInpatient(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500/50"
                  />
                  <span className="text-sm text-gray-700">Inpatient</span>
                </label>
                {isInpatient && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">LOS:</span>
                    <input
                      type="number"
                      value={lengthOfStay}
                      onChange={(e) => setLengthOfStay(Number(e.target.value))}
                      min="1"
                      className="w-20 rounded-lg border border-gray-300/50 bg-white/50 backdrop-blur-sm px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                    />
                    <span className="text-sm text-gray-600">days</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleSuggestCodes}
                disabled={suggestingCodes || (!diagnosis && !procedures)}
                className="w-full py-3 px-4 flex items-center justify-center gap-2 font-medium rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {suggestingCodes ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5" />
                    Suggest Codes
                  </>
                )}
              </button>

              {suggestedCodes.length > 0 && (
                <div className="mt-4" style={{ animation: 'fadeIn 0.5s ease-out' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Suggested Codes</h4>
                    <span className="text-lg font-bold text-blue-600">
                      Est: ${codeEstimatedTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {suggestedCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="relative overflow-hidden backdrop-blur-sm bg-gray-50/70 rounded-xl p-3 border border-gray-200/50 flex items-start justify-between"
                        style={{ animation: 'fadeIn 0.3s ease-out', animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-gray-900">{code.code}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100/60 text-blue-800 border border-blue-300/50">
                              {code.category}
                            </span>
                          </div>
                          <p className="text-sm mt-1 text-gray-700">{code.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{code.reason}</p>
                        </div>
                        <span className="font-medium text-gray-900">${code.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {missingCharges.length > 0 && (
                    <div className="mt-3 p-3 backdrop-blur-sm bg-orange-50/70 rounded-xl border border-orange-200/50">
                      <p className="text-sm font-medium text-orange-800">Potentially Missing:</p>
                      <ul className="list-disc list-inside text-sm text-orange-700 mt-1">
                        {missingCharges.map((charge, idx) => (
                          <li key={idx}>{charge}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cost Estimator Tab */}
      {activeTab === 'estimator' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl border border-gray-200/50 shadow-xl p-6"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-orange-100/50 to-amber-100/50 mb-4">
                <CalculatorIcon className="h-12 w-12 text-orange-500" />
              </div>
              <h3 className="font-semibold text-lg text-gray-900">AI Cost Estimator</h3>
              <p className="text-sm text-gray-500 mt-1">
                Get accurate cost estimates for procedures with insurance calculation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.1s', animationFillMode: 'both' }}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Procedure / Service
                  </label>
                  <select
                    value={procedureName}
                    onChange={(e) => setProcedureName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300/50 bg-white/50 backdrop-blur-sm px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200"
                  >
                    <option value="">Select procedure...</option>
                    <optgroup label="Surgery">
                      <option value="appendectomy">Appendectomy</option>
                      <option value="cholecystectomy">Cholecystectomy</option>
                      <option value="hernia repair">Hernia Repair</option>
                      <option value="hip replacement">Hip Replacement</option>
                      <option value="knee replacement">Knee Replacement</option>
                      <option value="coronary bypass">Coronary Bypass (CABG)</option>
                    </optgroup>
                    <optgroup label="Imaging">
                      <option value="MRI">MRI</option>
                      <option value="CT scan">CT Scan</option>
                      <option value="X-ray">X-Ray</option>
                      <option value="ultrasound">Ultrasound</option>
                    </optgroup>
                    <optgroup label="Laboratory">
                      <option value="blood test">Blood Test Panel</option>
                      <option value="urinalysis">Urinalysis</option>
                    </optgroup>
                    <optgroup label="Cardiology">
                      <option value="cardiac catheterization">Cardiac Catheterization</option>
                      <option value="echocardiogram">Echocardiogram</option>
                      <option value="stress test">Stress Test</option>
                    </optgroup>
                  </select>
                </div>

                <div style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.15s', animationFillMode: 'both' }}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Hospital Stay (days)
                  </label>
                  <input
                    type="number"
                    value={expectedStay}
                    onChange={(e) => setExpectedStay(Number(e.target.value))}
                    placeholder="0 for outpatient"
                    className="w-full rounded-xl border border-gray-300/50 bg-white/50 backdrop-blur-sm px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200"
                    min="0"
                  />
                </div>

                <div
                  className="flex items-center gap-4"
                  style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'both' }}
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeAnesthesia}
                      onChange={(e) => setIncludeAnesthesia(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500/50"
                    />
                    <span className="text-sm text-gray-700">Include Anesthesia</span>
                  </label>
                </div>

                <div style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.25s', animationFillMode: 'both' }}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insurance Coverage (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      value={insuranceCoverage}
                      onChange={(e) => setInsuranceCoverage(Number(e.target.value))}
                      min="0"
                      max="100"
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <span className="text-sm font-medium w-12 text-gray-700">{insuranceCoverage}%</span>
                  </div>
                </div>

                <button
                  onClick={handleEstimateCost}
                  disabled={estimatingCost || !procedureName}
                  className="w-full py-3 px-4 flex items-center justify-center gap-2 font-medium rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.3s', animationFillMode: 'both' }}
                >
                  {estimatingCost ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-5 w-5" />
                      Calculate Estimate
                    </>
                  )}
                </button>
              </div>

              {/* Results */}
              <div style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'both' }}>
                {costBreakdown.length > 0 ? (
                  <div className="relative overflow-hidden backdrop-blur-sm bg-gray-50/70 rounded-xl p-4 border border-gray-200/50">
                    {/* Shine line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    <h4 className="font-medium mb-3 flex items-center gap-2 text-gray-900">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      Cost Breakdown
                    </h4>
                    <div className="space-y-2">
                      {costBreakdown.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between text-sm"
                          style={{ animation: 'fadeIn 0.3s ease-out', animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }}
                        >
                          <span className="text-gray-600">
                            {item.item} {item.quantity > 1 && `(x${item.quantity})`}
                          </span>
                          <span className="font-medium text-gray-900">${item.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-200/50 mt-3 pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium text-gray-900">${costSubtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Insurance Coverage ({insuranceCoverage}%)</span>
                        <span>-${((costSubtotal * insuranceCoverage) / 100).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-gray-200/50">
                        <span className="text-gray-900">Patient Responsibility</span>
                        <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">${patientResponsibility.toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      * Estimate only. Actual costs may vary based on patient condition and treatment requirements.
                    </p>
                  </div>
                ) : (
                  <div className="relative overflow-hidden backdrop-blur-sm bg-gray-50/70 rounded-xl p-8 text-center border border-gray-200/50">
                    {/* Shine line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    <CalculatorIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">Select a procedure and click calculate to see the cost estimate</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add fadeIn animation keyframes */}
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
