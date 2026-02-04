import { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { insuranceCodingApi } from '../../services/api';
import toast from 'react-hot-toast';

interface InsuranceInfo {
  id: string;
  providerName: string;
  policyNumber: string;
  coverageType: string;
  effectiveDate: string;
  expiryDate?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  networkTier: string;
  copay?: number;
  deductible?: number;
  annualDeductible?: number;
  annualCopayMax?: number;
  isPrimary: boolean;
}

interface EligibilityResult {
  eligible: boolean;
  insuranceProvider?: string;
  policyNumber?: string;
  coveragePercentage?: number;
  copayPercentage?: number;
  networkStatus?: string;
  preAuthRequired?: boolean;
  preAuthPhone?: string;
  message?: string;
  verificationSource?: string;
}

interface IPDInsuranceVerificationProps {
  patientId: string;
  patientName: string;
  admissionType: 'EMERGENCY' | 'ELECTIVE' | 'TRANSFER';
  onVerificationComplete: (result: {
    hasInsurance: boolean;
    insuranceId?: string;
    preAuthRequired: boolean;
    proceedAsSelfPay: boolean;
    eligibility?: EligibilityResult;
  }) => void;
}

export default function IPDInsuranceVerification({
  patientId,
  patientName,
  admissionType,
  onVerificationComplete,
}: IPDInsuranceVerificationProps) {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [insurance, setInsurance] = useState<InsuranceInfo | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [showEidLookup, setShowEidLookup] = useState(false);
  const [emiratesId, setEmiratesId] = useState('');

  useEffect(() => {
    fetchPatientInsurance();
  }, [patientId]);

  const fetchPatientInsurance = async () => {
    setLoading(true);
    try {
      // Fetch patient's insurance and verify eligibility
      const response = await insuranceCodingApi.verifyEligibility({ patientId });
      const data = response.data.data;
      
      // API returns flat structure with eligible, insuranceProvider, etc.
      if (data.eligible && data.insuranceProvider) {
        // Map API response to our InsuranceInfo format
        setInsurance({
          id: data.insuranceId || patientId, // fallback to patientId if no insuranceId
          providerName: data.insuranceProvider,
          policyNumber: data.policyNumber || '',
          coverageType: data.planType || 'Standard',
          effectiveDate: data.policyStartDate || new Date().toISOString(),
          expiryDate: data.policyEndDate,
          verificationStatus: data.verificationStatus || (data.verificationSource === 'DHA_ECLAIM' ? 'VERIFIED' : 'PENDING'),
          networkTier: data.networkStatus || 'IN_NETWORK',
          copay: data.copayAmount,
          deductible: data.deductible?.remaining,
          annualDeductible: data.deductible?.annual,
          annualCopayMax: data.annualCopay?.max,
          isPrimary: true,
        });
        setEligibility({
          eligible: data.eligible,
          insuranceProvider: data.insuranceProvider,
          policyNumber: data.policyNumber,
          coveragePercentage: data.coveragePercentage || 80,
          copayPercentage: data.copayPercentage || 20,
          networkStatus: data.networkStatus,
          preAuthRequired: admissionType !== 'EMERGENCY', // Emergency doesn't need pre-auth
          message: data.message,
          verificationSource: data.verificationSource,
        });
      } else {
        setInsurance(null);
        setEligibility(null);
      }
    } catch (error) {
      console.error('Failed to verify insurance:', error);
      setInsurance(null);
      setEligibility(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEidLookup = async () => {
    if (!emiratesId.trim() || emiratesId.replace(/-/g, '').length !== 15) {
      toast.error('Please enter a valid Emirates ID');
      return;
    }

    setVerifying(true);
    try {
      const response = await insuranceCodingApi.verifyEligibility({ emiratesId, patientId });
      const data = response.data.data;
      
      if (data.eligible && data.insuranceProvider) {
        setInsurance({
          id: data.insuranceId || patientId,
          providerName: data.insuranceProvider,
          policyNumber: data.policyNumber || '',
          coverageType: data.planType || 'Standard',
          effectiveDate: data.policyStartDate || new Date().toISOString(),
          expiryDate: data.policyEndDate,
          verificationStatus: 'VERIFIED',
          networkTier: data.networkStatus || 'IN_NETWORK',
          copay: data.copayAmount,
          deductible: data.deductible?.remaining,
          annualDeductible: data.deductible?.annual,
          annualCopayMax: data.annualCopay?.max,
          isPrimary: true,
        });
        setEligibility({
          eligible: data.eligible,
          insuranceProvider: data.insuranceProvider,
          policyNumber: data.policyNumber,
          coveragePercentage: data.coveragePercentage || 80,
          copayPercentage: data.copayPercentage || 20,
          networkStatus: data.networkStatus,
          preAuthRequired: admissionType !== 'EMERGENCY',
          message: data.message,
          verificationSource: 'DHA_ECLAIM',
        });
        toast.success('Insurance found via Emirates ID');
        setShowEidLookup(false);
      } else {
        toast.error('No insurance found for this Emirates ID');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to lookup insurance');
    } finally {
      setVerifying(false);
    }
  };

  const handleProceed = (asSelfPay: boolean = false) => {
    onVerificationComplete({
      hasInsurance: !asSelfPay && !!insurance,
      insuranceId: insurance?.id,
      preAuthRequired: !asSelfPay && admissionType !== 'EMERGENCY' && (eligibility?.preAuthRequired ?? true),
      proceedAsSelfPay: asSelfPay,
      eligibility: eligibility || undefined,
    });
  };

  const isExpired = insurance?.expiryDate && new Date(insurance.expiryDate) < new Date();
  const isPending = insurance?.verificationStatus === 'PENDING';
  const isRejected = insurance?.verificationStatus === 'REJECTED';

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-600">Checking insurance...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
        Insurance Verification
      </div>

      {/* No Insurance Found */}
      {!insurance && !showEidLookup && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-orange-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-orange-800">No Insurance on File</h4>
              <p className="text-sm text-orange-600 mt-1">
                Patient {patientName} does not have active insurance coverage recorded.
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowEidLookup(true)}
                  className="px-4 py-2 bg-white border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 flex items-center gap-2 text-sm font-medium"
                >
                  <IdentificationIcon className="h-4 w-4" />
                  Lookup via Emirates ID
                </button>
                <button
                  type="button"
                  onClick={() => handleProceed(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
                >
                  Proceed as Self-Pay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emirates ID Lookup Form */}
      {showEidLookup && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <IdentificationIcon className="h-5 w-5" />
            Emirates ID Lookup
          </h4>
          <div className="flex gap-3">
            <input
              type="text"
              value={emiratesId}
              onChange={(e) => setEmiratesId(e.target.value)}
              placeholder="784-XXXX-XXXXXXX-X"
              className="flex-1 px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleEidLookup}
              disabled={verifying}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {verifying ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <MagnifyingGlassIcon className="h-4 w-4" />
              )}
              Verify
            </button>
            <button
              type="button"
              onClick={() => setShowEidLookup(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Insurance Found - Show Details */}
      {insurance && (
        <div className={`rounded-xl p-4 border ${
          isExpired || isRejected 
            ? 'bg-red-50 border-red-200' 
            : isPending 
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start gap-3">
            {isExpired || isRejected ? (
              <XCircleIcon className="h-6 w-6 text-red-500 mt-0.5" />
            ) : isPending ? (
              <ClockIcon className="h-6 w-6 text-yellow-500 mt-0.5" />
            ) : (
              <CheckCircleIcon className="h-6 w-6 text-green-500 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className={`font-semibold ${
                  isExpired || isRejected ? 'text-red-800' : isPending ? 'text-yellow-800' : 'text-green-800'
                }`}>
                  {insurance.providerName}
                </h4>
                {insurance.isPrimary && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    Primary
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
                <div>
                  <span className="text-gray-500">Policy:</span>
                  <span className="ml-2 font-medium">{insurance.policyNumber}</span>
                </div>
                <div>
                  <span className="text-gray-500">Coverage:</span>
                  <span className="ml-2 font-medium">{insurance.coverageType}</span>
                </div>
                <div>
                  <span className="text-gray-500">Network:</span>
                  <span className={`ml-2 font-medium ${
                    insurance.networkTier === 'IN_NETWORK' ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {insurance.networkTier === 'IN_NETWORK' ? '✅ In-Network' : '⚠️ Out-of-Network'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 font-medium ${
                    insurance.verificationStatus === 'VERIFIED' ? 'text-green-600' 
                    : insurance.verificationStatus === 'REJECTED' ? 'text-red-600'
                    : 'text-yellow-600'
                  }`}>
                    {insurance.verificationStatus}
                  </span>
                </div>
                {insurance.expiryDate && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Expiry:</span>
                    <span className={`ml-2 font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                      {new Date(insurance.expiryDate).toLocaleDateString()} {isExpired && '(EXPIRED)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Warning Messages */}
              {isExpired && (
                <div className="mt-3 p-3 bg-red-100 rounded-lg text-red-700 text-sm">
                  ⚠️ Insurance has expired. Patient should update insurance or proceed as self-pay.
                </div>
              )}
              {isRejected && (
                <div className="mt-3 p-3 bg-red-100 rounded-lg text-red-700 text-sm">
                  ⚠️ Insurance was rejected by DHA. Please verify manually or proceed as self-pay.
                </div>
              )}
              {isPending && (
                <div className="mt-3 p-3 bg-yellow-100 rounded-lg text-yellow-700 text-sm">
                  ⚡ Insurance is pending verification. Coverage may change after DHA verification.
                </div>
              )}

              {/* Pre-Auth Notice for Elective */}
              {admissionType === 'ELECTIVE' && !isExpired && !isRejected && (
                <div className="mt-3 p-3 bg-blue-100 rounded-lg text-blue-700 text-sm flex items-start gap-2">
                  <ShieldExclamationIcon className="h-5 w-5 mt-0.5" />
                  <div>
                    <strong>Pre-Authorization Required</strong>
                    <p>Elective admissions require pre-authorization. A request will be submitted automatically.</p>
                  </div>
                </div>
              )}
              {admissionType === 'EMERGENCY' && (
                <div className="mt-3 p-3 bg-green-100 rounded-lg text-green-700 text-sm flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 mt-0.5" />
                  <div>
                    <strong>Emergency Admission</strong>
                    <p>Pre-authorization is waived. Retrospective authorization will be submitted within 24 hours.</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                {(isExpired || isRejected) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowEidLookup(true)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium"
                    >
                      <IdentificationIcon className="h-4 w-4" />
                      Re-verify via Emirates ID
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProceed(true)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
                    >
                      Proceed as Self-Pay
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleProceed(false)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Proceed with Insurance
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
