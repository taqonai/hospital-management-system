import { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  ShieldCheckIcon,
  UserIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { CurrencyDisplay } from '../common';

interface CostEstimateProps {
  patientId?: string;
  totalCost: number;
  coveragePercentage?: number; // From patient's insurance, defaults to 0 for self-pay
  insuranceProvider?: string;
  networkStatus?: 'IN_NETWORK' | 'OUT_OF_NETWORK';
  showBreakdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function CostEstimate({
  patientId,
  totalCost,
  coveragePercentage = 0,
  insuranceProvider,
  networkStatus = 'IN_NETWORK',
  showBreakdown = true,
  size = 'md',
  className = '',
}: CostEstimateProps) {
  // Adjust coverage for out-of-network
  const effectiveCoverage = networkStatus === 'OUT_OF_NETWORK' 
    ? Math.min(coveragePercentage, 50) // Max 50% for out-of-network
    : coveragePercentage;

  const insuranceCovers = (totalCost * effectiveCoverage) / 100;
  const patientPays = totalCost - insuranceCovers;

  const sizeClasses = {
    sm: 'text-xs p-2',
    md: 'text-sm p-3',
    lg: 'text-base p-4',
  };

  if (totalCost === 0) return null;

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg ${sizeClasses[size]} ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <CurrencyDollarIcon className={`${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} text-gray-500`} />
        <span className="font-medium text-gray-700">Cost Estimate</span>
        {insuranceProvider && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheckIcon className="h-3 w-3" />
            {insuranceProvider}
          </span>
        )}
      </div>

      {showBreakdown ? (
        <div className="space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Total Service Cost</span>
            <span className="font-medium">AED {totalCost.toFixed(2)}</span>
          </div>
          
          {effectiveCoverage > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-1">
                <ShieldCheckIcon className="h-3 w-3" />
                Insurance ({effectiveCoverage}%{networkStatus === 'OUT_OF_NETWORK' ? ' OON' : ''})
              </span>
              <span>- AED {insuranceCovers.toFixed(2)}</span>
            </div>
          )}
          
          <div className={`flex justify-between pt-1 border-t border-gray-200 ${size === 'lg' ? 'text-lg' : ''} font-bold`}>
            <span className="flex items-center gap-1 text-gray-700">
              <UserIcon className="h-4 w-4" />
              Patient Pays
            </span>
            <span className={patientPays === totalCost ? 'text-orange-600' : 'text-primary-600'}>
              AED {patientPays.toFixed(2)}
            </span>
          </div>
        </div>
      ) : (
        // Compact view
        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            {effectiveCoverage > 0 ? `Insurance: ${effectiveCoverage}%` : 'Self-Pay'}
          </span>
          <span className="font-bold text-primary-600">
            Patient: AED {patientPays.toFixed(2)}
          </span>
        </div>
      )}

      {networkStatus === 'OUT_OF_NETWORK' && (
        <div className="mt-2 flex items-start gap-1 text-xs text-orange-600">
          <InformationCircleIcon className="h-4 w-4 flex-shrink-0" />
          <span>Out-of-network: reduced coverage applies</span>
        </div>
      )}
    </div>
  );
}

// Hook to fetch patient insurance and calculate cost
export function useCostEstimate(patientId?: string) {
  const [insuranceInfo, setInsuranceInfo] = useState<{
    hasInsurance: boolean;
    coveragePercentage: number;
    insuranceProvider?: string;
    networkStatus: 'IN_NETWORK' | 'OUT_OF_NETWORK';
  }>({
    hasInsurance: false,
    coveragePercentage: 0,
    networkStatus: 'IN_NETWORK',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setInsuranceInfo({
        hasInsurance: false,
        coveragePercentage: 0,
        networkStatus: 'IN_NETWORK',
      });
      return;
    }

    const fetchInsurance = async () => {
      setLoading(true);
      try {
        const { insuranceCodingApi } = await import('../../services/api');
        const response = await insuranceCodingApi.verifyEligibility({ patientId });
        const data = response.data.data;
        
        if (data.eligible && data.insuranceProvider) {
          setInsuranceInfo({
            hasInsurance: true,
            coveragePercentage: data.coveragePercentage || 80,
            insuranceProvider: data.insuranceProvider,
            networkStatus: data.networkStatus || 'IN_NETWORK',
          });
        } else {
          setInsuranceInfo({
            hasInsurance: false,
            coveragePercentage: 0,
            networkStatus: 'IN_NETWORK',
          });
        }
      } catch (error) {
        console.error('Failed to fetch patient insurance:', error);
        setInsuranceInfo({
          hasInsurance: false,
          coveragePercentage: 0,
          networkStatus: 'IN_NETWORK',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInsurance();
  }, [patientId]);

  return { ...insuranceInfo, loading };
}
