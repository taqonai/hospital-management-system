import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CpuChipIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ShieldExclamationIcon,
  HeartIcon,
  BeakerIcon,
  LightBulbIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  BellAlertIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';
import { useAIHealth, getRiskLevelColor } from '../../hooks/useAI';
import LoadingSpinner from '../common/LoadingSpinner';
import clsx from 'clsx';

// Types
interface Medication {
  id?: string;
  name: string;
  genericName?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
}

interface Symptom {
  name: string;
  severity?: string;
  duration?: string;
}

interface PatientContext {
  patientId: string;
  demographics?: {
    age: number;
    gender: string;
  };
  allergies: Array<{
    allergen: string;
    severity: string;
    type: string;
  }>;
  currentMedications: string[];
  conditions: string[];
  recentVitals?: {
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
    respiratoryRate?: number;
  };
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
}

interface Alert {
  id: string;
  type: 'allergy' | 'interaction' | 'vital' | 'contraindication' | 'duplicate';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  medication?: string;
  relatedMedications?: string[];
  recommendation?: string;
}

interface Suggestion {
  id: string;
  type: 'diagnosis' | 'test' | 'treatment' | 'monitoring';
  title: string;
  description: string;
  confidence: number;
  rationale?: string;
  priority: 'high' | 'medium' | 'low';
}

interface ValidationResult {
  isValid: boolean;
  alerts: Alert[];
  suggestions?: Suggestion[];
}

interface AIInsightsPanelProps {
  patientId: string;
  currentMedications?: Medication[];
  currentSymptoms?: Symptom[];
  currentDiagnosis?: string;
  onAlertClick?: (alert: Alert) => void;
  className?: string;
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-700',
    icon: 'text-red-600',
    badge: 'bg-red-600 text-white',
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    text: 'text-orange-700',
    icon: 'text-orange-600',
    badge: 'bg-orange-500 text-white',
  },
  medium: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-700',
    icon: 'text-yellow-600',
    badge: 'bg-yellow-500 text-white',
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-700',
    icon: 'text-blue-600',
    badge: 'bg-blue-500 text-white',
  },
};

