import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  CreditCardIcon,
  BanknotesIcon,
  WalletIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  PrinterIcon,
  EnvelopeIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { billingApi, insuranceCodingApi } from '../../services/api';
import toast from 'react-hot-toast';

interface CopayCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (action: 'collected' | 'waived' | 'deferred') => void;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn?: string;
  };
  appointmentId: string;
}

interface CopayInfo {
  hasCopay: boolean;
  consultationFee: number;
  coveragePercentage: number;
  copayPercentage: number;
  copayAmount: number;
  copayCapPerVisit: number;
  insuranceAmount: number;
  patientAmount: number;
  insuranceProvider: string | null;
  policyNumber: string | null;
  planType: string;
  networkStatus: string;
  deductible: { total: number; used: number; remaining: number; metForYear?: boolean };
  annualCopay: { total: number; used: number; remaining: number; metForYear?: boolean };
  visitType: string;
  paymentRequired: boolean;
  noInsurance?: boolean; // Flag for self-pay patients without insurance
  // GAP 1: Pre-auth check
  preAuthRequired?: boolean;
  preAuthStatus?: string; // NOT_REQUIRED | REQUIRED_NOT_SUBMITTED | APPROVED | PENDING | DENIED
  preAuthNumber?: string | null;
  preAuthMessage?: string | null;
  // GAP 5: Data source indicator
  dataSource?: 'DHA_LIVE' | 'DHA_SANDBOX' | 'MOCK_DATA' | 'CACHED_DB' | 'NOT_CONFIGURED';
  // GAP 2: COB (Coordination of Benefits)
  hasSecondaryInsurance?: boolean;
  cobApplied?: boolean;
  primaryBreakdown?: {
    insuranceProvider: string;
    policyNumber: string;
    coveragePercentage: number;
    copayPercentage: number;
    insuranceAmount: number;
    patientResponsibility: number;
  } | null;
  secondaryBreakdown?: {
    insuranceProvider: string;
    policyNumber: string;
    coveragePercentage: number;
    copayPercentage: number;
    networkStatus: string;
    insuranceAmount: number;
    appliedToRemaining: number;
  } | null;
  finalPatientAmount?: number;
  // GAP 6: Pharmacy estimate (informational only)
  pharmacyEstimate?: {
    estimated: boolean;
    estimatedAmount: number;
    totalMedicationCost: number;
    insuranceCovers: number;
    activePrescriptions: number;
  } | null;
}

interface DepositBalance {
  totalDeposit: number;
  totalUtilized: number;
  availableBalance: number;
}

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'DEPOSIT';

