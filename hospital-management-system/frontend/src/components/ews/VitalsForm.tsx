import { useState, useMemo } from 'react';
import {
  HeartIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { Patient, VitalsInput, NEWS2Result } from '../../hooks/useEarlyWarning';
import { useNEWS2Calculation } from '../../hooks/useEarlyWarning';

interface VitalsFormProps {
  patient: Patient;
  onSubmit: (vitals: VitalsInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isSuccess?: boolean;
  error?: string | null;
}

const CONSCIOUSNESS_OPTIONS = [
  { value: 'alert', label: 'Alert', description: 'Fully awake and responsive' },
  { value: 'voice', label: 'Voice', description: 'Responds to verbal stimuli' },
  { value: 'pain', label: 'Pain', description: 'Responds to painful stimuli' },
  { value: 'unresponsive', label: 'Unresponsive', description: 'No response' },
];

const VITAL_RANGES = {
  respiratoryRate: { min: 4, max: 60, normal: [12, 20], unit: '/min' },
  oxygenSaturation: { min: 70, max: 100, normal: [96, 100], unit: '%' },
  temperature: { min: 30, max: 45, normal: [36.1, 38.0], unit: 'C', step: 0.1 },
  systolicBP: { min: 50, max: 300, normal: [111, 140], unit: 'mmHg' },
  diastolicBP: { min: 30, max: 200, normal: [60, 80], unit: 'mmHg' },
  heartRate: { min: 20, max: 250, normal: [51, 90], unit: 'bpm' },
};

export default function VitalsForm({
  patient,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isSuccess = false,
  error = null,
}: VitalsFormProps) {
  const { calculateNEWS2, calculateQSOFA } = useNEWS2Calculation();

  const [vitals, setVitals] = useState<VitalsInput>(() => {
    // Pre-fill with latest vitals if available
    if (patient.latestVitals) {
      return {
        respiratoryRate: patient.latestVitals.respiratoryRate || 16,
        oxygenSaturation: patient.latestVitals.oxygenSaturation
          ? Number(patient.latestVitals.oxygenSaturation)
          : 98,
        supplementalOxygen: false,
        temperature: patient.latestVitals.temperature
          ? Number(patient.latestVitals.temperature)
          : 37.0,
        systolicBP: patient.latestVitals.systolicBP || 120,
        diastolicBP: patient.latestVitals.diastolicBP || 80,
        heartRate: patient.latestVitals.heartRate || 75,
        consciousness: 'alert',
      };
    }
    return {
      respiratoryRate: 16,
      oxygenSaturation: 98,
      supplementalOxygen: false,
      temperature: 37.0,
      systolicBP: 120,
      diastolicBP: 80,
      heartRate: 75,
      consciousness: 'alert',
    };
  });

  // Calculate NEWS2 score in real-time
  const news2Result = useMemo<NEWS2Result>(() => {
    return calculateNEWS2(vitals);
  }, [vitals, calculateNEWS2]);

  // Calculate qSOFA score
  const qsofaScore = useMemo(() => {
    return calculateQSOFA({
      respiratoryRate: vitals.respiratoryRate,
      systolicBP: vitals.systolicBP,
      consciousness: vitals.consciousness,
    });
  }, [vitals.respiratoryRate, vitals.systolicBP, vitals.consciousness, calculateQSOFA]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(vitals);
  };

  const isOutOfRange = (key: keyof typeof VITAL_RANGES, value: number) => {
    const range = VITAL_RANGES[key];
    return value < range.normal[0] || value > range.normal[1];
  };

  const getScoreColor = (score: number) => {
    if (score === 3) return 'bg-red-100 text-red-700 border-red-300';
    if (score === 2) return 'bg-orange-100 text-orange-700 border-orange-300';
    if (score === 1) return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-green-100 text-green-700 border-green-300';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-green-500 text-white';
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onCancel} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="h-12 w-12 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Vitals Recorded Successfully</h3>
            <p className="text-gray-600 mb-2">NEWS2 Score: {news2Result.totalScore}</p>
            <p className="text-gray-500 text-sm">{news2Result.clinicalResponse}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <HeartIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Record Vital Signs</h3>
                  <p className="text-sm text-blue-100">
                    {patient.patientName} | {patient.ward} - Bed {patient.bed}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  {error}
                </div>
              )}

              {/* Real-time NEWS2 Preview */}
              <div
                className={`mb-6 p-4 rounded-xl border-2 ${
                  news2Result.riskLevel === 'critical'
                    ? 'border-red-500 bg-red-50'
                    : news2Result.riskLevel === 'high'
                    ? 'border-orange-500 bg-orange-50'
                    : news2Result.riskLevel === 'medium'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-green-500 bg-green-50'
                } ${news2Result.riskLevel === 'critical' ? 'animate-pulse' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-2xl ${getRiskColor(
                        news2Result.riskLevel
                      )} flex items-center justify-center font-bold text-3xl shadow-lg`}
                    >
                      {news2Result.totalScore}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Calculated NEWS2 Score</p>
                      <p
                        className={`font-bold text-lg capitalize ${
                          news2Result.riskLevel === 'critical'
                            ? 'text-red-600'
                            : news2Result.riskLevel === 'high'
                            ? 'text-orange-600'
                            : news2Result.riskLevel === 'medium'
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {news2Result.riskLevel} Risk
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {news2Result.hasExtremeScore && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <ExclamationTriangleIcon className="h-3 w-3" />
                        Extreme Value
                      </span>
                    )}
                    {qsofaScore >= 2 && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        qSOFA: {qsofaScore}/3
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Vitals Input Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Respiratory Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resp. Rate
                    <span className="text-gray-400 ml-1">(/min)</span>
                  </label>
                  <input
                    type="number"
                    value={vitals.respiratoryRate}
                    onChange={(e) =>
                      setVitals({ ...vitals, respiratoryRate: Number(e.target.value) })
                    }
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      isOutOfRange('respiratoryRate', vitals.respiratoryRate)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    min={VITAL_RANGES.respiratoryRate.min}
                    max={VITAL_RANGES.respiratoryRate.max}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">12-20</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(
                        news2Result.scores.respiratoryRate || 0
                      )}`}
                    >
                      +{news2Result.scores.respiratoryRate || 0}
                    </span>
                  </div>
                </div>

                {/* SpO2 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SpO2
                    <span className="text-gray-400 ml-1">(%)</span>
                  </label>
                  <input
                    type="number"
                    value={vitals.oxygenSaturation}
                    onChange={(e) =>
                      setVitals({ ...vitals, oxygenSaturation: Number(e.target.value) })
                    }
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      isOutOfRange('oxygenSaturation', vitals.oxygenSaturation)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    min={VITAL_RANGES.oxygenSaturation.min}
                    max={VITAL_RANGES.oxygenSaturation.max}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">96-100</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(
                        news2Result.scores.oxygenSaturation || 0
                      )}`}
                    >
                      +{news2Result.scores.oxygenSaturation || 0}
                    </span>
                  </div>
                </div>

                {/* Heart Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heart Rate
                    <span className="text-gray-400 ml-1">(bpm)</span>
                  </label>
                  <input
                    type="number"
                    value={vitals.heartRate}
                    onChange={(e) => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      isOutOfRange('heartRate', vitals.heartRate)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    min={VITAL_RANGES.heartRate.min}
                    max={VITAL_RANGES.heartRate.max}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">51-90</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(
                        news2Result.scores.heartRate || 0
                      )}`}
                    >
                      +{news2Result.scores.heartRate || 0}
                    </span>
                  </div>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature
                    <span className="text-gray-400 ml-1">(C)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitals.temperature}
                    onChange={(e) => setVitals({ ...vitals, temperature: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      isOutOfRange('temperature', vitals.temperature)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    min={VITAL_RANGES.temperature.min}
                    max={VITAL_RANGES.temperature.max}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">36.1-38.0</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(
                        news2Result.scores.temperature || 0
                      )}`}
                    >
                      +{news2Result.scores.temperature || 0}
                    </span>
                  </div>
                </div>

                {/* Systolic BP */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Systolic BP
                    <span className="text-gray-400 ml-1">(mmHg)</span>
                  </label>
                  <input
                    type="number"
                    value={vitals.systolicBP}
                    onChange={(e) => setVitals({ ...vitals, systolicBP: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      isOutOfRange('systolicBP', vitals.systolicBP)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    min={VITAL_RANGES.systolicBP.min}
                    max={VITAL_RANGES.systolicBP.max}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">111-140</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(
                        news2Result.scores.systolicBP || 0
                      )}`}
                    >
                      +{news2Result.scores.systolicBP || 0}
                    </span>
                  </div>
                </div>

                {/* Diastolic BP */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diastolic BP
                    <span className="text-gray-400 ml-1">(mmHg)</span>
                  </label>
                  <input
                    type="number"
                    value={vitals.diastolicBP}
                    onChange={(e) => setVitals({ ...vitals, diastolicBP: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      isOutOfRange('diastolicBP', vitals.diastolicBP)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    min={VITAL_RANGES.diastolicBP.min}
                    max={VITAL_RANGES.diastolicBP.max}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">60-80</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      N/A
                    </span>
                  </div>
                </div>

                {/* Consciousness */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consciousness (AVPU)
                  </label>
                  <select
                    value={vitals.consciousness}
                    onChange={(e) =>
                      setVitals({
                        ...vitals,
                        consciousness: e.target.value as VitalsInput['consciousness'],
                      })
                    }
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      vitals.consciousness !== 'alert' ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  >
                    {CONSCIOUSNESS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">Alert</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(
                        news2Result.scores.consciousness || 0
                      )}`}
                    >
                      +{news2Result.scores.consciousness || 0}
                    </span>
                  </div>
                </div>

                {/* Supplemental O2 */}
                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={vitals.supplementalOxygen}
                      onChange={(e) =>
                        setVitals({ ...vitals, supplementalOxygen: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">On O2</span>
                      {vitals.supplementalOxygen && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                          +2
                        </span>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Clinical Response Preview */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-1">Clinical Response:</p>
                <p className="text-sm text-gray-600">{news2Result.clinicalResponse}</p>
              </div>

              {/* qSOFA Alert */}
              {qsofaScore >= 2 && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-purple-600" />
                    <div>
                      <p className="font-semibold text-purple-700">
                        qSOFA Score: {qsofaScore}/3 - Sepsis Screening Positive
                      </p>
                      <p className="text-sm text-purple-600">
                        Consider sepsis workup and early intervention
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/25"
              >
                {isSubmitting ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-5 w-5" />
                    Save Vitals
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
