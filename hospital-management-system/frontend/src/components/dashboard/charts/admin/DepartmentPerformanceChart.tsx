import { Bar } from 'react-chartjs-2';
import { barChartOptions, chartColorPalette } from '../chartSetup';
import ChartCard from '../ChartCard';

interface DepartmentPerformanceChartProps {
  data?: {
    departments?: Array<{
      name: string;
      completionRate: number;
      appointmentsTotal: number;
      appointmentsCompleted: number;
    }>;
  };
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function DepartmentPerformanceChart({
  data,
  isLoading,
  error,
  onRetry,
}: DepartmentPerformanceChartProps) {
  const departments = data?.departments?.slice(0, 8) || [];

  const chartData = {
    labels: departments.map((d) => d.name),
    datasets: [
      {
        label: 'Completion Rate %',
        data: departments.map((d) => d.completionRate),
        backgroundColor: chartColorPalette.map((c) => c.replace('rgb', 'rgba').replace(')', ', 0.8)')),
        borderColor: chartColorPalette,
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    ...barChartOptions,
    indexAxis: 'y' as const,
    scales: {
      ...barChartOptions.scales,
      x: {
        ...barChartOptions.scales.x,
        max: 100,
        ticks: {
          ...barChartOptions.scales.x.ticks,
          callback: (value: any) => `${value}%`,
        },
      },
    },
  };

  return (
    <ChartCard
      title="Department Performance"
      subtitle="Completion rates by department"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
    >
      <Bar data={chartData} options={options} />
    </ChartCard>
  );
}
