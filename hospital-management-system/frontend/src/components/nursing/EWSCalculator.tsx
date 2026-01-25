import { useState } from 'react';
import {
  CalculatorIcon,
  HeartIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  calculateNEWS2RiskLevel,
  getNEWS2ClinicalResponse,
  toLowercaseRiskLevel,
} from '../../utils/news2';

interface VitalsInput {
  respiratoryRate: number;
  oxygenSaturation: number;
  supplementalOxygen: boolean;
  temperature: number;
  systolicBP: number;
  diastolicBP: number;
  heartRate: number;
  consciousness: string;
}

interface NEWS2Result {
  totalScore: number;
  scores: Record<string, number>;
  components: string[];
  riskLevel: string;
  severity: string;
  clinicalResponse: string;
  hasExtremeScore: boolean;
}

interface EWSCalculatorProps {
  patientId?: string;
  patientName?: string;
  onCalculate?: (result: NEWS2Result) => void;
  onSave?: (vitals: VitalsInput, result: NEWS2Result) => void;
}

const CONSCIOUSNESS_OPTIONS = [
  { value: 'alert', label: 'Alert' },
  { value: 'voice', label: 'Responds to Voice' },
  { value: 'pain', label: 'Responds to Pain' },
  { value: 'unresponsive', label: 'Unresponsive' },
];

