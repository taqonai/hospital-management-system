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
  InformationCircleIcon,
  ArrowsRightLeftIcon,
  SparklesIcon,
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

// Cross-verification alert types
interface VerificationAlert {
  type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  details?: {
    dbValue?: string | number;
    dhaValue?: string | number;
    field?: string;
  };
  actions?: Array<{
    label: string;
    action: string;
  }>;
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
  copayAmount?: number;
  message?: string;
  warnings?: string[];
  verificationSource: 'CACHED' | 'DHA_ECLAIM' | 'PAYER_API' | 'MANUAL';
  // Cross-verification fields
  alerts?: VerificationAlert[];
  requiresEidVerification?: boolean;
  policyWasRenewed?: boolean;
  coverageChanged?: boolean;
  hasMismatch?: boolean;
  previousCoverage?: {
    provider?: string;
    coveragePercentage?: number;
    copayPercentage?: number;
    copayAmount?: number;
  };
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
    const numbers = value.replace(/\D/g, '');
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

      // Show appropriate toast based on result
      if (data.eligibility?.policyWasRenewed) {
        toast.success('Insurance policy has been renewed!', { icon: '🎉' });
      } else if (data.eligibility?.hasMismatch) {
        toast.error('Insurance verification mismatch detected');
      } else if (data.eligibility?.coverageChanged) {
        toast('Coverage terms have changed since last visit', { icon: '⚠️' });
      } else if (data.patient) {
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

  const handleAlertAction = (action: string, patientId?: string) => {
    switch (action) {
      case 'USE_DB_DATA':
        if (result?.patient && result?.eligibility) {
          onPatientFound(result.patient, result.eligibility);
        }
        break;
      case 'TREAT_AS_SELFPAY':
        if (result?.patient) {
          onPatientFound(result.patient, {
            ...result.eligibility!,
            eligible: false,
            policyStatus: 'NOT_FOUND',
            message: 'Patient opted for self-pay',
          });
        }
        break;
      case 'UPDATE_INSURANCE':
        if (patientId) {
          window.open(`/patients/${patientId}?tab=insurance`, '_blank');
        }
        break;
      case 'VERIFY_EID':
        handleLookup();
        break;
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

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'ERROR':
        return <XCircleIcon className="h-6 w-6 text-red-600" />;
      case 'WARNING':
        return <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />;
      default:
        return <InformationCircleIcon className="h-6 w-6 text-blue-600" />;
    }
  };

  const getAlertStyles = (severity: string) => {
    switch (severity) {
      case 'ERROR':
        return 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300';
      case 'WARNING':
        return 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300';
      default:
        return 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300';
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
          {/* Cross-Verification Alerts - Scenarios A, B, D */}
          {result.eligibility?.alerts && result.eligibility.alerts.length > 0 && (
            <div className="space-y-3">
              {result.eligibility.alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`rounded-xl p-4 border-2 ${getAlertStyles(alert.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                        {alert.type === 'POLICY_RENEWED' && (
                          <SparklesIcon className="h-5 w-5 text-green-500" />
                        )}
                        {alert.type === 'MISMATCH_DB_VS_DHA' && (
                          <ArrowsRightLeftIcon className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                      
                      {/* Show comparison details */}
                      {alert.details && (
                        <div className="bg-white/60 rounded-lg p-2 mb-3 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-500">Our Records:</span>
                              <p className="font-medium">{alert.details.dbValue || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">DHA Response:</span>
                              <p className="font-medium">{alert.details.dhaValue || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {alert.actions && alert.actions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {alert.actions.map((action, actionIndex) => (
                            <button
                              key={actionIndex}
                              onClick={() => handleAlertAction(action.action, result.patient?.id)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                action.action === 'TREAT_AS_SELFPAY'
                                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  : action.action === 'UPDATE_INSURANCE'
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Policy Renewed Banner */}
          {result.eligibility?.policyWasRenewed && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-300">
              <div className="flex items-center gap-3">
                <SparklesIcon className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-bold text-green-900">Policy Renewed!</h3>
                  <p className="text-sm text-green-700">
                    Insurance records have been automatically updated from DHA.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Coverage Changed Banner */}
          {result.eligibility?.coverageChanged && result.eligibility.previousCoverage && (
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border-2 border-yellow-300">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-yellow-900">Coverage Terms Changed</h3>
                  <p className="text-sm text-yellow-700 mb-2">
                    Some insurance terms have changed since the last visit.
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-white/60 rounded-lg p-2">
                    <div>
                      <span className="text-gray-500">Previous Coverage:</span>
                      <p className="font-medium">{result.eligibility.previousCoverage.coveragePercentage}%</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Current Coverage:</span>
                      <p className="font-medium">{result.eligibility.coveragePercentage}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
          {result.eligibility && !result.eligibility.hasMismatch && (
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
                      (Using cached data - DHA verification recommended)
                    </span>
                  )}
                  {result.eligibility.verificationSource === 'DHA_ECLAIM' && (
                    <span className="text-green-600 ml-2">
                      ✓ Real-time DHA verification
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
