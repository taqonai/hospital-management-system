import {
  HeartIcon,
  BeakerIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface VitalsData {
  temperature: number | null;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bloodSugar: number | null;
  painLevel: number | null;
  recordedBy: string;
  recordedAt: string;
}

interface RiskPrediction {
  riskScore: number;
  riskLevel: string;
  recommendations: string[];
}

interface VitalsSummaryCardProps {
  vitals: VitalsData | null;
  riskPrediction: RiskPrediction | null;
  className?: string;
}

function VitalItem({
  label,
  value,
  unit,
  isAbnormal,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  isAbnormal?: boolean;
}) {
  if (value === null || value === undefined) return null;

  return (
    <div className={clsx('text-center p-2 rounded', isAbnormal ? 'bg-red-50' : 'bg-gray-50')}>
      <div className={clsx('text-lg font-semibold', isAbnormal ? 'text-red-600' : 'text-gray-900')}>
        {value}
        {unit && <span className="text-xs ml-0.5">{unit}</span>}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function isVitalAbnormal(type: string, value: number | null): boolean {
  if (value === null) return false;

  switch (type) {
    case 'heartRate':
      return value < 60 || value > 100;
    case 'bloodPressureSys':
      return value < 90 || value > 140;
    case 'bloodPressureDia':
      return value < 60 || value > 90;
    case 'temperature':
      return value < 36 || value > 38;
    case 'oxygenSaturation':
      return value < 94;
    case 'respiratoryRate':
      return value < 12 || value > 20;
    default:
      return false;
  }
}

export function VitalsSummaryCard({ vitals, riskPrediction, className }: VitalsSummaryCardProps) {
  if (!vitals) {
    return (
      <div className={clsx('bg-yellow-50 border border-yellow-200 rounded-lg p-4', className)}>
        <div className="flex items-center gap-2 text-yellow-700">
          <ExclamationTriangleIcon className="w-5 h-5" />
          <span className="font-medium">Vitals Not Recorded</span>
        </div>
        <p className="text-sm text-yellow-600 mt-1">
          Pre-consultation vitals have not been recorded for this booking.
        </p>
      </div>
    );
  }

  const getRiskLevelColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'MODERATE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={clsx('bg-white border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartIcon className="w-5 h-5 text-red-500" />
          <span className="font-medium text-gray-900">Vitals</span>
        </div>
        <div className="text-xs text-gray-500">
          Recorded {new Date(vitals.recordedAt).toLocaleString()}
        </div>
      </div>

      {/* Vitals Grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          <VitalItem
            label="BP"
            value={
              vitals.bloodPressureSys && vitals.bloodPressureDia
                ? `${vitals.bloodPressureSys}/${vitals.bloodPressureDia}`
                : null
            }
            unit="mmHg"
            isAbnormal={
              isVitalAbnormal('bloodPressureSys', vitals.bloodPressureSys) ||
              isVitalAbnormal('bloodPressureDia', vitals.bloodPressureDia)
            }
          />
          <VitalItem
            label="Heart Rate"
            value={vitals.heartRate}
            unit="bpm"
            isAbnormal={isVitalAbnormal('heartRate', vitals.heartRate)}
          />
          <VitalItem
            label="Temp"
            value={vitals.temperature ? Number(vitals.temperature).toFixed(1) : null}
            unit="°C"
            isAbnormal={isVitalAbnormal('temperature', vitals.temperature)}
          />
          <VitalItem
            label="SpO2"
            value={vitals.oxygenSaturation ? Number(vitals.oxygenSaturation).toFixed(0) : null}
            unit="%"
            isAbnormal={isVitalAbnormal('oxygenSaturation', vitals.oxygenSaturation)}
          />
          <VitalItem
            label="Resp Rate"
            value={vitals.respiratoryRate}
            unit="/min"
            isAbnormal={isVitalAbnormal('respiratoryRate', vitals.respiratoryRate)}
          />
          <VitalItem
            label="Pain"
            value={vitals.painLevel}
            unit="/10"
            isAbnormal={vitals.painLevel !== null && vitals.painLevel >= 7}
          />
        </div>

        {/* Secondary vitals */}
        {(vitals.weight || vitals.height || vitals.bloodSugar) && (
          <div className="grid grid-cols-3 gap-2 mb-4 pt-2 border-t">
            <VitalItem label="Weight" value={vitals.weight} unit="kg" />
            <VitalItem label="Height" value={vitals.height} unit="cm" />
            <VitalItem label="Blood Sugar" value={vitals.bloodSugar} unit="mg/dL" />
          </div>
        )}

        {/* Risk Assessment */}
        {riskPrediction && (
          <div
            className={clsx(
              'mt-3 p-3 rounded-lg border',
              getRiskLevelColor(riskPrediction.riskLevel)
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon className="w-4 h-4" />
                <span className="font-medium text-sm">Risk Assessment</span>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase">
                {riskPrediction.riskLevel}
              </span>
            </div>
            {riskPrediction.recommendations && riskPrediction.recommendations.length > 0 && (
              <div className="mt-2 text-xs">
                <span className="font-medium">Recommendations: </span>
                {riskPrediction.recommendations.slice(0, 2).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default VitalsSummaryCard;
