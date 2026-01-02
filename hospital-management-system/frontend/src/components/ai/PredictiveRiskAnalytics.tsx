import { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ClockIcon,
  HeartIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  BeakerIcon,
  LightBulbIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000';

// Types
interface PatientData {
  id?: string;
  age: number;
  gender: string;
  admissionType?: string;
  lengthOfStay?: number;
  edVisits?: number;
  medicalHistory?: {
    chronicConditions?: string[];
  };
  medications?: string[];
  vitals?: {
    heartRate?: number;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    respiratoryRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
  };
  labResults?: {
    hemoglobin?: number;
    wbc?: number;
    creatinine?: number;
    sodium?: number;
    potassium?: number;
    glucose?: number;
    bnp?: number;
  };
  admissionHistory?: Array<{ date: string; reason: string }>;
  noShowHistory?: number;
}

interface ClinicalScore {
  score: number;
  interpretation?: string;
  level?: string;
  components?: string[];
}

interface RiskPrediction {
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  factors: string[];
  recommendations: string[];
  clinicalScores?: {
    lace?: ClinicalScore;
    news2?: ClinicalScore;
    charlson?: ClinicalScore;
  };
  confidenceInterval?: {
    lower: number;
    upper: number;
  };
  prediction?: {
    expectedDays?: number;
    range?: { lower: number; upper: number };
  };
  vitalSigns?: {
    heartRate: number;
    systolicBP: number;
    respiratoryRate: number;
    oxygenSaturation: number;
    temperature: number;
  };
  timeframe?: string;
  modelVersion: string;
}

type PredictionType =
  | 'READMISSION'
  | 'MORTALITY'
  | 'DETERIORATION'
  | 'LENGTH_OF_STAY'
  | 'NO_SHOW'
  | 'DISEASE_PROGRESSION';

interface PredictiveRiskAnalyticsProps {
  patient?: PatientData;
  predictionTypes?: PredictionType[];
  compact?: boolean;
  className?: string;
  onRiskAssessed?: (type: PredictionType, prediction: RiskPrediction) => void;
}

const PREDICTION_TYPE_CONFIG: Record<
  PredictionType,
  { label: string; icon: typeof HeartIcon; description: string; color: string }
> = {
  READMISSION: {
    label: '30-Day Readmission',
    icon: ArrowTrendingUpIcon,
    description: 'Risk of hospital readmission within 30 days',
    color: 'blue',
  },
  MORTALITY: {
    label: 'Mortality Risk',
    icon: HeartIcon,
    description: 'In-hospital mortality risk assessment',
    color: 'red',
  },
  DETERIORATION: {
    label: 'Clinical Deterioration',
    icon: ExclamationTriangleIcon,
    description: 'Risk of clinical deterioration (NEWS2-based)',
    color: 'orange',
  },
  LENGTH_OF_STAY: {
    label: 'Length of Stay',
    icon: ClockIcon,
    description: 'Expected hospital stay duration',
    color: 'purple',
  },
  NO_SHOW: {
    label: 'No-Show Risk',
    icon: CalendarDaysIcon,
    description: 'Probability of missing appointment',
    color: 'amber',
  },
  DISEASE_PROGRESSION: {
    label: 'Disease Progression',
    icon: ChartBarIcon,
    description: 'Risk of condition worsening',
    color: 'teal',
  },
};

const RISK_LEVEL_CONFIG = {
  LOW: {
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-500',
    icon: ShieldCheckIcon,
    label: 'Low Risk',
  },
  MODERATE: {
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-500',
    icon: InformationCircleIcon,
    label: 'Moderate Risk',
  },
  HIGH: {
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-500',
    icon: ExclamationTriangleIcon,
    label: 'High Risk',
  },
  CRITICAL: {
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-500',
    icon: XCircleIcon,
    label: 'Critical Risk',
  },
};

export default function PredictiveRiskAnalytics({
  patient,
  predictionTypes = ['READMISSION', 'MORTALITY', 'DETERIORATION'],
  compact = false,
  className = '',
  onRiskAssessed,
}: PredictiveRiskAnalyticsProps) {
  const [selectedType, setSelectedType] = useState<PredictionType>(predictionTypes[0]);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allPredictions, setAllPredictions] = useState<Map<PredictionType, RiskPrediction>>(
    new Map()
  );

  // Fetch prediction when patient or type changes
  useEffect(() => {
    if (patient) {
      fetchPrediction(selectedType);
    }
  }, [patient, selectedType]);

  const fetchPrediction = async (type: PredictionType) => {
    // Check if we already have this prediction cached
    if (allPredictions.has(type)) {
      setPrediction(allPredictions.get(type)!);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${AI_API_URL}/api/predict-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient?.id || 'demo',
          predictionType: type,
          timeframe: '30 days',
          patientData: patient,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch prediction');
      }

      const result = await response.json();
      setPrediction(result);

      // Cache the prediction
      setAllPredictions(prev => new Map(prev).set(type, result));

      // Callback
      if (onRiskAssessed) {
        onRiskAssessed(type, result);
      }
    } catch (err) {
      setError('Failed to analyze risk. Please try again.');
      console.error('Risk prediction error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPredictions = async () => {
    setLoading(true);
    for (const type of predictionTypes) {
      await fetchPrediction(type);
    }
    setLoading(false);
  };

  const getRiskGaugePercentage = (score: number) => {
    return Math.min(Math.max(score * 100, 0), 100);
  };

  const config = prediction ? RISK_LEVEL_CONFIG[prediction.riskLevel] : RISK_LEVEL_CONFIG.LOW;
  const typeConfig = PREDICTION_TYPE_CONFIG[selectedType];

  if (compact) {
    return (
      <div className={clsx('rounded-xl p-4 backdrop-blur-xl bg-white/70 border border-white/50', className)}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ChartBarIcon className="h-4 w-4 text-purple-500" />
            Risk Analytics
          </h3>
          <button
            onClick={() => fetchAllPredictions()}
            disabled={loading || !patient}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowPathIcon className={clsx('h-4 w-4 text-gray-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Compact risk summary */}
        <div className="grid grid-cols-3 gap-2">
          {predictionTypes.slice(0, 3).map(type => {
            const pred = allPredictions.get(type);
            const cfg = pred ? RISK_LEVEL_CONFIG[pred.riskLevel] : null;
            const typeInfo = PREDICTION_TYPE_CONFIG[type];

            return (
              <div
                key={type}
                className={clsx(
                  'p-2 rounded-lg border cursor-pointer transition-all',
                  selectedType === type
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                )}
                onClick={() => setSelectedType(type)}
              >
                <div className="flex items-center gap-1 mb-1">
                  <typeInfo.icon className="h-3 w-3 text-gray-500" />
                  <span className="text-[10px] text-gray-500 truncate">{typeInfo.label.split(' ')[0]}</span>
                </div>
                {pred ? (
                  <div className={clsx('text-lg font-bold', cfg?.textColor)}>
                    {Math.round(pred.riskScore * 100)}%
                  </div>
                ) : (
                  <div className="text-lg font-bold text-gray-300">--</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ChartBarIcon className="h-6 w-6 text-purple-500" />
            Predictive Risk Analytics
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            ML-powered clinical risk assessment using validated scoring systems
          </p>
        </div>
        <button
          onClick={() => fetchPrediction(selectedType)}
          disabled={loading || !patient}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={clsx('h-4 w-4', loading && 'animate-spin')} />
          Refresh Analysis
        </button>
      </div>

      {/* Prediction Type Tabs */}
      <div className="flex flex-wrap gap-2">
        {predictionTypes.map(type => {
          const cfg = PREDICTION_TYPE_CONFIG[type];
          const pred = allPredictions.get(type);
          const riskCfg = pred ? RISK_LEVEL_CONFIG[pred.riskLevel] : null;

          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all',
                selectedType === type
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-purple-300 text-gray-600'
              )}
            >
              <cfg.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{cfg.label}</span>
              {pred && (
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-semibold',
                    riskCfg?.bgColor,
                    riskCfg?.textColor
                  )}
                >
                  {pred.riskLevel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* No Patient Warning */}
      {!patient && (
        <div className="rounded-xl p-6 bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="h-8 w-8 text-amber-500" />
            <div>
              <h3 className="font-semibold text-amber-800">
                No Patient Selected
              </h3>
              <p className="text-sm text-amber-600">
                Select a patient or provide patient data to generate risk predictions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 bg-red-50 border border-red-200">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-purple-200" />
              <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
            </div>
            <p className="text-sm text-gray-500">Analyzing risk factors...</p>
          </div>
        </div>
      )}

      {/* Prediction Results */}
      {prediction && !loading && patient && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Risk Score Card */}
          <div className="lg:col-span-1">
            <div
              className={clsx(
                'rounded-2xl p-6 border-2',
                config.bgColor,
                config.borderColor
              )}
            >
              {/* Risk Level Badge */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className={clsx(
                    'px-3 py-1 rounded-full text-sm font-semibold',
                    config.bgColor,
                    config.textColor
                  )}
                >
                  {config.label}
                </span>
                <config.icon className={clsx('h-6 w-6', config.textColor)} />
              </div>

              {/* Risk Score Gauge */}
              <div className="relative mb-6">
                <div className="flex items-center justify-center">
                  <div className="relative w-40 h-40">
                    {/* Background circle */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-gray-200"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeDasharray={`${getRiskGaugePercentage(prediction.riskScore) * 4.4} 440`}
                        strokeLinecap="round"
                        className={clsx(
                          prediction.riskLevel === 'LOW'
                            ? 'text-emerald-500'
                            : prediction.riskLevel === 'MODERATE'
                            ? 'text-amber-500'
                            : prediction.riskLevel === 'HIGH'
                            ? 'text-orange-500'
                            : 'text-red-500'
                        )}
                      />
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span
                        className={clsx('text-4xl font-bold', config.textColor)}
                      >
                        {Math.round(prediction.riskScore * 100)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        Risk Score
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confidence Interval */}
              {prediction.confidenceInterval && (
                <div className="text-center mb-4">
                  <span className="text-xs text-gray-500">
                    95% CI: {Math.round(prediction.confidenceInterval.lower * 100)}% -{' '}
                    {Math.round(prediction.confidenceInterval.upper * 100)}%
                  </span>
                </div>
              )}

              {/* Prediction Type Info */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <typeConfig.icon className="h-4 w-4" />
                  <span>{typeConfig.description}</span>
                </div>
                {prediction.timeframe && (
                  <p className="mt-2 text-xs text-gray-500">
                    Timeframe: {prediction.timeframe}
                  </p>
                )}
              </div>

              {/* Model Version */}
              <div className="mt-4 text-center">
                <span className="text-[10px] text-gray-400">
                  Model: {prediction.modelVersion}
                </span>
              </div>
            </div>

            {/* Length of Stay Prediction */}
            {selectedType === 'LENGTH_OF_STAY' && prediction.prediction && (
              <div className="mt-4 rounded-xl p-4 bg-purple-50 border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-2">
                  Expected Stay
                </h4>
                <div className="text-3xl font-bold text-purple-600">
                  {prediction.prediction.expectedDays?.toFixed(1)} days
                </div>
                {prediction.prediction.range && (
                  <p className="text-sm text-purple-600/70 mt-1">
                    Range: {prediction.prediction.range.lower} - {prediction.prediction.range.upper}{' '}
                    days
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Risk Factors & Clinical Scores */}
          <div className="lg:col-span-2 space-y-6">
            {/* Clinical Scores */}
            {prediction.clinicalScores && Object.keys(prediction.clinicalScores).length > 0 && (
              <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BeakerIcon className="h-5 w-5 text-blue-500" />
                  Clinical Scoring Systems
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {prediction.clinicalScores.lace && (
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-blue-800">
                          LACE Index
                        </span>
                        <span className="text-2xl font-bold text-blue-600">
                          {prediction.clinicalScores.lace.score}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600/70 mb-2">
                        {prediction.clinicalScores.lace.interpretation} risk of readmission
                      </p>
                      {prediction.clinicalScores.lace.components && (
                        <div className="mt-2 space-y-1">
                          {prediction.clinicalScores.lace.components.map((comp, i) => (
                            <p key={i} className="text-xs text-blue-600/60">
                              {comp}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {prediction.clinicalScores.news2 && (
                    <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-orange-800">
                          NEWS2 Score
                        </span>
                        <span className="text-2xl font-bold text-orange-600">
                          {prediction.clinicalScores.news2.score}
                        </span>
                      </div>
                      <p className="text-xs text-orange-600/70 mb-2">
                        {prediction.clinicalScores.news2.level} clinical risk
                      </p>
                      {prediction.clinicalScores.news2.components && (
                        <div className="mt-2 space-y-1">
                          {prediction.clinicalScores.news2.components.map((comp, i) => (
                            <p key={i} className="text-xs text-orange-600/60">
                              {comp}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {prediction.clinicalScores.charlson && (
                    <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-purple-800">
                          Charlson Index
                        </span>
                        <span className="text-2xl font-bold text-purple-600">
                          {prediction.clinicalScores.charlson.score}
                        </span>
                      </div>
                      <p className="text-xs text-purple-600/70">
                        {prediction.clinicalScores.charlson.interpretation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vital Signs (for deterioration) */}
            {prediction.vitalSigns && (
              <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <HeartIcon className="h-5 w-5 text-red-500" />
                  Current Vital Signs
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-3 rounded-lg bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Heart Rate</p>
                    <p className="text-xl font-bold text-gray-900">
                      {prediction.vitalSigns.heartRate}
                    </p>
                    <p className="text-xs text-gray-400">bpm</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Systolic BP</p>
                    <p className="text-xl font-bold text-gray-900">
                      {prediction.vitalSigns.systolicBP}
                    </p>
                    <p className="text-xs text-gray-400">mmHg</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Resp Rate</p>
                    <p className="text-xl font-bold text-gray-900">
                      {prediction.vitalSigns.respiratoryRate}
                    </p>
                    <p className="text-xs text-gray-400">/min</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">SpO2</p>
                    <p className="text-xl font-bold text-gray-900">
                      {prediction.vitalSigns.oxygenSaturation}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Temp</p>
                    <p className="text-xl font-bold text-gray-900">
                      {prediction.vitalSigns.temperature}
                    </p>
                    <p className="text-xs text-gray-400">C</p>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Factors */}
            <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                Contributing Risk Factors
              </h3>
              {prediction.factors.length > 0 ? (
                <div className="space-y-2">
                  {prediction.factors.map((factor, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
                    >
                      <div
                        className={clsx(
                          'w-2 h-2 rounded-full mt-1.5',
                          factor.includes('high')
                            ? 'bg-red-500'
                            : factor.includes('moderate')
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        )}
                      />
                      <span className="text-sm text-gray-700">
                        {factor}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No significant risk factors identified
                </p>
              )}
            </div>

            {/* Recommendations */}
            <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <LightBulbIcon className="h-5 w-5 text-emerald-500" />
                Clinical Recommendations
              </h3>
              <div className="space-y-2">
                {prediction.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50"
                  >
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
