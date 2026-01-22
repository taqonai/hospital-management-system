import { useState, useEffect, useCallback } from 'react';
import {
  HeartIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ChartBarIcon,
  PlusIcon,
  PhoneIcon,
  BellAlertIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { Patient } from '../../hooks/useEarlyWarning';

interface PatientCardProps {
  patient: Patient;
  onRecordVitals: (patient: Patient) => void;
  onViewTrends: (patientId: string) => void;
  onEscalate?: (patient: Patient) => void;
  compact?: boolean;
}

export default function PatientCard({
  patient,
  onRecordVitals,
  onViewTrends,
  onEscalate,
  compact = false,
}: PatientCardProps) {
  const [timeSinceVitals, setTimeSinceVitals] = useState<string>('--');

  // Calculate time since last vitals
  const calculateTimeSince = useCallback(() => {
    if (!patient.lastVitalsTime) {
      setTimeSinceVitals('No data');
      return;
    }

    const lastTime = new Date(patient.lastVitalsTime).getTime();
    const now = Date.now();
    const diffMs = now - lastTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      setTimeSinceVitals(`${diffMins}m`);
    } else if (diffHours < 24) {
      setTimeSinceVitals(`${diffHours}h ${diffMins % 60}m`);
    } else {
      const days = Math.floor(diffHours / 24);
      setTimeSinceVitals(`${days}d ${diffHours % 24}h`);
    }
  }, [patient.lastVitalsTime]);

  useEffect(() => {
    calculateTimeSince();
    const interval = setInterval(calculateTimeSince, 60000);
    return () => clearInterval(interval);
  }, [calculateTimeSince]);

  const getRiskStyles = () => {
    switch (patient.riskLevel?.toLowerCase()) {
      case 'critical':
        return {
          border: 'border-red-500',
          bg: 'bg-gradient-to-br from-red-50 to-red-100',
          scoreBg: 'bg-red-600',
          scoreText: 'text-white',
          headerBg: 'bg-red-600',
          pulse: true,
        };
      case 'high':
        return {
          border: 'border-orange-500',
          bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
          scoreBg: 'bg-orange-500',
          scoreText: 'text-white',
          headerBg: 'bg-orange-500',
          pulse: false,
        };
      case 'medium':
        return {
          border: 'border-yellow-500',
          bg: 'bg-gradient-to-br from-yellow-50 to-amber-50',
          scoreBg: 'bg-yellow-500',
          scoreText: 'text-white',
          headerBg: 'bg-yellow-500',
          pulse: false,
        };
      default:
        return {
          border: 'border-green-500',
          bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
          scoreBg: 'bg-green-500',
          scoreText: 'text-white',
          headerBg: 'bg-green-500',
          pulse: false,
        };
    }
  };

  const styles = getRiskStyles();

  const getTrendIcon = () => {
    switch (patient.trend) {
      case 'worsening':
        return <ArrowTrendingUpIcon className="h-4 w-4 text-red-600" />;
      case 'improving':
        return <ArrowTrendingDownIcon className="h-4 w-4 text-green-600" />;
      default:
        return <MinusIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendLabel = () => {
    switch (patient.trend) {
      case 'worsening':
        return <span className="text-xs text-red-600 font-medium">Worsening</span>;
      case 'improving':
        return <span className="text-xs text-green-600 font-medium">Improving</span>;
      default:
        return <span className="text-xs text-gray-500">Stable</span>;
    }
  };

  if (compact) {
    return (
      <div
        className={`p-3 rounded-xl border-2 ${styles.border} ${styles.bg} ${
          styles.pulse ? 'animate-pulse' : ''
        } hover:shadow-lg transition-all cursor-pointer`}
        onClick={() => onViewTrends(patient.patientId)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl ${styles.scoreBg} ${styles.scoreText} flex items-center justify-center font-bold text-lg shadow-lg`}
            >
              {patient.news2Score}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{patient.patientName}</p>
              <p className="text-xs text-gray-500">
                {patient.ward} - Bed {patient.bed}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            {patient.vitalsOverdue && (
              <ClockIcon className="h-4 w-4 text-purple-600" />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border-2 ${styles.border} overflow-hidden shadow-lg hover:shadow-xl transition-all ${
        styles.pulse ? 'animate-pulse' : ''
      }`}
    >
      {/* Header */}
      <div className={`${styles.headerBg} px-4 py-2 flex items-center justify-between`}>
        <span className="text-white font-semibold text-sm uppercase tracking-wide">
          {patient.riskLevel} Risk
        </span>
        <div className="flex items-center gap-2">
          {patient.sepsisAlert && (
            <span className="px-2 py-0.5 bg-white/20 rounded text-xs text-white font-medium flex items-center gap-1">
              <ShieldExclamationIcon className="h-3 w-3" />
              Sepsis
            </span>
          )}
          {patient.fallRisk === 'high' && (
            <span className="px-2 py-0.5 bg-white/20 rounded text-xs text-white font-medium">
              Fall Risk
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`${styles.bg} p-4`}>
        {/* Patient Info and Score */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-lg">{patient.patientName}</h3>
            <p className="text-sm text-gray-600">{patient.mrn}</p>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>
                {patient.ward} - Bed {patient.bed}
              </span>
              {patient.age && <span>| {patient.age}y {patient.gender}</span>}
            </div>
          </div>
          <div className="text-center">
            <div
              className={`w-16 h-16 rounded-2xl ${styles.scoreBg} ${styles.scoreText} flex items-center justify-center font-bold text-3xl shadow-xl`}
            >
              {patient.news2Score}
            </div>
            <p className="text-xs text-gray-500 mt-1">NEWS2</p>
          </div>
        </div>

        {/* Trend and Time */}
        <div className="flex items-center justify-between mb-4 p-3 bg-white/60 backdrop-blur-sm rounded-xl">
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            {getTrendLabel()}
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon
              className={`h-4 w-4 ${patient.vitalsOverdue ? 'text-purple-600' : 'text-gray-400'}`}
            />
            <span
              className={`text-sm ${
                patient.vitalsOverdue ? 'text-purple-600 font-medium' : 'text-gray-500'
              }`}
            >
              {timeSinceVitals}
            </span>
            {patient.vitalsOverdue && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                Overdue
              </span>
            )}
          </div>
        </div>

        {/* Latest Vitals Summary */}
        {patient.latestVitals && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {patient.latestVitals.heartRate && (
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <HeartIcon className="h-4 w-4 text-red-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-gray-900">
                  {patient.latestVitals.heartRate}
                </p>
                <p className="text-xs text-gray-500">HR</p>
              </div>
            )}
            {patient.latestVitals.systolicBP && (
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <ArrowPathIcon className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-gray-900">
                  {patient.latestVitals.systolicBP}/{patient.latestVitals.diastolicBP}
                </p>
                <p className="text-xs text-gray-500">BP</p>
              </div>
            )}
            {patient.latestVitals.oxygenSaturation && (
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <span className="text-blue-500 font-bold text-xs">O2</span>
                <p className="text-sm font-semibold text-gray-900">
                  {patient.latestVitals.oxygenSaturation}%
                </p>
                <p className="text-xs text-gray-500">SpO2</p>
              </div>
            )}
          </div>
        )}

        {/* qSOFA Score (if applicable) */}
        {patient.qsofaScore !== undefined && patient.qsofaScore >= 2 && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2">
              <ShieldExclamationIcon className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  qSOFA Score: {patient.qsofaScore}/3
                </p>
                <p className="text-xs text-red-600">Sepsis screening positive - Further assessment required</p>
              </div>
            </div>
          </div>
        )}

        {/* Clinical Response */}
        <div className="mb-4 p-3 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-1">Recommended Action:</p>
          <p className="text-sm text-gray-600">{patient.clinicalResponse}</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onRecordVitals(patient)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
          >
            <PlusIcon className="h-4 w-4" />
            Record Vitals
          </button>
          <button
            onClick={() => onViewTrends(patient.patientId)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <ChartBarIcon className="h-4 w-4" />
            View Trends
          </button>
        </div>

        {/* Escalation Button for High/Critical */}
        {(patient.riskLevel === 'high' || patient.riskLevel === 'critical') && onEscalate && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => onEscalate(patient)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <BellAlertIcon className="h-4 w-4" />
              Escalate
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors">
              <PhoneIcon className="h-4 w-4" />
              Call Team
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
