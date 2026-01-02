import { useState, useEffect, useRef } from 'react';
import {
  BellAlertIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  PhoneArrowUpRightIcon,
} from '@heroicons/react/24/outline';
import type { Alert } from '../../hooks/useEarlyWarning';

interface AlertPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string, notes?: string) => void;
  onEscalate?: (alertId: string, level: number, notes?: string) => void;
  onViewPatient: (patientId: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  maxHeight?: string;
}

export default function AlertPanel({
  alerts,
  onAcknowledge,
  onEscalate,
  onViewPatient,
  soundEnabled,
  onToggleSound,
  maxHeight = '600px',
}: AlertPanelProps) {
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState<Record<string, string>>({});
  const [showAcknowledgeForm, setShowAcknowledgeForm] = useState<string | null>(null);
  const prevAlertsRef = useRef<Alert[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play alert sound for new critical/high alerts
  useEffect(() => {
    if (!soundEnabled) return;

    const newCriticalAlerts = alerts.filter(
      (alert) =>
        (alert.severity === 'critical' || alert.severity === 'high') &&
        alert.status === 'active' &&
        !prevAlertsRef.current.find((prev) => prev.id === alert.id)
    );

    if (newCriticalAlerts.length > 0) {
      playAlertSound(newCriticalAlerts[0].severity);
    }

    prevAlertsRef.current = alerts;
  }, [alerts, soundEnabled]);

  const playAlertSound = (severity: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (severity === 'critical') {
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.45);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.6);
    } else {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(659, ctx.currentTime);
      oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          border: 'border-l-4 border-l-red-600',
          bg: 'bg-red-50',
          badge: 'bg-red-600 text-white',
          icon: 'text-red-600',
          pulse: true,
        };
      case 'high':
        return {
          border: 'border-l-4 border-l-orange-500',
          bg: 'bg-orange-50',
          badge: 'bg-orange-500 text-white',
          icon: 'text-orange-600',
          pulse: false,
        };
      case 'medium':
        return {
          border: 'border-l-4 border-l-yellow-500',
          bg: 'bg-yellow-50',
          badge: 'bg-yellow-500 text-white',
          icon: 'text-yellow-600',
          pulse: false,
        };
      default:
        return {
          border: 'border-l-4 border-l-green-500',
          bg: 'bg-green-50',
          badge: 'bg-green-500 text-white',
          icon: 'text-green-600',
          pulse: false,
        };
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleAcknowledge = (alertId: string) => {
    onAcknowledge(alertId, acknowledgeNotes[alertId]);
    setAcknowledgeNotes((prev) => ({ ...prev, [alertId]: '' }));
    setShowAcknowledgeForm(null);
  };

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const acknowledgedAlerts = alerts.filter((a) => a.status === 'acknowledged');
  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;
  const highCount = activeAlerts.filter((a) => a.severity === 'high').length;

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <BellAlertIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Alert Notifications</h3>
              <p className="text-sm text-red-100">
                {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Alert counts */}
            {criticalCount > 0 && (
              <span className="px-3 py-1 bg-red-700 rounded-full text-sm font-bold animate-pulse">
                {criticalCount} Critical
              </span>
            )}
            {highCount > 0 && (
              <span className="px-3 py-1 bg-orange-600 rounded-full text-sm font-bold">
                {highCount} High
              </span>
            )}
            {/* Sound toggle */}
            <button
              onClick={onToggleSound}
              className={`p-2 rounded-xl transition-colors ${
                soundEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 hover:bg-white/20'
              }`}
              title={soundEnabled ? 'Mute alerts' : 'Enable alert sounds'}
            >
              {soundEnabled ? (
                <SpeakerWaveIcon className="h-5 w-5" />
              ) : (
                <SpeakerXMarkIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {criticalCount > 0 && (
        <div className="px-4 py-3 bg-red-600 text-white flex items-center gap-3 animate-pulse">
          <ExclamationTriangleIcon className="h-6 w-6" />
          <span className="font-bold">
            {criticalCount} CRITICAL ALERT{criticalCount > 1 ? 'S' : ''} - IMMEDIATE ACTION REQUIRED
          </span>
        </div>
      )}

      {/* Alert List */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {activeAlerts.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-green-400" />
            <p className="text-gray-500 font-medium">No active alerts</p>
            <p className="text-sm text-gray-400 mt-1">All patients are within normal parameters</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activeAlerts.map((alert) => {
              const styles = getSeverityStyles(alert.severity);
              const isExpanded = expandedAlertId === alert.id;

              return (
                <div
                  key={alert.id}
                  className={`${styles.border} ${styles.bg} ${styles.pulse ? 'animate-pulse' : ''}`}
                >
                  {/* Alert Header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Score Badge */}
                        <div
                          className={`w-12 h-12 rounded-xl ${styles.badge} flex items-center justify-center font-bold text-xl shadow-lg flex-shrink-0`}
                        >
                          {alert.news2Score}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${styles.badge}`}
                            >
                              {alert.severity}
                            </span>
                            {alert.hasExtremeScore && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                Extreme Value
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-gray-900 mt-1">{alert.patientName}</h4>
                          <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
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

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => onViewPatient(alert.patientId)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                          title="View Patient"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </button>
                        {showAcknowledgeForm !== alert.id ? (
                          <button
                            onClick={() => setShowAcknowledgeForm(alert.id)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowAcknowledgeForm(null)}
                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Clinical Response */}
                    <div className="mt-3 p-3 bg-white/60 backdrop-blur-sm rounded-xl">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Required Action:</p>
                      <p className="text-sm text-gray-600">{alert.clinicalResponse}</p>
                    </div>

                    {/* Acknowledge Form */}
                    {showAcknowledgeForm === alert.id && (
                      <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Acknowledgement Notes (optional)
                        </label>
                        <textarea
                          value={acknowledgeNotes[alert.id] || ''}
                          onChange={(e) =>
                            setAcknowledgeNotes((prev) => ({
                              ...prev,
                              [alert.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Actions taken, observations, etc."
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Confirm Acknowledgement
                          </button>
                          {onEscalate && (
                            <button
                              onClick={() => onEscalate(alert.id, (alert.escalationLevel || 0) + 1)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                              <PhoneArrowUpRightIcon className="h-4 w-4" />
                              Escalate
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Expand/Collapse */}
                    <button
                      onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
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

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200/50">
                      {alert.components && alert.components.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            Score Components:
                          </p>
                          <ul className="space-y-1">
                            {alert.components.map((comp, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-sm text-gray-600"
                              >
                                <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                {comp}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {alert.scoreBreakdown && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            Parameter Scores:
                          </p>
                          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                            {Object.entries(alert.scoreBreakdown).map(([key, value]) => (
                              <div key={key} className="text-center">
                                <div
                                  className={`py-1.5 rounded-lg text-sm font-bold ${
                                    value === 3
                                      ? 'bg-red-100 text-red-700'
                                      : value === 2
                                      ? 'bg-orange-100 text-orange-700'
                                      : value === 1
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Acknowledged Alerts Section */}
        {acknowledgedAlerts.length > 0 && (
          <div className="border-t border-gray-200">
            <div className="px-4 py-3 bg-gray-50">
              <p className="text-sm font-semibold text-gray-600">
                Recently Acknowledged ({acknowledgedAlerts.length})
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {acknowledgedAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="p-4 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-700">{alert.patientName}</p>
                        <p className="text-sm text-gray-500">
                          NEWS2: {alert.news2Score} | {alert.ward} - Bed {alert.bed}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {alert.acknowledgedBy && (
                        <p>By: {alert.acknowledgedBy}</p>
                      )}
                      {alert.acknowledgedAt && (
                        <p>{formatTime(alert.acknowledgedAt)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
