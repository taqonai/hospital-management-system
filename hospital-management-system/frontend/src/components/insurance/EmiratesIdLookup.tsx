import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  emiratesId?: string;
  hasInsurance: boolean;
  primaryInsurance?: {
    providerName: string;
    policyNumber: string;
    coverageType: string;
    networkTier: string;
  };
}

interface EligibilityInfo {
  eligible: boolean;
  emiratesId?: string;
  patientName?: string;
  insuranceProvider?: string;
  policyNumber?: string;
  policyStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'NOT_FOUND';
  networkStatus: 'IN_NETWORK' | 'OUT_OF_NETWORK' | 'UNKNOWN';
  planType?: string;
  coveragePercentage?: number;
  copayPercentage?: number;
  message?: string;
  warnings?: string[];
  verificationSource: 'CACHED' | 'DHA_ECLAIM' | 'PAYER_API' | 'MANUAL';
}

interface EmiratesIdLookupProps {
  onPatientFound: (patient: Patient, eligibility: EligibilityInfo) => void;
  onCreateNew?: (emiratesId: string) => void;
}

export default function EmiratesIdLookup({ onPatientFound, onCreateNew }: EmiratesIdLookupProps) {
  const [emiratesId, setEmiratesId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    patient: Patient | null;
    eligibility: EligibilityInfo | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Format Emirates ID as user types (784-XXXX-XXXXXXX-X)
  const formatEmiratesId = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, '');
    
    // Format as 784-XXXX-XXXXXXX-X
    let formatted = '';
    if (numbers.length > 0) {
      formatted = numbers.substring(0, 3);
      if (numbers.length > 3) {
        formatted += '-' + numbers.substring(3, 7);
      }
      if (numbers.length > 7) {
        formatted += '-' + numbers.substring(7, 14);
      }
      if (numbers.length > 14) {
        formatted += '-' + numbers.substring(14, 15);
      }
    }
    return formatted;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatEmiratesId(e.target.value);
    setEmiratesId(formatted);
    setResult(null);
    setError(null);
  };

  const handleLookup = async () => {
    if (!emiratesId || emiratesId.replace(/-/g, '').length < 15) {
      toast.error('Please enter a valid Emirates ID (15 digits)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/insurance-coding/eligibility/verify-eid', {
        emiratesId: emiratesId.replace(/-/g, ''),
      });

      const data = response.data.data;
      setResult(data);

      if (data.patient) {
        toast.success(`Patient found: ${data.patient.firstName} ${data.patient.lastName}`);
      } else if (data.eligibility?.eligible) {
        toast.success('Insurance verified. Patient not in system - register to continue.');
      } else {
        toast('Patient not found and no active insurance detected.', { icon: '⚠️' });
      }
    } catch (err: any) {
      console.error('EID lookup failed:', err);
      setError(err.response?.data?.message || 'Failed to verify Emirates ID');
      toast.error('Lookup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = () => {
    if (result?.patient && result?.eligibility) {
      onPatientFound(result.patient, result.eligibility);
    }
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew(emiratesId.replace(/-/g, ''));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircleIcon className="h-4 w-4" /> Active
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircleIcon className="h-4 w-4" /> Expired
          </span>
        );
      case 'INACTIVE':
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
            <ExclamationTriangleIcon className="h-4 w-4" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            <XCircleIcon className="h-4 w-4" /> Not Found
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <IdentificationIcon className="h-4 w-4 inline mr-1" />
          Emirates ID (EID)
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={emiratesId}
            onChange={handleInputChange}
            placeholder="784-XXXX-XXXXXXX-X"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono text-lg"
            maxLength={18}
          />
          <button
            onClick={handleLookup}
            disabled={loading || emiratesId.replace(/-/g, '').length < 15}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="h-5 w-5" />
                Lookup
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Enter the patient's Emirates ID to verify their identity and insurance coverage
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-800">
            <XCircleIcon className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Patient Found */}
          {result.patient ? (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-900">
                      {result.patient.firstName} {result.patient.lastName}
                    </h3>
                    <p className="text-sm text-green-700">
                      MRN: {result.patient.mrn} | DOB: {new Date(result.patient.dateOfBirth).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-green-600">
                      📱 {result.patient.phone} {result.patient.email && `| ✉️ ${result.patient.email}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSelectPatient}
                  className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Select Patient
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border-2 border-orange-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-full">
                  <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-orange-900">Patient Not Found</h3>
                  <p className="text-sm text-orange-700 mb-3">
                    No patient record found with this Emirates ID.
                    {result.eligibility?.eligible && ' Insurance coverage was verified.'}
                  </p>
                  {onCreateNew && (
                    <button
                      onClick={handleCreateNew}
                      className="px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                    >
                      <UserPlusIcon className="h-4 w-4" />
                      Register New Patient
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Insurance Eligibility */}
          {result.eligibility && (
            <div className={`rounded-xl p-4 border-2 ${
              result.eligibility.eligible 
                ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheckIcon className={`h-6 w-6 ${
                  result.eligibility.eligible ? 'text-purple-600' : 'text-gray-400'
                }`} />
                <h3 className="text-lg font-bold text-gray-900">Insurance Verification</h3>
                {getStatusBadge(result.eligibility.policyStatus)}
              </div>

              {result.eligibility.eligible ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Provider:</span>
                    <p className="font-semibold">{result.eligibility.insuranceProvider}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Policy #:</span>
                    <p className="font-semibold">{result.eligibility.policyNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Plan Type:</span>
                    <p className="font-semibold">{result.eligibility.planType}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Network:</span>
                    <p className={`font-semibold ${
                      result.eligibility.networkStatus === 'IN_NETWORK' ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {result.eligibility.networkStatus === 'IN_NETWORK' ? '✅ In-Network' : '⚠️ Out-of-Network'}
                    </p>
                  </div>
                  {result.eligibility.coveragePercentage && (
                    <div>
                      <span className="text-gray-500">Coverage:</span>
                      <p className="font-semibold text-green-600">{result.eligibility.coveragePercentage}%</p>
                    </div>
                  )}
                  {result.eligibility.copayPercentage && (
                    <div>
                      <span className="text-gray-500">Copay:</span>
                      <p className="font-semibold text-blue-600">{result.eligibility.copayPercentage}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-600">{result.eligibility.message || 'No active insurance coverage found.'}</p>
                  <p className="text-sm text-gray-500 mt-2">Patient will be treated as self-pay.</p>
                </div>
              )}

              {/* Verification Source */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Verified via: {result.eligibility.verificationSource.replace('_', ' ')}
                  {result.eligibility.verificationSource === 'CACHED' && (
                    <span className="text-orange-600 ml-2">
                      (For real-time DHA verification, enable eClaimLink integration)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
