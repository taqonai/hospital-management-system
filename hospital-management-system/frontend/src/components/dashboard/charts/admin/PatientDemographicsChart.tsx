import { Doughnut } from 'react-chartjs-2';
import { doughnutChartOptions, chartColors } from '../chartSetup';
import ChartCard from '../ChartCard';

interface PatientDemographicsChartProps {
  data?: {
    ageDistribution?: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    genderDistribution?: Array<{
      gender: string;
      count: number;
      percentage: number;
    }>;
    total?: number;
  };
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function PatientDemographicsChart({
  data,
  isLoading,
  error,
  onRetry,
}: PatientDemographicsChartProps) {
  const ageData = {
    labels: data?.ageDistribution?.map((d) => d.range) || [],
    datasets: [
      {
        data: data?.ageDistribution?.map((d) => d.count) || [],
        backgroundColor: [
          chartColors.primary.main,
          chartColors.success.main,
          chartColors.warning.main,
          chartColors.danger.main,
          chartColors.purple.main,
          chartColors.cyan.main,
        ],
        borderWidth: 0,
      },
    ],
  };

  const genderData = {
    labels: data?.genderDistribution?.map((d) => d.gender) || [],
    datasets: [
      {
        data: data?.genderDistribution?.map((d) => d.count) || [],
        backgroundColor: [
          chartColors.primary.main,
          chartColors.pink.main,
          chartColors.purple.main,
        ],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    ...doughnutChartOptions,
    plugins: {
      ...doughnutChartOptions.plugins,
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 12,
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <ChartCard
      title="Patient Demographics"
      subtitle={`Total: ${data?.total?.toLocaleString() || 0} patients`}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      height="h-72"
    >
      <div className="grid grid-cols-2 gap-4 h-full">
        <div className="flex flex-col items-center">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Age Distribution</h4>
          <div className="flex-1 w-full">
            <Doughnut data={ageData} options={options} />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Gender Distribution</h4>
          <div className="flex-1 w-full">
            <Doughnut data={genderData} options={options} />
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
