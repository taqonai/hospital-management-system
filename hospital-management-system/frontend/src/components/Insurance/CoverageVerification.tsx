import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface CoverageVerificationProps {
  patientId: string;
  procedureCPTCode?: string;
  diagnosisICDCode?: string;
}

interface CoverageDetails {
  isActive: boolean;
  copayAmount: number | null;
  copayPercentage: number | null;
  deductible: number | null;
  deductibleRemaining: number | null;
  requiresPreAuth: boolean;
  coveragePercentage: number;
  estimatedPatientResponsibility: number;
  estimatedInsuranceCoverage: number;
}

const CoverageVerification: React.FC<CoverageVerificationProps> = ({
  patientId,
  procedureCPTCode,
  diagnosisICDCode,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Verify coverage
  const { data: coverage, isLoading, error } = useQuery<CoverageDetails>({
    queryKey: ['coverageVerification', patientId, procedureCPTCode, diagnosisICDCode],
    queryFn: async () => {
      if (!procedureCPTCode || !diagnosisICDCode) {
        return null;
      }
      const response = await api.post('/pre-auth/verify-coverage', {
        patientId,
        procedureCPTCode,
        diagnosisICDCode,
      });
      return response.data.data;
    },
    enabled: !!patientId && !!procedureCPTCode && !!diagnosisICDCode,
  });

  if (!procedureCPTCode || !diagnosisICDCode) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600">
          <InformationCircleIcon className="h-5 w-5" />
          <span className="text-sm">
            Enter procedure and diagnosis codes to verify coverage
          </span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-sm text-gray-600">Verifying coverage...</span>
        </div>
      </div>
    );
  }

  if (error || !coverage) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <XCircleIcon className="h-5 w-5" />
          <span className="text-sm font-medium">
            Unable to verify coverage
          </span>
        </div>
      </div>
    );
  }

  if (!coverage.isActive) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <XCircleIcon className="h-5 w-5" />
          <span className="text-sm font-medium">
            No active insurance coverage found
          </span>
        </div>
        <p className="mt-2 text-sm text-red-700">
          Patient will be responsible for 100% of charges
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className="text-sm font-semibold text-gray-900">
              Insurance Coverage Active
            </span>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Coverage Percentage */}
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              Coverage
            </span>
            <p className="text-2xl font-bold text-blue-600">
              {coverage.coveragePercentage}%
            </p>
          </div>

          {/* Patient Responsibility */}
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              Patient Pays
            </span>
            <p className="text-2xl font-bold text-gray-900">
              AED {coverage.estimatedPatientResponsibility.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Pre-Auth Warning */}
        {coverage.requiresPreAuth && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Pre-Authorization Required
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  This procedure requires insurance pre-authorization before
                  service can be rendered
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Breakdown */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            {/* Copay */}
            {coverage.copayAmount !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Copay (per visit)</span>
                <span className="font-medium text-gray-900">
                  AED {coverage.copayAmount.toFixed(2)}
                </span>
              </div>
            )}

            {/* Deductible */}
            {coverage.deductible !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Annual Deductible</span>
                <span className="font-medium text-gray-900">
                  AED {coverage.deductible.toFixed(2)}
                </span>
              </div>
            )}

            {coverage.deductibleRemaining !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 pl-4">• Remaining</span>
                <span className="font-medium text-orange-600">
                  AED {coverage.deductibleRemaining.toFixed(2)}
                </span>
              </div>
            )}

            {/* Insurance Coverage */}
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-600">Insurance Will Cover</span>
              <span className="font-semibold text-green-600">
                AED {coverage.estimatedInsuranceCoverage.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          * Estimated amounts based on current coverage. Actual charges may vary.
        </p>
      </div>
    </div>
  );
};

export default CoverageVerification;