export default function EWSCalculator({
  patientId,
  patientName,
  onCalculate,
  onSave,
}: EWSCalculatorProps) {
  const [vitals, setVitals] = useState<VitalsInput>({
    respiratoryRate: 16,
    oxygenSaturation: 98,
    supplementalOxygen: false,
    temperature: 37.0,
    systolicBP: 120,
    diastolicBP: 80,
    heartRate: 75,
    consciousness: 'alert',
  });

  const [result, setResult] = useState<NEWS2Result | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateNEWS2 = (): NEWS2Result => {
    const scores: Record<string, number> = {};
    const components: string[] = [];

    // Respiration Rate
    if (vitals.respiratoryRate <= 8) {
      scores.respiratoryRate = 3;
      components.push(`Respiratory rate critically low (${vitals.respiratoryRate}/min): +3`);
    } else if (vitals.respiratoryRate <= 11) {
      scores.respiratoryRate = 1;
      components.push(`Respiratory rate low (${vitals.respiratoryRate}/min): +1`);
    } else if (vitals.respiratoryRate <= 20) {
      scores.respiratoryRate = 0;
    } else if (vitals.respiratoryRate <= 24) {
      scores.respiratoryRate = 2;
      components.push(`Respiratory rate elevated (${vitals.respiratoryRate}/min): +2`);
    } else {
      scores.respiratoryRate = 3;
      components.push(`Respiratory rate critically high (${vitals.respiratoryRate}/min): +3`);
    }

    // SpO2
    if (vitals.oxygenSaturation <= 91) {
      scores.oxygenSaturation = 3;
      components.push(`SpO2 critically low (${vitals.oxygenSaturation}%): +3`);
    } else if (vitals.oxygenSaturation <= 93) {
      scores.oxygenSaturation = 2;
      components.push(`SpO2 low (${vitals.oxygenSaturation}%): +2`);
    } else if (vitals.oxygenSaturation <= 95) {
      scores.oxygenSaturation = 1;
      components.push(`SpO2 slightly low (${vitals.oxygenSaturation}%): +1`);
    } else {
      scores.oxygenSaturation = 0;
    }

    // Supplemental Oxygen
    if (vitals.supplementalOxygen) {
      scores.supplementalOxygen = 2;
      components.push('On supplemental oxygen: +2');
    } else {
      scores.supplementalOxygen = 0;
    }

    // Temperature
    if (vitals.temperature <= 35.0) {
      scores.temperature = 3;
      components.push(`Temperature critically low (${vitals.temperature}C): +3`);
    } else if (vitals.temperature <= 36.0) {
      scores.temperature = 1;
      components.push(`Temperature low (${vitals.temperature}C): +1`);
    } else if (vitals.temperature <= 38.0) {
      scores.temperature = 0;
    } else if (vitals.temperature <= 39.0) {
      scores.temperature = 1;
      components.push(`Temperature elevated (${vitals.temperature}C): +1`);
    } else {
      scores.temperature = 2;
      components.push(`Temperature high (${vitals.temperature}C): +2`);
    }

    // Systolic BP
    if (vitals.systolicBP <= 90) {
      scores.systolicBP = 3;
      components.push(`Systolic BP critically low (${vitals.systolicBP}mmHg): +3`);
    } else if (vitals.systolicBP <= 100) {
      scores.systolicBP = 2;
      components.push(`Systolic BP low (${vitals.systolicBP}mmHg): +2`);
    } else if (vitals.systolicBP <= 110) {
      scores.systolicBP = 1;
      components.push(`Systolic BP slightly low (${vitals.systolicBP}mmHg): +1`);
    } else if (vitals.systolicBP <= 219) {
      scores.systolicBP = 0;
    } else {
      scores.systolicBP = 3;
      components.push(`Systolic BP critically high (${vitals.systolicBP}mmHg): +3`);
    }

    // Heart Rate
    if (vitals.heartRate <= 40) {
      scores.heartRate = 3;
      components.push(`Heart rate critically low (${vitals.heartRate}bpm): +3`);
    } else if (vitals.heartRate <= 50) {
      scores.heartRate = 1;
      components.push(`Heart rate low (${vitals.heartRate}bpm): +1`);
    } else if (vitals.heartRate <= 90) {
      scores.heartRate = 0;
    } else if (vitals.heartRate <= 110) {
      scores.heartRate = 1;
      components.push(`Heart rate elevated (${vitals.heartRate}bpm): +1`);
    } else if (vitals.heartRate <= 130) {
      scores.heartRate = 2;
      components.push(`Heart rate high (${vitals.heartRate}bpm): +2`);
    } else {
      scores.heartRate = 3;
      components.push(`Heart rate critically high (${vitals.heartRate}bpm): +3`);
    }

    // Consciousness
    if (vitals.consciousness === 'alert') {
      scores.consciousness = 0;
    } else {
      scores.consciousness = 3;
      components.push(`Altered consciousness (${vitals.consciousness}): +3`);
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const hasExtremeScore = Object.values(scores).some(s => s === 3);

    // Use centralized NEWS2 utility for risk classification (NHS guidelines)
    const riskLevelUpper = calculateNEWS2RiskLevel(totalScore, hasExtremeScore);
    const riskLevel = toLowercaseRiskLevel(riskLevelUpper);
    const severity = riskLevel;
    const clinicalResponse = getNEWS2ClinicalResponse(totalScore, hasExtremeScore);

    return {
      totalScore,
      scores,
      components,
      riskLevel,
      severity,
      clinicalResponse,
      hasExtremeScore,
    };
  };

  const handleCalculate = () => {
    setIsCalculating(true);
    setTimeout(() => {
      const news2Result = calculateNEWS2();
      setResult(news2Result);
      onCalculate?.(news2Result);
      setIsCalculating(false);
    }, 300);
  };

  const handleSave = () => {
    if (result) {
      onSave?.(vitals, result);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-amber-500 text-white';
      default:
        return 'bg-green-500 text-white';
    }
  };

  const getRiskBorderColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'border-red-500';
      case 'high':
        return 'border-orange-500';
      case 'medium':
        return 'border-amber-500';
      default:
        return 'border-green-500';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <CalculatorIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">NEWS2 Calculator</h3>
            {patientName && (
              <p className="text-sm text-blue-100">Patient: {patientName}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Respiratory Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Respiratory Rate (breaths/min)
            </label>
            <input
              type="number"
              value={vitals.respiratoryRate}
              onChange={(e) => setVitals({ ...vitals, respiratoryRate: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={4}
              max={60}
            />
            <p className="text-xs text-gray-500 mt-1">Normal: 12-20</p>
          </div>

          {/* Oxygen Saturation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SpO2 (%)
            </label>
            <input
              type="number"
              value={vitals.oxygenSaturation}
              onChange={(e) => setVitals({ ...vitals, oxygenSaturation: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={70}
              max={100}
            />
            <p className="text-xs text-gray-500 mt-1">Normal: 96-100</p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature (C)
            </label>
            <input
              type="number"
              step="0.1"
              value={vitals.temperature}
              onChange={(e) => setVitals({ ...vitals, temperature: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={30}
              max={45}
            />
            <p className="text-xs text-gray-500 mt-1">Normal: 36.1-38.0</p>
          </div>

          {/* Heart Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heart Rate (bpm)
            </label>
            <input
              type="number"
              value={vitals.heartRate}
              onChange={(e) => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={20}
              max={250}
            />
            <p className="text-xs text-gray-500 mt-1">Normal: 51-90</p>
          </div>

          {/* Systolic BP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Systolic BP (mmHg)
            </label>
            <input
              type="number"
              value={vitals.systolicBP}
              onChange={(e) => setVitals({ ...vitals, systolicBP: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={50}
              max={300}
            />
            <p className="text-xs text-gray-500 mt-1">Normal: 111-219</p>
          </div>

          {/* Diastolic BP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Diastolic BP (mmHg)
            </label>
            <input
              type="number"
              value={vitals.diastolicBP}
              onChange={(e) => setVitals({ ...vitals, diastolicBP: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={30}
              max={200}
            />
            <p className="text-xs text-gray-500 mt-1">Normal: 60-80</p>
          </div>

          {/* Consciousness */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consciousness (AVPU)
            </label>
            <select
              value={vitals.consciousness}
              onChange={(e) => setVitals({ ...vitals, consciousness: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CONSCIOUSNESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Supplemental Oxygen */}
          <div className="flex items-center">
            <label className="flex items-center gap-3 cursor-pointer mt-6">
              <input
                type="checkbox"
                checked={vitals.supplementalOxygen}
                onChange={(e) => setVitals({ ...vitals, supplementalOxygen: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">On Supplemental O2</span>
            </label>
          </div>
        </div>

        {/* Calculate Button */}
        <div className="flex gap-3">
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50"
          >
            {isCalculating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <CalculatorIcon className="h-5 w-5" />
                Calculate NEWS2
              </>
            )}
          </button>
          {result && onSave && (
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all flex items-center gap-2"
            >
              <CheckCircleIcon className="h-5 w-5" />
              Save Vitals
            </button>
          )}
        </div>

        {/* Result Display */}
        {result && (
          <div className={`mt-6 p-6 rounded-xl border-2 ${getRiskBorderColor(result.riskLevel)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`px-6 py-3 rounded-lg font-bold text-2xl ${getRiskColor(result.riskLevel)} ${result.riskLevel === 'critical' ? 'animate-pulse' : ''}`}>
                  {result.totalScore}
                </div>
                <div>
                  <p className="text-sm text-gray-500">NEWS2 Score</p>
                  <p className={`font-semibold text-lg capitalize ${
                    result.riskLevel === 'critical' ? 'text-red-600' :
                    result.riskLevel === 'high' ? 'text-orange-600' :
                    result.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {result.riskLevel} Risk
                  </p>
                </div>
              </div>
              {result.hasExtremeScore && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Extreme value detected
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-medium text-gray-900 mb-1">Clinical Response:</p>
              <p className="text-gray-700">{result.clinicalResponse}</p>
            </div>

            {result.components.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-2">Score Components:</p>
                <ul className="space-y-1">
                  {result.components.map((comp, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-gray-400">-</span>
                      {comp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Score breakdown grid */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="font-medium text-gray-900 mb-3">Parameter Scores:</p>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                {Object.entries(result.scores).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className={`py-2 rounded-lg font-bold ${
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
          </div>
        )}
      </div>
    </div>
  );
}
