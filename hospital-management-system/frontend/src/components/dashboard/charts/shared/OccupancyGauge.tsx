interface OccupancyGaugeProps {
  percentage: number;
  label: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'amber' | 'red' | 'auto';
}

const sizeConfig = {
  sm: { width: 100, stroke: 8, fontSize: 'text-lg', labelSize: 'text-xs' },
  md: { width: 140, stroke: 10, fontSize: 'text-2xl', labelSize: 'text-sm' },
  lg: { width: 180, stroke: 12, fontSize: 'text-3xl', labelSize: 'text-base' },
};

const colorConfig = {
  blue: { stroke: 'stroke-blue-500', text: 'text-blue-600', bg: 'stroke-blue-100' },
  green: { stroke: 'stroke-green-500', text: 'text-green-600', bg: 'stroke-green-100' },
  amber: { stroke: 'stroke-amber-500', text: 'text-amber-600', bg: 'stroke-amber-100' },
  red: { stroke: 'stroke-red-500', text: 'text-red-600', bg: 'stroke-red-100' },
};

function getAutoColor(percentage: number) {
  if (percentage >= 90) return 'red';
  if (percentage >= 70) return 'amber';
  if (percentage >= 50) return 'blue';
  return 'green';
}

export default function OccupancyGauge({
  percentage,
  label,
  sublabel,
  size = 'md',
  color = 'auto',
}: OccupancyGaugeProps) {
  const { width, stroke, fontSize, labelSize } = sizeConfig[size];
  const effectiveColor = color === 'auto' ? getAutoColor(percentage) : color;
  const colorCfg = colorConfig[effectiveColor];

  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width, height: width }}>
        <svg className="transform -rotate-90" width={width} height={width}>
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className={colorCfg.bg}
          />
          {/* Progress circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={colorCfg.stroke}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              transition: 'stroke-dashoffset 0.5s ease-out',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${fontSize} ${colorCfg.text}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className={`font-medium text-gray-700 ${labelSize}`}>{label}</p>
        {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
      </div>
    </div>
  );
}
