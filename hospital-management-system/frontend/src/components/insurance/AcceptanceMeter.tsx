import { useMemo } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface RiskFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
}

interface AcceptanceMeterProps {
  probability: number; // 0.0 to 1.0
  riskLevel?: 'low' | 'medium' | 'high' | 'very_high';
  riskFactors?: RiskFactor[];
  recommendations?: string[];
  showDetails?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function AcceptanceMeter({
  probability,
  riskLevel,
  riskFactors = [],
  recommendations = [],
  showDetails = true,
  className,
  size = 'md',
}: AcceptanceMeterProps) {
  const percentage = Math.round(probability * 100);

  const getColor = useMemo(() => {
    if (percentage >= 90) return { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50' };
    if (percentage >= 70) return { bg: 'bg-yellow-500', text: 'text-yellow-700', light: 'bg-yellow-50' };
    if (percentage >= 50) return { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50' };
    return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' };
  }, [percentage]);

  const getLabel = useMemo(() => {
    if (percentage >= 90) return { text: 'Likely Approved', icon: CheckCircleIcon };
    if (percentage >= 70) return { text: 'Good Chance', icon: InformationCircleIcon };
    if (percentage >= 50) return { text: 'Review Recommended', icon: ExclamationTriangleIcon };
    return { text: 'High Risk', icon: XCircleIcon };
  }, [percentage]);

  const sizeClasses = {
    sm: {
      container: 'text-xs',
      bar: 'h-1.5',
      icon: 'h-4 w-4',
      percentage: 'text-lg',
    },
    md: {
      container: 'text-sm',
      bar: 'h-2',
      icon: 'h-5 w-5',
      percentage: 'text-2xl',
    },
    lg: {
      container: 'text-base',
      bar: 'h-3',
      icon: 'h-6 w-6',
      percentage: 'text-3xl',
    },
  };

  const StatusIcon = getLabel.icon;

  return (
    <div className={clsx('rounded-lg border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className={clsx('p-3', getColor.light)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={clsx(sizeClasses[size].icon, getColor.text)} />
            <span className={clsx('font-medium', getColor.text, sizeClasses[size].container)}>
              Claim Acceptance
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={clsx('font-bold', getColor.text, sizeClasses[size].percentage)}>
              {percentage}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={clsx('w-full bg-gray-200 rounded-full mt-2', sizeClasses[size].bar)}>
          <div
            className={clsx('rounded-full transition-all duration-500', getColor.bg, sizeClasses[size].bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Status Label */}
        <div className="flex items-center justify-between mt-2">
          <span className={clsx('font-medium', getColor.text, sizeClasses[size].container)}>
            {getLabel.text}
          </span>
          {riskLevel && (
            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', getColor.light, getColor.text)}>
              {riskLevel.replace('_', ' ').toUpperCase()} RISK
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      {showDetails && (riskFactors.length > 0 || recommendations.length > 0) && (
        <div className="p-3 bg-white border-t border-gray-100 space-y-3">
          {/* Risk Factors */}
          {riskFactors.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Risk Factors
              </h4>
              <div className="flex flex-wrap gap-1">
                {riskFactors.map((rf, idx) => (
                  <span
                    key={idx}
                    className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      rf.impact === 'positive'
                        ? 'bg-green-50 text-green-700'
                        : rf.impact === 'negative'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {rf.impact === 'positive' && '+ '}
                    {rf.impact === 'negative' && '- '}
                    {rf.factor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Recommendations
              </h4>
              <ul className="space-y-1">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <InformationCircleIcon className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