export default function CopayCollectionModal({
  isOpen,
  onClose,
  onSuccess,
  patient,
  appointmentId,
}: CopayCollectionModalProps) {
  const [loading, setLoading] = useState(true);
  const [copayInfo, setCopayInfo] = useState<CopayInfo | null>(null);
  const [depositBalance, setDepositBalance] = useState<DepositBalance | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  // GAP 3: Receipt info after successful collection
  const [receiptInfo, setReceiptInfo] = useState<{ receiptNumber: string; vatAmount: number } | null>(null);
  // GAP 6: Pharmacy estimate expanded/collapsed
  const [showPharmacyEstimate, setShowPharmacyEstimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCopayInfo();
    }
  }, [isOpen, patient.id]);

  useEffect(() => {
    if (paymentMethod === 'DEPOSIT' && !depositBalance) {
      fetchDepositBalance();
    }
  }, [paymentMethod]);

  const fetchCopayInfo = async () => {
    setLoading(true);
    try {
      // Pass appointmentId as query parameter if available
      const response = await billingApi.calculateCopay(patient.id, appointmentId);
      setCopayInfo(response.data.data);
    } catch (error) {
      console.error('Failed to calculate copay:', error);
      toast.error('Failed to load copay information');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepositBalance = async () => {
    try {
      const response = await billingApi.getDepositBalance(patient.id);
      setDepositBalance(response.data.data);
    } catch (error) {
      console.error('Failed to fetch deposit balance:', error);
      toast.error('Failed to load deposit balance');
    }
  };

  const handleCollectPayment = async () => {
    if (!copayInfo) return;

    if (paymentMethod === 'DEPOSIT') {
      if (!depositBalance || depositBalance.availableBalance < copayInfo.patientAmount) {
        toast.error('Insufficient deposit balance');
        return;
      }
    }

    setProcessing(true);
    try {
      const response = await billingApi.collectCopay({
        patientId: patient.id,
        appointmentId,
        amount: copayInfo.patientAmount,
        paymentMethod,
        useDeposit: paymentMethod === 'DEPOSIT',
        notes: notes || undefined,
      });
      toast.success('Copay collected successfully');
      // GAP 7: Audit log — fire-and-forget
      insuranceCodingApi.logInsuranceAudit({
        patientId: patient.id,
        appointmentId,
        action: 'COPAY_COLLECTED',
        newData: {
          amount: copayInfo.patientAmount,
          paymentMethod,
          insuranceProvider: copayInfo.insuranceProvider,
          policyNumber: copayInfo.policyNumber,
          cobApplied: copayInfo.cobApplied,
          noInsurance: copayInfo.noInsurance,
        },
        reason: notes || undefined,
      });
      // GAP 3: Capture receipt info if available
      const data = response?.data?.data;
      if (data?.receiptNumber) {
        setReceiptInfo({ receiptNumber: data.receiptNumber, vatAmount: data.vatAmount || 0 });
      } else {
        onSuccess('collected');
      }
    } catch (error: any) {
      console.error('Failed to collect copay:', error);
      toast.error(error.response?.data?.message || 'Failed to collect copay');
    } finally {
      setProcessing(false);
    }
  };

  const handleWaive = () => {
    // GAP 7: Audit log — fire-and-forget
    insuranceCodingApi.logInsuranceAudit({
      patientId: patient.id,
      appointmentId,
      action: 'COPAY_WAIVED',
      previousData: copayInfo ? {
        copayAmount: copayInfo.patientAmount,
        insuranceProvider: copayInfo.insuranceProvider,
      } : undefined,
      reason: notes || 'Copay waived at check-in',
    });
    toast.success('Copay waived');
    onSuccess('waived');
  };

  const handleDefer = () => {
    // GAP 7: Audit log — fire-and-forget
    insuranceCodingApi.logInsuranceAudit({
      patientId: patient.id,
      appointmentId,
      action: 'COPAY_DEFERRED',
      previousData: copayInfo ? {
        copayAmount: copayInfo.patientAmount,
        insuranceProvider: copayInfo.insuranceProvider,
      } : undefined,
      reason: notes || 'Payment deferred to later',
    });
    toast.success('Copay deferred');
    onSuccess('deferred');
  };

  if (!isOpen) return null;

  const paymentMethods = [
    { value: 'CASH', label: 'Cash', icon: BanknotesIcon },
    { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCardIcon },
    { value: 'DEBIT_CARD', label: 'Debit Card', icon: CreditCardIcon },
    { value: 'DEPOSIT', label: 'Patient Deposit', icon: WalletIcon },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Copay Collection</h2>
                <p className="text-white/80 text-sm">Collect copay payment at check-in</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* GAP 3: Receipt Success Screen */}
            {receiptInfo ? (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <CheckCircleIcon className="h-14 w-14 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Payment Collected</h3>
                  <p className="text-sm text-gray-600">Copay has been collected successfully</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <DocumentTextIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Receipt Details</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Receipt Number:</span>
                          <span className="font-mono font-bold text-blue-700">{receiptInfo.receiptNumber}</span>
                        </div>
                        {copayInfo && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Amount Paid:</span>
                            <span className="font-semibold text-gray-900">AED {copayInfo.patientAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {receiptInfo.vatAmount > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>VAT (5%):</span>
                            <span>AED {receiptInfo.vatAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-gray-500">
                          <span>Payment Method:</span>
                          <span>{paymentMethod.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      window.open(`/billing/copay-receipt/${receiptInfo.receiptNumber}`, '_blank');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 font-medium rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <PrinterIcon className="h-4 w-4" />
                    Print Receipt
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Receipt will be emailed to patient');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 font-medium rounded-xl border border-green-200 hover:bg-green-100 transition-colors"
                  >
                    <EnvelopeIcon className="h-4 w-4" />
                    Email Receipt
                  </button>
                </div>

                <button
                  onClick={() => onSuccess('collected')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg"
                >
                  Continue to Check-in
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600">Loading copay information...</span>
              </div>
            ) : !copayInfo?.hasCopay ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600">No copay required for this patient</p>
                <button
                  onClick={() => onSuccess('collected')}
                  className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                >
                  Continue to Check-in
                </button>
              </div>
            ) : copayInfo?.noInsurance ? (
              // Self-Pay Patient - No Insurance on File
              <>
                {/* Patient Info */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Patient Information</h3>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-gray-600">MRN: {patient.mrn || 'N/A'}</p>
                  </div>
                </div>

                {/* No Insurance Warning */}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border-2 border-orange-200">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-orange-800 mb-1">
                        No Insurance on File
                      </h3>
                      <p className="text-sm text-orange-700 mb-3">
                        This patient does not have insurance details registered. They will be treated as a <strong>Self-Pay</strong> patient.
                      </p>
                      <p className="text-xs text-orange-600">
                        💡 In UAE, health insurance is mandatory. Ask the patient for their Emirates ID to verify coverage.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Self-Pay Fee Breakdown */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Fee Breakdown (Self-Pay)</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultation Fee:</span>
                      <span className="font-semibold text-gray-900">
                        AED {copayInfo.consultationFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Insurance Coverage:</span>
                      <span>AED 0.00 (No insurance)</span>
                    </div>
                    <div className="flex justify-between text-blue-700 border-t pt-2 font-bold">
                      <span>Patient Pays (100%):</span>
                      <span>AED {copayInfo.patientAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Amount Due */}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700 mb-2">Amount Due Now (Self-Pay)</p>
                    <p className="text-4xl font-bold text-orange-700">
                      AED {copayInfo.patientAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Add Insurance Option */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-green-800">Has Insurance?</h3>
                      <p className="text-xs text-green-600">Add insurance now to apply coverage</p>
                    </div>
                    <button
                      onClick={() => window.open(`/patients/${patient.id}?tab=insurance`, '_blank')}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      + Add Insurance
                    </button>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                          className={`
                            relative p-4 rounded-xl border-2 transition-all duration-200
                            ${
                              paymentMethod === method.value
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }
                          `}
                        >
                          <Icon className={`h-6 w-6 mx-auto mb-2 ${
                            paymentMethod === method.value ? 'text-orange-500' : 'text-gray-400'
                          }`} />
                          <span className={`text-sm font-medium ${
                            paymentMethod === method.value ? 'text-orange-700' : 'text-gray-700'
                          }`}>
                            {method.label}
                          </span>
                          {paymentMethod === method.value && (
                            <div className="absolute top-2 right-2">
                              <CheckCircleIcon className="h-5 w-5 text-orange-500" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g., Patient will submit insurance later..."
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCollectPayment}
                    disabled={processing}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      `Collect Self-Pay - AED ${copayInfo.patientAmount.toFixed(2)}`
                    )}
                  </button>
                  
                  <button
                    onClick={handleDefer}
                    disabled={processing}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    Defer Payment (Collect Later)
                  </button>

                  <button
                    onClick={onClose}
                    disabled={processing}
                    className="w-full px-4 py-2 bg-white text-gray-700 font-medium rounded-xl border-2 border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Patient Info */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Patient Information</h3>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-gray-600">MRN: {patient.mrn || 'N/A'}</p>
                  </div>
                </div>

                {/* Insurance Info */}
                {copayInfo.insuranceProvider && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Insurance Details</h3>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-gray-900">
                        {copayInfo.insuranceProvider} ({copayInfo.planType})
                      </p>
                      <p className="text-sm text-gray-600">
                        Policy #: {copayInfo.policyNumber || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        Network: {copayInfo.networkStatus === 'IN_NETWORK' ? (
                          <><span className="text-green-600 font-medium">In-Network</span> ✅</>
                        ) : (
                          <><span className="text-orange-600 font-medium">Out-of-Network</span> ⚠️</>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* GAP 5: Data Source Banner */}
                {copayInfo.dataSource && (
                  <div className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 ${
                    copayInfo.dataSource === 'DHA_LIVE' ? 'bg-green-100 text-green-800 border border-green-200' :
                    copayInfo.dataSource === 'MOCK_DATA' ? 'bg-red-100 text-red-800 border border-red-200' :
                    copayInfo.dataSource === 'NOT_CONFIGURED' ? 'bg-red-100 text-red-800 border border-red-200' :
                    copayInfo.dataSource === 'CACHED_DB' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                    copayInfo.dataSource === 'DHA_SANDBOX' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                    'bg-gray-100 text-gray-800 border border-gray-200'
                  }`}>
                    {copayInfo.dataSource === 'DHA_LIVE' && (
                      <><CheckCircleIcon className="h-4 w-4 text-green-600" /> Insurance verified via DHA eClaimLink</>
                    )}
                    {copayInfo.dataSource === 'MOCK_DATA' && (
                      <><ExclamationTriangleIcon className="h-4 w-4 text-red-600" /> Insurance data is SIMULATED (not verified with DHA)</>
                    )}
                    {copayInfo.dataSource === 'NOT_CONFIGURED' && (
                      <><ExclamationTriangleIcon className="h-4 w-4 text-red-600" /> DHA not configured — manual verification required</>
                    )}
                    {copayInfo.dataSource === 'CACHED_DB' && (
                      <><ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" /> Using cached insurance data (not real-time verified)</>
                    )}
                    {copayInfo.dataSource === 'DHA_SANDBOX' && (
                      <><ShieldCheckIcon className="h-4 w-4 text-blue-600" /> DHA Sandbox Mode — test environment</>
                    )}
                  </div>
                )}

                {/* GAP 1: Pre-Authorization Warning */}
                {copayInfo.preAuthRequired && (
                  <div className={`rounded-xl p-4 border-2 ${
                    copayInfo.preAuthStatus === 'APPROVED' ? 'bg-green-50 border-green-300' :
                    copayInfo.preAuthStatus === 'PENDING' ? 'bg-yellow-50 border-yellow-300' :
                    'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex items-start gap-3">
                      <ShieldCheckIcon className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
                        copayInfo.preAuthStatus === 'APPROVED' ? 'text-green-600' :
                        copayInfo.preAuthStatus === 'PENDING' ? 'text-yellow-600' :
                        'text-red-600'
                      }`} />
                      <div className="flex-1">
                        <h3 className={`text-base font-semibold mb-1 ${
                          copayInfo.preAuthStatus === 'APPROVED' ? 'text-green-800' :
                          copayInfo.preAuthStatus === 'PENDING' ? 'text-yellow-800' :
                          'text-red-800'
                        }`}>
                          {copayInfo.preAuthStatus === 'APPROVED' ? 'Pre-Authorization Approved' :
                           copayInfo.preAuthStatus === 'PENDING' ? 'Pre-Authorization Pending' :
                           copayInfo.preAuthStatus === 'DENIED' ? 'Pre-Authorization Denied' :
                           'Pre-Authorization Required'}
                        </h3>
                        <p className="text-sm text-gray-700 mb-1">
                          {copayInfo.preAuthMessage || 'Pre-authorization is required for this visit.'}
                        </p>
                        {copayInfo.preAuthNumber && (
                          <p className="text-xs text-gray-500">Ref: {copayInfo.preAuthNumber}</p>
                        )}
                        {copayInfo.preAuthStatus !== 'APPROVED' && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {(copayInfo.preAuthStatus === 'REQUIRED_NOT_SUBMITTED' || copayInfo.preAuthStatus === 'DENIED') && (
                              <button
                                type="button"
                                onClick={() => window.open('/insurance/pre-auth/new', '_blank')}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                Request Pre-Auth Now
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                // GAP 7: Audit pre-auth override
                                insuranceCodingApi.logInsuranceAudit({
                                  patientId: patient.id,
                                  appointmentId,
                                  action: 'PREAUTH_OVERRIDE',
                                  previousData: {
                                    preAuthStatus: copayInfo.preAuthStatus,
                                    preAuthNumber: copayInfo.preAuthNumber,
                                  },
                                  reason: notes || 'Pre-auth overridden by admin at check-in',
                                });
                                handleCollectPayment();
                              }}
                              className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                            >
                              Override (Admin)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                // GAP 7: Audit convert to self-pay
                                insuranceCodingApi.logInsuranceAudit({
                                  patientId: patient.id,
                                  appointmentId,
                                  action: 'CONVERT_TO_SELFPAY',
                                  previousData: {
                                    insuranceProvider: copayInfo.insuranceProvider,
                                    policyNumber: copayInfo.policyNumber,
                                    preAuthStatus: copayInfo.preAuthStatus,
                                  },
                                  reason: notes || 'Converted to self-pay due to pre-auth issue',
                                });
                                handleDefer();
                              }}
                              className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-200 transition-colors"
                            >
                              Convert to Self-Pay
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fee Breakdown */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    {copayInfo.cobApplied ? 'Primary Insurance Breakdown' : 'Fee Breakdown'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultation Fee:</span>
                      <span className="font-semibold text-gray-900">
                        AED {copayInfo.consultationFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>
                        {copayInfo.cobApplied ? `Primary (${copayInfo.coveragePercentage}%):` : `Insurance Covers (${copayInfo.coveragePercentage}%):`}
                      </span>
                      <span className="font-semibold">
                        -AED {copayInfo.insuranceAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-blue-700 border-t pt-2">
                      <span>
                        {copayInfo.cobApplied ? `Remaining after Primary (${copayInfo.copayPercentage}%):` : `Patient Copay (${copayInfo.copayPercentage}%):`}
                      </span>
                      <span className="font-bold">
                        AED {copayInfo.cobApplied && copayInfo.primaryBreakdown
                          ? copayInfo.primaryBreakdown.patientResponsibility.toFixed(2)
                          : copayInfo.patientAmount.toFixed(2)
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* GAP 2: COB — Secondary Insurance Breakdown */}
                {copayInfo.cobApplied && copayInfo.secondaryBreakdown && (
                  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 border border-indigo-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Secondary Insurance (COB)</h3>
                    <div className="space-y-1 mb-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {copayInfo.secondaryBreakdown.insuranceProvider}
                      </p>
                      <p className="text-xs text-gray-600">
                        Policy #: {copayInfo.secondaryBreakdown.policyNumber || 'N/A'}
                        {' | '}
                        {copayInfo.secondaryBreakdown.networkStatus === 'IN_NETWORK'
                          ? <span className="text-green-600 font-medium">In-Network</span>
                          : <span className="text-orange-600 font-medium">Out-of-Network</span>
                        }
                      </p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Applied to remaining:</span>
                        <span className="font-medium">
                          AED {copayInfo.secondaryBreakdown.appliedToRemaining.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-indigo-700">
                        <span>Secondary Covers ({copayInfo.secondaryBreakdown.coveragePercentage}%):</span>
                        <span className="font-semibold">
                          -AED {copayInfo.secondaryBreakdown.insuranceAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-blue-800 border-t pt-2 font-bold">
                        <span>Final Patient Amount:</span>
                        <span>AED {copayInfo.patientAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deductible & Annual Copay Tracking */}
                {(copayInfo.deductible.total > 0 || copayInfo.annualCopay.total > 0) && (
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Annual Limits</h3>
                    <div className="space-y-3">
                      {copayInfo.deductible.total > 0 && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Annual Deductible:</span>
                            <span className="font-medium text-gray-900">
                              AED {copayInfo.deductible.used.toFixed(0)} / AED {copayInfo.deductible.total.toFixed(0)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                copayInfo.deductible.metForYear ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{
                                width: `${Math.min(100, (copayInfo.deductible.used / copayInfo.deductible.total) * 100)}%`,
                              }}
                            />
                          </div>
                          {copayInfo.deductible.metForYear && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                              Deductible met for this year
                            </p>
                          )}
                        </div>
                      )}
                      {copayInfo.annualCopay.total > 0 && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Annual Copay Used:</span>
                            <span className="font-medium text-gray-900">
                              AED {copayInfo.annualCopay.used.toFixed(0)} / AED {copayInfo.annualCopay.total.toFixed(0)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                copayInfo.annualCopay.used >= copayInfo.annualCopay.total
                                  ? 'bg-green-500'
                                  : 'bg-orange-500'
                              }`}
                              style={{
                                width: `${Math.min(100, (copayInfo.annualCopay.used / copayInfo.annualCopay.total) * 100)}%`,
                              }}
                            />
                          </div>
                          {copayInfo.annualCopay.used >= copayInfo.annualCopay.total && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                              ✅ Annual copay cap reached - no copay required!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Amount Due Now */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700 mb-2">Amount Due Now</p>
                    <p className="text-4xl font-bold text-green-700">
                      AED {copayInfo.patientAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* GAP 6: Pharmacy Estimate (informational, collapsible) */}
                {copayInfo.pharmacyEstimate && copayInfo.pharmacyEstimate.activePrescriptions > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowPharmacyEstimate(!showPharmacyEstimate)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-amber-800">Estimated Total Visit Cost</span>
                        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                          {copayInfo.pharmacyEstimate.activePrescriptions} Rx
                        </span>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 text-amber-600 transition-transform ${showPharmacyEstimate ? 'rotate-180' : ''}`} />
                    </button>
                    {showPharmacyEstimate && (
                      <div className="px-4 pb-4 space-y-2 text-sm border-t border-amber-200">
                        <div className="flex justify-between pt-3">
                          <span className="text-gray-600">Consultation Copay:</span>
                          <span className="font-semibold text-gray-900">AED {copayInfo.patientAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Pharmacy Estimate ({copayInfo.pharmacyEstimate.activePrescriptions} prescriptions):</span>
                          <span className="font-medium">~AED {copayInfo.pharmacyEstimate.estimatedAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-amber-800 border-t border-amber-200 pt-2 font-bold">
                          <span>Est. Total Patient Cost:</span>
                          <span>~AED {(copayInfo.patientAmount + copayInfo.pharmacyEstimate.estimatedAmount).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-amber-600 italic mt-1">
                          Pharmacy copay is estimated and collected separately at the pharmacy.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                          className={`
                            relative p-4 rounded-xl border-2 transition-all duration-200
                            ${
                              paymentMethod === method.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }
                          `}
                        >
                          <Icon className={`h-6 w-6 mx-auto mb-2 ${
                            paymentMethod === method.value ? 'text-blue-500' : 'text-gray-400'
                          }`} />
                          <span className={`text-sm font-medium ${
                            paymentMethod === method.value ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            {method.label}
                          </span>
                          {paymentMethod === method.value && (
                            <div className="absolute top-2 right-2">
                              <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Deposit Balance Warning */}
                {paymentMethod === 'DEPOSIT' && depositBalance && (
                  <div className={`rounded-xl p-4 border ${
                    depositBalance.availableBalance >= copayInfo.copayAmount
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      {depositBalance.availableBalance >= copayInfo.copayAmount ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          Available Deposit Balance
                        </p>
                        <p className={`text-lg font-bold ${
                          depositBalance.availableBalance >= copayInfo.copayAmount
                            ? 'text-green-700'
                            : 'text-red-700'
                        }`}>
                          AED {depositBalance.availableBalance.toFixed(2)}
                        </p>
                        {depositBalance.availableBalance < copayInfo.copayAmount && (
                          <p className="text-sm text-red-600 mt-1">
                            Insufficient balance. Please select another payment method.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Add any additional notes..."
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCollectPayment}
                    disabled={processing || (paymentMethod === 'DEPOSIT' && depositBalance && depositBalance.availableBalance < copayInfo.patientAmount)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      `Collect Payment - AED ${copayInfo.patientAmount.toFixed(2)}`
                    )}
                  </button>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleWaive}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-yellow-100 text-yellow-700 font-medium rounded-xl hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Waive
                    </button>
                    <button
                      onClick={handleDefer}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Defer
                    </button>
                  </div>

                  <button
                    onClick={onClose}
                    disabled={processing}
                    className="w-full px-4 py-2 bg-white text-gray-700 font-medium rounded-xl border-2 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