const RISK_SCORE_COLORS = {
  LOW: { bg: 'bg-green-500', ring: 'ring-green-200', text: 'text-green-700' },
  MODERATE: { bg: 'bg-yellow-500', ring: 'ring-yellow-200', text: 'text-yellow-700' },
  HIGH: { bg: 'bg-orange-500', ring: 'ring-orange-200', text: 'text-orange-700' },
  CRITICAL: { bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700' },
};

export default function AIInsightsPanel({
  patientId,
  currentMedications = [],
  currentSymptoms = [],
  currentDiagnosis = '',
  onAlertClick,
  className = '',
}: AIInsightsPanelProps) {
  // State for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    riskScore: true,
    alerts: true,
    suggestions: true,
  });

  // AI Health status
  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  // Fetch patient context
  const {
    data: patientContext,
    isLoading: contextLoading,
    refetch: refetchContext,
  } = useQuery({
    queryKey: ['ai-consultation-context', patientId],
    queryFn: async () => {
      const response = await api.get(`/ai-consultation/patient-context/${patientId}`);
      return response.data.data as PatientContext;
    },
    enabled: !!patientId && isAIOnline,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Validate prescription with debounce
  const {
    data: validationResult,
    isLoading: validationLoading,
    refetch: refetchValidation,
  } = useQuery({
    queryKey: [
      'ai-prescription-validation',
      patientId,
      currentMedications.map((m) => m.name).join(','),
      currentSymptoms.map((s) => s.name).join(','),
      currentDiagnosis,
    ],
    queryFn: async () => {
      if (currentMedications.length === 0 && !currentDiagnosis) {
        return { isValid: true, alerts: [], suggestions: [] } as ValidationResult;
      }

      const response = await api.post('/ai-consultation/validate-prescription', {
        patientId,
        medications: currentMedications.map((m) => ({
          name: m.name,
          genericName: m.genericName,
          dosage: m.dosage,
          frequency: m.frequency,
          route: m.route,
        })),
        symptoms: currentSymptoms.map((s) => s.name),
        diagnosis: currentDiagnosis,
      });
      return response.data.data as ValidationResult;
    },
    enabled: !!patientId && isAIOnline,
    staleTime: 10000,
  });

  // Combine alerts from context and validation
  const allAlerts = useMemo(() => {
    const alerts: Alert[] = [];

    // Add allergy alerts from patient context
    if (patientContext?.allergies) {
      patientContext.allergies.forEach((allergy, idx) => {
        const matchingMed = currentMedications.find(
          (med) =>
            med.name.toLowerCase().includes(allergy.allergen.toLowerCase()) ||
            med.genericName?.toLowerCase().includes(allergy.allergen.toLowerCase())
        );

        if (matchingMed) {
          alerts.push({
            id: `allergy-${idx}`,
            type: 'allergy',
            severity: allergy.severity === 'LIFE_THREATENING' ? 'critical' : allergy.severity === 'SEVERE' ? 'high' : 'medium',
            title: `Allergy Alert: ${allergy.allergen}`,
            message: `Patient is allergic to ${allergy.allergen}. ${matchingMed.name} may trigger a reaction.`,
            medication: matchingMed.name,
            recommendation: 'Consider an alternative medication.',
          });
        }
      });
    }

    // Add validation alerts
    if (validationResult?.alerts) {
      alerts.push(...validationResult.alerts);
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [patientContext, validationResult, currentMedications]);

  // Count alerts by severity
  const alertCounts = useMemo(() => {
    return allAlerts.reduce(
      (acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [allAlerts]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleRefresh = () => {
    refetchContext();
    refetchValidation();
  };

  const isLoading = contextLoading || validationLoading;

  // Risk score display
  const riskScoreColors = RISK_SCORE_COLORS[patientContext?.riskLevel || 'LOW'];
  const riskScorePercent = Math.round((patientContext?.riskScore || 0) * 100);

  return (
    <div
      className={clsx(
        'flex flex-col h-full bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <CpuChipIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">AI Clinical Insights</h3>
              <p className="text-xs text-purple-200">Real-time decision support</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAIOnline ? (
              <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs bg-red-500/30 px-2 py-1 rounded-full">
                <XCircleIcon className="h-3 w-3" />
                Offline
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Refresh insights"
            >
              <ArrowPathIcon className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Loading Skeleton */}
        {isLoading && !patientContext && (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-gray-200 rounded-xl" />
            <div className="h-32 bg-gray-200 rounded-xl" />
            <div className="h-28 bg-gray-200 rounded-xl" />
          </div>
        )}

        {/* Risk Score Section */}
        {patientContext && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('riskScore')}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <HeartIcon className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-gray-900">Patient Risk Score</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-bold',
                    getRiskLevelColor(patientContext.riskLevel)
                  )}
                >
                  {patientContext.riskLevel}
                </span>
                {expandedSections.riskScore ? (
                  <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>

            {expandedSections.riskScore && (
              <div className="p-4 space-y-3">
                {/* Score Display */}
                <div className="flex items-center gap-4">
                  <div
                    className={clsx(
                      'relative w-16 h-16 rounded-full flex items-center justify-center ring-4',
                      riskScoreColors.ring
                    )}
                  >
                    <div
                      className={clsx(
                        'absolute inset-1 rounded-full',
                        riskScoreColors.bg,
                        'opacity-20'
                      )}
                    />
                    <span className={clsx('text-xl font-bold', riskScoreColors.text)}>
                      {riskScorePercent}%
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all duration-500', riskScoreColors.bg)}
                        style={{ width: `${riskScorePercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Based on vitals, history, and current status
                    </p>
                  </div>
                </div>

                {/* Risk Factors */}
                {patientContext.riskFactors?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600">Contributing Factors:</p>
                    <ul className="space-y-1">
                      {patientContext.riskFactors.slice(0, 4).map((factor, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                          <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Patient Demographics & Conditions */}
                {patientContext.demographics && (
                  <div className="flex gap-4 text-xs text-gray-600">
                    <span>Age: {patientContext.demographics.age}</span>
                    <span>Gender: {patientContext.demographics.gender}</span>
                  </div>
                )}

                {patientContext.conditions?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {patientContext.conditions.slice(0, 5).map((condition, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700"
                      >
                        {condition}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Active Alerts Section */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('alerts')}
            className={clsx(
              'w-full px-4 py-3 flex items-center justify-between transition-colors',
              alertCounts.critical || alertCounts.high
                ? 'bg-red-50 hover:bg-red-100'
                : 'bg-gray-50 hover:bg-gray-100'
            )}
          >
            <div className="flex items-center gap-2">
              <BellAlertIcon
                className={clsx(
                  'h-5 w-5',
                  alertCounts.critical ? 'text-red-600 animate-pulse' : 'text-orange-500'
                )}
              />
              <span className="font-semibold text-gray-900">Active Alerts</span>
              {allAlerts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                  {allAlerts.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {alertCounts.critical > 0 && (
                <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                  {alertCounts.critical} Critical
                </span>
              )}
              {alertCounts.high > 0 && (
                <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-500 text-white">
                  {alertCounts.high} High
                </span>
              )}
              {expandedSections.alerts ? (
                <ChevronUpIcon className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </button>

          {expandedSections.alerts && (
            <div className="p-3 space-y-2">
              {allAlerts.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700">
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="text-sm">No active alerts</span>
                </div>
              ) : (
                allAlerts.map((alert) => {
                  const styles = SEVERITY_STYLES[alert.severity];
                  const AlertIcon =
                    alert.type === 'allergy'
                      ? ShieldExclamationIcon
                      : alert.type === 'interaction'
                      ? BeakerIcon
                      : ExclamationCircleIcon;

                  return (
                    <button
                      key={alert.id}
                      onClick={() => onAlertClick?.(alert)}
                      className={clsx(
                        'w-full text-left p-3 rounded-lg border-l-4 transition-all hover:shadow-md',
                        styles.bg,
                        styles.border
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <AlertIcon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', styles.icon)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={clsx('text-sm font-semibold', styles.text)}>
                              {alert.title}
                            </span>
                            <span
                              className={clsx(
                                'px-1.5 py-0.5 rounded text-xs font-bold uppercase',
                                styles.badge
                              )}
                            >
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                          {alert.recommendation && (
                            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                              <LightBulbIcon className="h-3 w-3" />
                              {alert.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* AI Suggestions Section */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('suggestions')}
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-purple-500" />
              <span className="font-semibold text-gray-900">AI Suggestions</span>
              {validationResult?.suggestions && validationResult.suggestions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  {validationResult.suggestions.length}
                </span>
              )}
            </div>
            {expandedSections.suggestions ? (
              <ChevronUpIcon className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {expandedSections.suggestions && (
            <div className="p-3 space-y-2">
              {(!validationResult?.suggestions || validationResult.suggestions.length === 0) ? (
                <div className="flex flex-col items-center py-4 text-gray-400">
                  <SparklesIcon className="h-8 w-8 mb-2" />
                  <p className="text-sm">
                    {currentDiagnosis || currentSymptoms.length > 0
                      ? 'No additional suggestions'
                      : 'Enter symptoms or diagnosis for suggestions'}
                  </p>
                </div>
              ) : (
                validationResult.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={clsx(
                      'p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer',
                      suggestion.priority === 'high'
                        ? 'bg-purple-50 border-purple-200'
                        : suggestion.priority === 'medium'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={clsx(
                          'p-1.5 rounded-lg flex-shrink-0',
                          suggestion.type === 'diagnosis'
                            ? 'bg-purple-100'
                            : suggestion.type === 'test'
                            ? 'bg-amber-100'
                            : 'bg-blue-100'
                        )}
                      >
                        {suggestion.type === 'diagnosis' ? (
                          <SparklesIcon className="h-4 w-4 text-purple-600" />
                        ) : suggestion.type === 'test' ? (
                          <BeakerIcon className="h-4 w-4 text-amber-600" />
                        ) : (
                          <LightBulbIcon className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {suggestion.title}
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{suggestion.description}</p>
                        {suggestion.rationale && (
                          <p className="text-xs text-purple-600 mt-1 italic">
                            {suggestion.rationale}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Patient Allergies Quick View */}
        {patientContext?.allergies && patientContext.allergies.length > 0 && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <ShieldExclamationIcon className="h-4 w-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700">Known Allergies</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {patientContext.allergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    allergy.severity === 'LIFE_THREATENING' || allergy.severity === 'SEVERE'
                      ? 'bg-red-200 text-red-800'
                      : 'bg-red-100 text-red-700'
                  )}
                >
                  {allergy.allergen}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Disclaimer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          AI insights are for decision support only. Always verify with clinical judgment.
        </p>
      </div>
    </div>
  );
}
