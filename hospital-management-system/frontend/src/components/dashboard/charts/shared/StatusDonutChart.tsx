import { Doughnut } from 'react-chartjs-2';
import { doughnutChartOptions, chartColorPalette, chartColorPaletteLight } from '../chartSetup';

interface StatusDonutChartProps {
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
  height?: string;
}

export default function StatusDonutChart({
  data,
  centerLabel,
  centerValue,
  showLegend = true,
  height = 'h-64',
}: StatusDonutChartProps) {
  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.value),
        backgroundColor: data.map((d, i) => d.color || chartColorPalette[i % chartColorPalette.length]),
        borderColor: 'white',
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    ...doughnutChartOptions,
    plugins: {
      ...doughnutChartOptions.plugins,
      legend: {
        ...doughnutChartOptions.plugins.legend,
        display: showLegend,
      },
    },
  };

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={`${height} relative`}>
      <Doughnut data={chartData} options={options} />
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <span className="text-2xl font-bold text-gray-900">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-sm text-gray-500">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
