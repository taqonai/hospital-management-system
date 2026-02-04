import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  CreditCardIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { billingApi } from '../../services/api';
import toast from 'react-hot-toast';

interface PharmacyCopayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (action: 'collected' | 'waived') => void;
  prescriptionId: string;
  patientName: string;
}

interface MedicationCopay {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  insuranceCoverage: number;
  patientPays: number;
}

interface PharmacyCopayInfo {
  hasCopay: boolean;
  prescriptionId: string;
  medications: MedicationCopay[];
  totalCost: number;
  insuranceCovers: number;
  patientPays: number;
  coveragePercentage: number;
  insuranceProvider: string | null;
  policyNumber: string | null;
  networkStatus: string;
  copayCollected: boolean;
  noInsurance: boolean;
}

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD';

export default function PharmacyCopayModal({
  isOpen,
  onClose,
  onSuccess,
  prescriptionId,
  patientName,
}: PharmacyCopayModalProps) {
  const [loading, setLoading] = useState(true);
  const [copayInfo, setCopayInfo] = useState<PharmacyCopayInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [waiverReason, setWaiverReason] = useState('');
  const [showWaiverInput, setShowWaiverInput] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && prescriptionId) {
      fetchCopayInfo();
    }
  }, [isOpen, prescriptionId]);

  const fetchCopayInfo = async () => {
    setLoading(true);
    try {
      const response = await billingApi.getPharmacyCopay(prescriptionId);
      setCopayInfo(response.data.data);
    } catch (error) {
      console.error('Failed to calculate pharmacy copay:', error);
      toast.error('Failed to load copay information');
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async () => {
    if (!copayInfo) return;

    setProcessing(true);
    try {
      await billingApi.collectPharmacyCopay({
        prescriptionId,
        amount: copayInfo.patientPays,
        paymentMethod,
      });
      toast.success('Pharmacy copay collected successfully');
      onSuccess('collected');
      onClose();
    } catch (error) {
      console.error('Failed to collect copay:', error);
      toast.error('Failed to collect copay');
    } finally {
      setProcessing(false);
    }
  };

  const handleWaive = async () => {
    if (!waiverReason.trim()) {
      toast.error('Please provide a reason for waiving the copay');
      return;
    }

    setProcessing(true);
    try {
      await billingApi.collectPharmacyCopay({
        prescriptionId,
        amount: 0,
        paymentMethod: 'CASH',
        waived: true,
        waiverReason,
      });
      toast.success('Pharmacy copay waived');
      onSuccess('waived');
      onClose();
    } catch (error) {
      console.error('Failed to waive copay:', error);
      toast.error('Failed to waive copay');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Pharmacy Copay</h2>
              <p className="text-sm text-gray-500 mt-1">{patientName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : copayInfo?.copayCollected ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">Copay Already Collected</h3>
                <p className="text-gray-500 mt-2">This prescription's copay has been collected.</p>
                <button
                  onClick={onClose}
                  className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Continue to Dispense
                </button>
              </div>
            ) : copayInfo ? (
              <>
                {/* Insurance Info */}
                {copayInfo.noInsurance ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800">No Insurance on File</p>
                        <p className="text-sm text-orange-600 mt-1">
                          Patient will pay full amount for medications.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <ShieldCheckIcon className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800">{copayInfo.insuranceProvider}</p>
                        <p className="text-sm text-blue-600 mt-1">
                          Policy: {copayInfo.policyNumber} | {copayInfo.networkStatus === 'IN_NETWORK' ? '✅ In-Network' : '⚠️ Out-of-Network'}
                        </p>
                        <p className="text-sm text-blue-600">
                          Coverage: {copayInfo.coveragePercentage}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Medications List */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Medications</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {copayInfo.medications.map((med, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{med.name}</p>
                          <p className="text-xs text-gray-500">
                            Qty: {med.quantity} × AED {med.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500 line-through">
                            AED {med.totalPrice.toFixed(2)}
                          </p>
                          <p className="font-semibold text-gray-900">
                            AED {med.patientPays.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Total Cost</span>
                    <span className="font-medium">AED {copayInfo.totalCost.toFixed(2)}</span>
                  </div>
                  {!copayInfo.noInsurance && (
                    <div className="flex justify-between text-sm mb-2 text-green-600">
                      <span>Insurance Covers ({copayInfo.coveragePercentage}%)</span>
                      <span>- AED {copayInfo.insuranceCovers.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 mt-2">
                    <span>Patient Pays</span>
                    <span className="text-primary-600">AED {copayInfo.patientPays.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                {copayInfo.patientPays > 0 && !showWaiverInput && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment Method</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMethod('CASH')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          paymentMethod === 'CASH'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <BanknotesIcon className="h-5 w-5" />
                        <span className="font-medium">Cash</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('CREDIT_CARD')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          paymentMethod === 'CREDIT_CARD'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <CreditCardIcon className="h-5 w-5" />
                        <span className="font-medium">Card</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Waiver Input */}
                {showWaiverInput && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Waiver
                    </label>
                    <textarea
                      value={waiverReason}
                      onChange={(e) => setWaiverReason(e.target.value)}
                      placeholder="Enter reason for waiving copay..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  {showWaiverInput ? (
                    <>
                      <button
                        onClick={() => setShowWaiverInput(false)}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleWaive}
                        disabled={processing || !waiverReason.trim()}
                        className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium disabled:opacity-50"
                      >
                        {processing ? 'Processing...' : 'Confirm Waiver'}
                      </button>
                    </>
                  ) : copayInfo.patientPays > 0 ? (
                    <>
                      <button
                        onClick={() => setShowWaiverInput(true)}
                        className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
                      >
                        Waive
                      </button>
                      <button
                        onClick={handleCollect}
                        disabled={processing}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-medium shadow-lg disabled:opacity-50"
                      >
                        {processing ? 'Processing...' : `Collect AED ${copayInfo.patientPays.toFixed(2)}`}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        onSuccess('collected');
                        onClose();
                      }}
                      className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-medium shadow-lg"
                    >
                      No Copay Required - Continue
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-red-500">
                Failed to load copay information
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
