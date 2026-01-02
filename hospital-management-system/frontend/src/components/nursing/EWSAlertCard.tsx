import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface EWSAlert {
  id: string;
  patientId: string;
  patientName: string;
  ward: string;
  bed: string;
  severity: string;
  title: string;
  news2Score: number;
  riskLevel: string;
  scoreBreakdown?: Record<string, number>;
  components: string[];
  clinicalResponse: string;
  hasExtremeScore?: boolean;
  timestamp: string;
  status: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

interface EWSAlertCardProps {
  alert: EWSAlert;
  onAcknowledge?: (alertId: string, notes?: string) => void;
  onViewPatient?: (patientId: string) => void;
  compact?: boolean;
}

export default function EWSAlertCard({
  alert,
  onAcknowledge,
  onViewPatient,
  compact = false,
}: EWSAlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [showAcknowledgeForm, setShowAcknowledgeForm] = useState(false);

  const getSeverityStyles = () => {
    switch (alert.severity) {
      case 'critical':
        return {
          border: 'border-red-500 border-l-4',
          bg: 'bg-red-50',
          badge: 'bg-red-600 text-white animate-pulse',
          icon: 'text-red-600',
          score: 'bg-red-600 text-white',
        };
      case 'high':
        return {
          border: 'border-orange-500 border-l-4',
          bg: 'bg-orange-50',
          badge: 'bg-orange-500 text-white',
          icon: 'text-orange-600',
          score: 'bg-orange-500 text-white',
        };
      case 'medium':
        return {
          border: 'border-amber-500 border-l-4',
          bg: 'bg-amber-50',
          badge: 'bg-amber-500 text-white',
          icon: 'text-amber-600',
          score: 'bg-amber-500 text-white',
        };
      default:
        return {
          border: 'border-green-500 border-l-4',
          bg: 'bg-green-50',
          badge: 'bg-green-500 text-white',
          icon: 'text-green-600',
          score: 'bg-green-500 text-white',
        };
    }
  };

  const styles = getSeverityStyles();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const handleAcknowledge = () => {
    onAcknowledge?.(alert.id, acknowledgeNotes || undefined);
    setShowAcknowledgeForm(false);
    setAcknowledgeNotes('');
  };

  if (compact) {
    return (
      <div
        className={`p-3 rounded-lg ${styles.border} ${styles.bg} cursor-pointer hover:shadow-md transition-shadow`}
        onClick={() => onViewPatient?.(alert.patientId)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${styles.score} flex items-center justify-center font-bold text-lg`}>
              {alert.news2Score}
            </div>
            <div>
              <p className="font-medium text-gray-900">{alert.patientName}</p>
              <p className="text-sm text-gray-500">{alert.ward} - Bed {alert.bed}</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
              {alert.riskLevel.toUpperCase()}
            </span>
            <p className="text-xs text-gray-500 mt-1">{formatTime(alert.timestamp)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${styles.border} ${styles.bg} overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Score Badge */}
            <div className={`w-14 h-14 rounded-xl ${styles.score} flex items-center justify-center font-bold text-2xl ${alert.severity === 'critical' ? 'animate-pulse' : ''}`}>
              {alert.news2Score}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <BellAlertIcon className={`h-5 w-5 ${styles.icon}`} />
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles.badge}`}>
                  {alert.riskLevel.toUpperCase()} RISK
                </span>
                {alert.hasExtremeScore && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                    Extreme Value
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-gray-900">{alert.patientName}</h4>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-4 w-4" />
                  {alert.ward} - Bed {alert.bed}
                </span>
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  {formatTime(alert.timestamp)}
                </span>
              </div>
            </div>
          </div>

          {/* Status and Actions */}
          <div className="text-right">
            {alert.status === 'acknowledged' ? (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Acknowledged</span>
              </div>
            ) : (
              <button
                onClick={() => setShowAcknowledgeForm(!showAcknowledgeForm)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Acknowledge
              </button>
            )}
          </div>
        </div>

        {/* Clinical Response */}
        <div className="mt-4 p-3 bg-white/60 rounded-lg">
          <p className="text-sm font-medium text-gray-900 mb-1">Required Action:</p>
          <p className="text-sm text-gray-700">{alert.clinicalResponse}</p>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 mt-3 text-sm text-gray-600 hover:text-gray-900"
        >
          {isExpanded ? (
            <>
              <ChevronUpIcon className="h-4 w-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDownIcon className="h-4 w-4" />
              Show Details
            </>
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-200/50">
          {/* Score Components */}
          {alert.components && alert.components.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-900 mb-2">Score Components:</p>
              <ul className="space-y-1">
                {alert.components.map((comp, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5" />
                    {comp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Score Breakdown */}
          {alert.scoreBreakdown && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900 mb-2">Parameter Scores:</p>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                {Object.entries(alert.scoreBreakdown).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className={`py-1.5 rounded-lg text-sm font-bold ${
                      value === 3 ? 'bg-red-100 text-red-700' :
                      value === 2 ? 'bg-orange-100 text-orange-700' :
                      value === 1 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {value}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate" title={key}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onViewPatient?.(alert.patientId)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <UserIcon className="h-4 w-4" />
              View Patient
            </button>
          </div>
        </div>
      )}

      {/* Acknowledge Form */}
      {showAcknowledgeForm && alert.status !== 'acknowledged' && (
        <div className="px-4 pb-4 border-t border-gray-200/50">
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Acknowledgement Notes (optional)
            </label>
            <textarea
              value={acknowledgeNotes}
              onChange={(e) => setAcknowledgeNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Actions taken, observations, etc."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAcknowledge}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Confirm Acknowledgement
              </button>
              <button
                onClick={() => setShowAcknowledgeForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acknowledged Info */}
      {alert.status === 'acknowledged' && alert.acknowledgedBy && (
        <div className="px-4 pb-4 border-t border-gray-200/50">
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
            Acknowledged by {alert.acknowledgedBy}
            {alert.acknowledgedAt && (
              <span>at {new Date(alert.acknowledgedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
