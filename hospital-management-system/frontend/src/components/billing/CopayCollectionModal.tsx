import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  CreditCardIcon,
  BanknotesIcon,
  WalletIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { billingApi } from '../../services/api';
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
  deductible: { total: number; used: number; remaining: number };
  annualCopay: { total: number; used: number; remaining: number };
  visitType: string;
  paymentRequired: boolean;
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
      await billingApi.collectCopay({
        patientId: patient.id,
        appointmentId,
        amount: copayInfo.patientAmount,
        paymentMethod,
        useDeposit: paymentMethod === 'DEPOSIT',
        notes: notes || undefined,
      });
      toast.success('Copay collected successfully');
      onSuccess('collected');
    } catch (error: any) {
      console.error('Failed to collect copay:', error);
      toast.error(error.response?.data?.message || 'Failed to collect copay');
    } finally {
      setProcessing(false);
    }
  };

  const handleWaive = () => {
    toast.success('Copay waived');
    onSuccess('waived');
  };

  const handleDefer = () => {
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
            {loading ? (
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

                {/* Fee Breakdown */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Fee Breakdown</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultation Fee:</span>
                      <span className="font-semibold text-gray-900">
                        AED {copayInfo.consultationFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>Insurance Covers ({copayInfo.coveragePercentage}%):</span>
                      <span className="font-semibold">
                        -AED {copayInfo.insuranceAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-blue-700 border-t pt-2">
                      <span>Patient Copay ({copayInfo.copayPercentage}%):</span>
                      <span className="font-bold">
                        AED {copayInfo.patientAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

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
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (copayInfo.deductible.used / copayInfo.deductible.total) * 100)}%`,
                              }}
                            />
                          </div>
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
