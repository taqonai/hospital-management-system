import { Line } from 'react-chartjs-2';
import { lineChartOptions, chartColors } from '../chartSetup';

interface TrendDataPoint {
  label: string;
  value: number;
}

interface AppointmentTrendsChartProps {
  data: TrendDataPoint[];
  secondaryData?: TrendDataPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryColor?: keyof typeof chartColors;
  secondaryColor?: keyof typeof chartColors;
  showFill?: boolean;
}

export default function AppointmentTrendsChart({
  data,
  secondaryData,
  primaryLabel = 'Appointments',
  secondaryLabel = 'Completed',
  primaryColor = 'primary',
  secondaryColor = 'success',
  showFill = true,
}: AppointmentTrendsChartProps) {
  const primaryColorCfg = chartColors[primaryColor];
  const secondaryColorCfg = chartColors[secondaryColor];

  const datasets: any[] = [
    {
      label: primaryLabel,
      data: data.map((d) => d.value),
      borderColor: primaryColorCfg.main,
      backgroundColor: showFill ? primaryColorCfg.light : 'transparent',
      fill: showFill,
      tension: 0.4,
    },
  ];

  if (secondaryData) {
    datasets.push({
      label: secondaryLabel,
      data: secondaryData.map((d) => d.value),
      borderColor: secondaryColorCfg.main,
      backgroundColor: showFill ? secondaryColorCfg.light : 'transparent',
      fill: showFill,
      tension: 0.4,
    });
  }

  const chartData = {
    labels: data.map((d) => d.label),
    datasets,
  };

  return (
    <div className="h-full">
      <Line data={chartData} options={lineChartOptions} />
    </div>
  );
}
