import { Line } from 'react-chartjs-2';
import { lineChartOptions, chartColors } from '../chartSetup';
import ChartCard from '../ChartCard';

interface RevenueTrendsChartProps {
  data?: {
    trends?: Array<{
      month: string;
      billed: number;
      collected: number;
    }>;
  };
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function RevenueTrendsChart({
  data,
  isLoading,
  error,
  onRetry,
}: RevenueTrendsChartProps) {
  const chartData = {
    labels: data?.trends?.map((d) => d.month) || [],
    datasets: [
      {
        label: 'Billed',
        data: data?.trends?.map((d) => d.billed) || [],
        borderColor: chartColors.primary.main,
        backgroundColor: chartColors.primary.light,
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Collected',
        data: data?.trends?.map((d) => d.collected) || [],
        borderColor: chartColors.success.main,
        backgroundColor: chartColors.success.light,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    ...lineChartOptions,
    scales: {
      ...lineChartOptions.scales,
      y: {
        ...lineChartOptions.scales.y,
        ticks: {
          ...lineChartOptions.scales.y.ticks,
          callback: (value: any) => `$${(value / 1000).toFixed(0)}k`,
        },
      },
    },
  };

  return (
    <ChartCard
      title="Revenue Trends"
      subtitle="12-month billed vs collected"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
    >
      <Line data={chartData} options={options} />
    </ChartCard>
  );
}
