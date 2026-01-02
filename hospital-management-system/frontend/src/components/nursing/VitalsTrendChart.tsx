import { useMemo } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

interface TrendData {
  labels: string[];
  respiratoryRate: (number | null)[];
  oxygenSaturation: (number | null)[];
  systolicBP: (number | null)[];
  diastolicBP: (number | null)[];
  heartRate: (number | null)[];
  temperature: (number | null)[];
  news2Scores: number[];
}

interface VitalsTrendChartProps {
  data: TrendData;
  patientName?: string;
  hours?: number;
}

const VITAL_CONFIGS: Record<string, { label: string; unit: string; normal: [number, number]; color: string }> = {
  respiratoryRate: { label: 'Respiratory Rate', unit: '/min', normal: [12, 20], color: '#3B82F6' },
  oxygenSaturation: { label: 'SpO2', unit: '%', normal: [96, 100], color: '#10B981' },
  heartRate: { label: 'Heart Rate', unit: 'bpm', normal: [51, 90], color: '#EF4444' },
  systolicBP: { label: 'Systolic BP', unit: 'mmHg', normal: [111, 140], color: '#8B5CF6' },
  diastolicBP: { label: 'Diastolic BP', unit: 'mmHg', normal: [60, 80], color: '#6366F1' },
  temperature: { label: 'Temperature', unit: 'C', normal: [36.1, 38.0], color: '#F59E0B' },
};

function MiniSparkline({
  data,
  color,
  normalRange,
  width = 100,
  height = 40,
}: {
  data: (number | null)[];
  color: string;
  normalRange: [number, number];
  width?: number;
  height?: number;
}) {
  const validData = data.filter((d): d is number => d !== null);
  if (validData.length === 0) return <div className="text-gray-400 text-sm">No data</div>;

  const minVal = Math.min(...validData, normalRange[0]);
  const maxVal = Math.max(...validData, normalRange[1]);
  const range = maxVal - minVal || 1;

  const points = validData.map((val, idx) => {
    const x = (idx / (validData.length - 1 || 1)) * width;
    const y = height - ((val - minVal) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Normal range area
  const normalTop = height - ((normalRange[1] - minVal) / range) * height;
  const normalBottom = height - ((normalRange[0] - minVal) / range) * height;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Normal range background */}
      <rect
        x={0}
        y={Math.max(0, normalTop)}
        width={width}
        height={Math.min(height, normalBottom - normalTop)}
        fill="#10B98122"
        rx={2}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Points */}
      {validData.map((val, idx) => {
        const x = (idx / (validData.length - 1 || 1)) * width;
        const y = height - ((val - minVal) / range) * height;
        const isOutOfRange = val < normalRange[0] || val > normalRange[1];
        return (
          <circle
            key={idx}
            cx={x}
            cy={y}
            r={3}
            fill={isOutOfRange ? '#EF4444' : color}
          />
        );
      })}
    </svg>
  );
}

function VitalCard({
  label,
  unit,
  data,
  normal,
  color,
}: {
  label: string;
  unit: string;
  data: (number | null)[];
  normal: [number, number];
  color: string;
}) {
  const validData = data.filter((d): d is number => d !== null);
  const currentValue = validData[validData.length - 1];
  const previousValue = validData[validData.length - 2];

  const getTrend = () => {
    if (validData.length < 2) return 'stable';
    const diff = currentValue - previousValue;
    if (Math.abs(diff) < 1) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  const trend = getTrend();
  const isOutOfRange = currentValue !== undefined && (currentValue < normal[0] || currentValue > normal[1]);

  return (
    <div className={`p-4 bg-white rounded-xl border ${isOutOfRange ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        {trend === 'up' && <ArrowTrendingUpIcon className="h-4 w-4 text-red-500" />}
        {trend === 'down' && <ArrowTrendingDownIcon className="h-4 w-4 text-blue-500" />}
        {trend === 'stable' && <MinusIcon className="h-4 w-4 text-gray-400" />}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className={`text-2xl font-bold ${isOutOfRange ? 'text-red-600' : 'text-gray-900'}`}>
            {currentValue?.toFixed(1) ?? '--'}
          </span>
          <span className="text-sm text-gray-500 ml-1">{unit}</span>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>Normal: {normal[0]}-{normal[1]}</div>
        </div>
      </div>
      <div className="mt-3">
        <MiniSparkline data={data} color={color} normalRange={normal} />
      </div>
    </div>
  );
}

export default function VitalsTrendChart({
  data,
  patientName,
  hours = 24,
}: VitalsTrendChartProps) {
  const news2Trend = useMemo(() => {
    if (data.news2Scores.length < 2) return 'stable';
    const current = data.news2Scores[data.news2Scores.length - 1];
    const previous = data.news2Scores[data.news2Scores.length - 2];
    if (current > previous + 1) return 'worsening';
    if (current < previous - 1) return 'improving';
    return 'stable';
  }, [data.news2Scores]);

  const currentNEWS2 = data.news2Scores[data.news2Scores.length - 1] ?? 0;

  const getNEWS2Color = (score: number) => {
    if (score >= 7) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 5) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (score >= 3) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <ChartBarIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Vital Signs Trends</h3>
              {patientName && (
                <p className="text-sm text-purple-100">{patientName}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-200">Last {hours} hours</p>
            <p className="text-sm text-purple-200">{data.labels.length} readings</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* NEWS2 Summary */}
        <div className={`mb-6 p-4 rounded-xl border-2 ${getNEWS2Color(currentNEWS2)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium mb-1">Current NEWS2 Score</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold">{currentNEWS2}</span>
                <div className="flex items-center gap-1">
                  {news2Trend === 'worsening' && (
                    <>
                      <ArrowTrendingUpIcon className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium text-red-600">Worsening</span>
                    </>
                  )}
                  {news2Trend === 'improving' && (
                    <>
                      <ArrowTrendingDownIcon className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Improving</span>
                    </>
                  )}
                  {news2Trend === 'stable' && (
                    <>
                      <MinusIcon className="h-5 w-5 text-gray-500" />
                      <span className="text-sm font-medium text-gray-600">Stable</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="w-32">
              <MiniSparkline
                data={data.news2Scores}
                color={currentNEWS2 >= 5 ? '#EF4444' : currentNEWS2 >= 3 ? '#F59E0B' : '#10B981'}
                normalRange={[0, 4]}
                height={50}
              />
            </div>
          </div>
        </div>

        {/* Vital Signs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(VITAL_CONFIGS).map(([key, config]) => (
            <VitalCard
              key={key}
              label={config.label}
              unit={config.unit}
              data={data[key as keyof TrendData] as (number | null)[]}
              normal={config.normal}
              color={config.color}
            />
          ))}
        </div>

        {/* Timestamps */}
        {data.labels.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-xs text-gray-500">
              <span>First: {new Date(data.labels[0]).toLocaleString()}</span>
              <span>Latest: {new Date(data.labels[data.labels.length - 1]).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
