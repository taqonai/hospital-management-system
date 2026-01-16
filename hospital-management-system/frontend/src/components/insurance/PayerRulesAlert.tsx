import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  DocumentCheckIcon,
  ClockIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface PayerAlert {
  type: 'preauth' | 'coverage' | 'documentation' | 'limit' | 'exclusion' | 'modifier';
  severity: 'critical' | 'warning' | 'info';
  code?: string; // ICD or CPT code
  codeType?: 'icd10' | 'cpt';
  message: string;
  action?: string;
  details?: string;
}

interface PayerRulesAlertProps {
  payerName?: string;
  alerts: PayerAlert[];
  onDismiss?: (alertIndex: number) => void;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export default function PayerRulesAlert({
  payerName,
  alerts,
  onDismiss,
  className,
  collapsible = true,
  defaultExpanded = true,
}: PayerRulesAlertProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);

  const visibleAlerts = alerts.filter((_, idx) => !dismissedAlerts.includes(idx));

  if (visibleAlerts.length === 0) {
    return null;
  }

  const criticalCount = visibleAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = visibleAlerts.filter((a) => a.severity === 'warning').length;

  const getAlertIcon = (alert: PayerAlert) => {
    switch (alert.type) {
      case 'preauth':
        return ShieldExclamationIcon;
      case 'coverage':
        return ExclamationTriangleIcon;
      case 'documentation':
        return DocumentCheckIcon;
      case 'limit':
        return ClockIcon;
      case 'exclusion':
        return XMarkIcon;
      case 'modifier':
        return InformationCircleIcon;
      default:
        return ExclamationTriangleIcon;
    }
  };

  const getSeverityStyles = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return {
          container: 'bg-red-50 border-red-200',
          icon: 'text-red-500',
          text: 'text-red-800',
          badge: 'bg-red-100 text-red-700',
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200',
          icon: 'text-yellow-500',
          text: 'text-yellow-800',
          badge: 'bg-yellow-100 text-yellow-700',
        };
      case 'info':
        return {
          container: 'bg-blue-50 border-blue-200',
          icon: 'text-blue-500',
          text: 'text-blue-800',
          badge: 'bg-blue-100 text-blue-700',
        };
    }
  };

  const getTypeLabel = (type: PayerAlert['type']) => {
    switch (type) {
      case 'preauth':
        return 'Pre-Authorization Required';
      case 'coverage':
        return 'Coverage Issue';
      case 'documentation':
        return 'Documentation Required';
      case 'limit':
        return 'Limit Exceeded';
      case 'exclusion':
        return 'Not Covered';
      case 'modifier':
        return 'Modifier Required';
      default:
        return 'Alert';
    }
  };

  const handleDismiss = (alertIndex: number) => {
    const originalIndex = alerts.findIndex(
      (_, idx) => !dismissedAlerts.includes(idx) && idx === alertIndex
    );
    setDismissedAlerts([...dismissedAlerts, originalIndex]);
    onDismiss?.(originalIndex);
  };

  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden',
        criticalCount > 0 ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50',
        className
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          'px-4 py-2 flex items-center justify-between',
          collapsible && 'cursor-pointer hover:bg-opacity-80',
          criticalCount > 0 ? 'bg-red-100' : 'bg-yellow-100'
        )}
        onClick={() => collapsible && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon
            className={clsx('h-5 w-5', criticalCount > 0 ? 'text-red-600' : 'text-yellow-600')}
          />
          <span
            className={clsx('font-medium text-sm', criticalCount > 0 ? 'text-red-800' : 'text-yellow-800')}
          >
            Payer Rules Alert{payerName && ` - ${payerName}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-xs font-medium">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full text-xs font-medium">
              {warningCount} Warning
            </span>
          )}
          {collapsible && (
            expanded ? (
              <ChevronUpIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            )
          )}
        </div>
      </div>

      {/* Alerts List */}
      {expanded && (
        <div className="divide-y divide-gray-200">
          {visibleAlerts.map((alert, idx) => {
            const styles = getSeverityStyles(alert.severity);
            const Icon = getAlertIcon(alert);

            return (
              <div
                key={idx}
                className={clsx('p-3', styles.container)}
              >
                <div className="flex items-start gap-3">
                  <Icon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', styles.icon)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded', styles.badge)}>
                        {getTypeLabel(alert.type)}
                      </span>
                      {alert.code && (
                        <span className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">
                          {alert.codeType === 'icd10' ? 'ICD-10' : 'CPT'}: {alert.code}
                        </span>
                      )}
                    </div>
                    <p className={clsx('text-sm mt-1', styles.text)}>{alert.message}</p>
                    {alert.details && (
                      <p className="text-xs text-gray-600 mt-1">{alert.details}</p>
                    )}
                    {alert.action && (
                      <div className="flex items-center gap-1 mt-2">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs text-green-700 font-medium">
                          Action: {alert.action}
                        </span>
                      </div>
                    )}
                  </div>
                  {onDismiss && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(idx);
                      }}
                      className="p-1 hover:bg-white hover:bg-opacity-50 rounded"
                    >
                      <XMarkIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
