import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { insuranceCodingApi } from '../../services/api';
import toast from 'react-hot-toast';

// Configurable threshold - procedures above this cost require pre-auth
export const PRE_AUTH_THRESHOLD = 500; // AED

// Procedures that always require pre-auth (regardless of cost)
export const PRE_AUTH_REQUIRED_PROCEDURES = ['MRI', 'CT', 'PET', 'SURGERY'];

interface PreAuthWarningProps {
  patientId: string;
  patientName: string;
  procedureType: string; // 'MRI', 'CT', 'LAB_PANEL', etc.
  procedureName: string;
  estimatedCost: number;
  insuranceProvider?: string;
  policyNumber?: string;
  onPreAuthCreated: (preAuthId: string) => void;
  onProceedAsSelfPay: () => void;
  onCancel: () => void;
}

export function requiresPreAuth(procedureType: string, estimatedCost: number): boolean {
  // Check if procedure type requires pre-auth
  if (PRE_AUTH_REQUIRED_PROCEDURES.some(p => procedureType.toUpperCase().includes(p))) {
    return true;
  }
  // Check if cost exceeds threshold
  return estimatedCost >= PRE_AUTH_THRESHOLD;
}

export default function PreAuthWarning({
  patientId,
  patientName,
  procedureType,
  procedureName,
  estimatedCost,
  insuranceProvider,
  policyNumber,
  onPreAuthCreated,
  onProceedAsSelfPay,
  onCancel,
}: PreAuthWarningProps) {
  const [submitting, setSubmitting] = useState(false);
  const [preAuthStatus, setPreAuthStatus] = useState<'pending' | 'submitted' | 'approved' | 'denied' | null>(null);
  const [preAuthId, setPreAuthId] = useState<string | null>(null);

  const handleSubmitPreAuth = async () => {
    setSubmitting(true);
    try {
      // Create pre-auth request
      const response = await insuranceCodingApi.createPreAuth({
        patientId,
        procedureCode: procedureType,
        procedureDescription: procedureName,
        estimatedCost,
        urgency: 'ROUTINE',
        diagnosisCode: 'Z00.00', // General examination - should come from consultation
        clinicalJustification: `${procedureName} requested for patient ${patientName}`,
      });

      const preAuth = response.data.data;
      setPreAuthId(preAuth.id);
      setPreAuthStatus('submitted');
      toast.success('Pre-authorization request submitted');
      
      // Notify parent
      onPreAuthCreated(preAuth.id);
    } catch (error: any) {
      console.error('Failed to submit pre-auth:', error);
      toast.error(error.response?.data?.message || 'Failed to submit pre-authorization');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <ShieldExclamationIcon className="h-8 w-8 text-orange-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-orange-800">
            Pre-Authorization Required
          </h3>
          <p className="text-sm text-orange-700 mt-1">
            DHA requires pre-authorization for this procedure before scheduling.
            Claims submitted without pre-auth may be rejected.
          </p>

          {/* Procedure Details */}
          <div className="bg-white rounded-lg p-4 mt-4 border border-orange-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Procedure:</span>
                <p className="font-medium text-gray-900">{procedureName}</p>
              </div>
              <div>
                <span className="text-gray-500">Estimated Cost:</span>
                <p className="font-medium text-gray-900">AED {estimatedCost.toFixed(2)}</p>
              </div>
              {insuranceProvider && (
                <>
                  <div>
                    <span className="text-gray-500">Insurance:</span>
                    <p className="font-medium text-gray-900">{insuranceProvider}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Policy:</span>
                    <p className="font-medium text-gray-900">{policyNumber || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Pre-auth status */}
          {preAuthStatus === 'submitted' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4 flex items-center gap-2">
              <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
              <span className="text-blue-700 text-sm">
                Pre-authorization request submitted. Awaiting insurer response...
              </span>
            </div>
          )}

          {preAuthStatus === 'approved' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              <span className="text-green-700 text-sm">
                Pre-authorization approved! You may proceed with scheduling.
              </span>
            </div>
          )}

          {preAuthStatus === 'denied' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4 flex items-center gap-2">
              <XCircleIcon className="h-5 w-5 text-red-500" />
              <span className="text-red-700 text-sm">
                Pre-authorization denied. Patient may proceed as self-pay.
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-4">
            {!preAuthStatus && (
              <>
                <button
                  onClick={handleSubmitPreAuth}
                  disabled={submitting}
                  className="flex-1 min-w-[140px] px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ShieldExclamationIcon className="h-4 w-4" />
                      Request Pre-Auth
                    </>
                  )}
                </button>
                <button
                  onClick={onProceedAsSelfPay}
                  className="flex-1 min-w-[140px] px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
                >
                  <CurrencyDollarIcon className="h-4 w-4" />
                  Self-Pay (AED {estimatedCost.toFixed(0)})
                </button>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            )}

            {preAuthStatus === 'submitted' && (
              <>
                <button
                  onClick={() => {
                    // In a real scenario, we'd poll for status or use websockets
                    // For now, let the user proceed with pending pre-auth
                    onPreAuthCreated(preAuthId!);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Proceed (Pre-Auth Pending)
                </button>
                <button
                  onClick={onProceedAsSelfPay}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Switch to Self-Pay
                </button>
              </>
            )}

            {preAuthStatus === 'approved' && (
              <button
                onClick={() => onPreAuthCreated(preAuthId!)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Proceed with Approved Pre-Auth
              </button>
            )}

            {preAuthStatus === 'denied' && (
              <>
                <button
                  onClick={onProceedAsSelfPay}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Proceed as Self-Pay
                </button>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  Cancel Order
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
