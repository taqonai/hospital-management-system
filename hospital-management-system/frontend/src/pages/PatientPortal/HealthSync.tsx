import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import {
  DevicePhoneMobileIcon,
  HeartIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  ClockIcon,
  FireIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface HealthDevice {
  id: string;
  provider: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncFrequency: string;
  metricsEnabled: string[];
}

interface HealthMetric {
  id: string;
  metricType: string;
  value: number;
  unit: string;
  source: string;
  recordedAt: string;
}

interface MetricSummary {
  metricType: string;
  current: number;
  average: number;
  min: number;
  max: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  dataPoints: number;
}

const HEALTH_PROVIDERS = [
  {
    id: 'APPLE_HEALTH',
    name: 'Apple Health',
    icon: '🍎',
    color: 'bg-gray-900',
    description: 'Sync data from Apple Watch and iPhone',
  },
  {
    id: 'SAMSUNG_HEALTH',
    name: 'Samsung Health',
    icon: '📱',
    color: 'bg-blue-600',
    description: 'Connect your Samsung Galaxy Watch',
  },
  {
    id: 'GOOGLE_FIT',
    name: 'Google Fit',
    icon: '🏃',
    color: 'bg-green-600',
    description: 'Sync with Google Fit and Wear OS',
  },
  {
    id: 'FITBIT',
    name: 'Fitbit',
    icon: '⌚',
    color: 'bg-teal-500',
    description: 'Connect your Fitbit device',
  },
  {
    id: 'GARMIN',
    name: 'Garmin',
    icon: '🏔️',
    color: 'bg-orange-500',
    description: 'Sync Garmin wearables',
  },
  {
    id: 'WITHINGS',
    name: 'Withings',
    icon: '💊',
    color: 'bg-purple-500',
    description: 'Connect Withings smart scales & devices',
  },
];

const METRIC_ICONS: Record<string, { icon: any; color: string; label: string }> = {
  STEPS: { icon: '👟', color: 'text-green-500', label: 'Steps' },
  HEART_RATE: { icon: '❤️', color: 'text-red-500', label: 'Heart Rate' },
  BLOOD_PRESSURE_SYSTOLIC: { icon: '🩺', color: 'text-blue-500', label: 'Blood Pressure' },
  BLOOD_GLUCOSE: { icon: '🩸', color: 'text-purple-500', label: 'Blood Glucose' },
  WEIGHT: { icon: '⚖️', color: 'text-gray-500', label: 'Weight' },
  SLEEP_DURATION: { icon: '😴', color: 'text-indigo-500', label: 'Sleep' },
  CALORIES_BURNED: { icon: '🔥', color: 'text-orange-500', label: 'Calories' },
  WATER_INTAKE: { icon: '💧', color: 'text-cyan-500', label: 'Water' },
  OXYGEN_SATURATION: { icon: '🫁', color: 'text-blue-400', label: 'SpO2' },
  BODY_TEMPERATURE: { icon: '🌡️', color: 'text-red-400', label: 'Temperature' },
};

export default function HealthSync() {
  const queryClient = useQueryClient();
  const [selectedMetric, setSelectedMetric] = useState<string>('STEPS');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Fetch connected devices
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['health-devices'],
    queryFn: async () => {
      const response = await api.get('/wellness/devices');
      return response.data;
    },
  });

  // Fetch health metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['health-metrics', selectedMetric, dateRange],
    queryFn: async () => {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const response = await api.get('/wellness/metrics', {
        params: {
          metricType: selectedMetric,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      });
      return response.data;
    },
  });

  // Fetch metrics summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['health-metrics-summary', dateRange],
    queryFn: async () => {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const response = await api.get('/wellness/metrics/summary', {
        params: { days },
      });
      return response.data;
    },
  });

  // Connect device mutation
  const connectDeviceMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await api.post('/wellness/devices/connect', {
        provider,
        metricsEnabled: ['STEPS', 'HEART_RATE', 'SLEEP_DURATION', 'CALORIES_BURNED'],
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-devices'] });
      setShowConnectModal(false);
      setSelectedProvider(null);
    },
  });

  // Disconnect device mutation
  const disconnectDeviceMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await api.delete(`/wellness/devices/${provider}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-devices'] });
    },
  });

  // Sync metrics mutation
  const syncMetricsMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await api.post('/wellness/metrics/sync', { provider });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['health-metrics-summary'] });
    },
  });

  // Log manual metric mutation
  const logMetricMutation = useMutation({
    mutationFn: async (data: { metricType: string; value: number; unit: string }) => {
      const response = await api.post('/wellness/metrics', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['health-metrics-summary'] });
    },
  });

  const connectedDevices: HealthDevice[] = devicesData?.devices || [];
  const metrics: HealthMetric[] = metricsData?.metrics || [];
  const summaries: MetricSummary[] = summaryData?.summaries || [];

  // Prepare chart data
  const chartData = {
    labels: metrics.map((m) =>
      new Date(m.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: METRIC_ICONS[selectedMetric]?.label || selectedMetric,
        data: metrics.map((m) => Number(m.value)),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: selectedMetric === 'STEPS',
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Sync</h1>
          <p className="text-gray-600">Connect your health devices and track your vitals</p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <DevicePhoneMobileIcon className="w-5 h-5" />
          Connect Device
        </button>
      </div>

      {/* Connected Devices */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Connected Devices</h2>
        {devicesLoading ? (
          <div className="flex justify-center py-8">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : connectedDevices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DevicePhoneMobileIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No devices connected yet</p>
            <p className="text-sm">Connect a health app to start syncing your data</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedDevices.map((device) => {
              const provider = HEALTH_PROVIDERS.find((p) => p.id === device.provider);
              return (
                <div
                  key={device.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{provider?.icon}</span>
                      <div>
                        <h3 className="font-medium">{provider?.name}</h3>
                        <span
                          className={`text-xs ${
                            device.isActive ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          {device.isActive ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                    </div>
                    {device.isActive ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mb-3">
                    {device.lastSyncAt
                      ? `Last synced: ${new Date(device.lastSyncAt).toLocaleString()}`
                      : 'Never synced'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => syncMetricsMutation.mutate(device.provider)}
                      disabled={syncMetricsMutation.isPending}
                      className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <ArrowPathIcon
                        className={`w-4 h-4 ${syncMetricsMutation.isPending ? 'animate-spin' : ''}`}
                      />
                      Sync
                    </button>
                    <button
                      onClick={() => disconnectDeviceMutation.mutate(device.provider)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Health Metrics Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Health Overview</h2>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {summaryLoading ? (
          <div className="flex justify-center py-8">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ChartBarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No health data available</p>
            <p className="text-sm">Connect a device or log metrics manually</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {summaries.map((summary) => {
              const metricInfo = METRIC_ICONS[summary.metricType];
              return (
                <button
                  key={summary.metricType}
                  onClick={() => setSelectedMetric(summary.metricType)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedMetric === summary.metricType
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{metricInfo?.icon || '📊'}</div>
                  <div className="text-sm text-gray-500">{metricInfo?.label || summary.metricType}</div>
                  <div className="text-xl font-bold">
                    {Number(summary.current).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">{summary.unit}</div>
                  <div
                    className={`text-xs mt-1 ${
                      summary.trend === 'up'
                        ? 'text-green-500'
                        : summary.trend === 'down'
                        ? 'text-red-500'
                        : 'text-gray-400'
                    }`}
                  >
                    {summary.trend === 'up' ? '↑' : summary.trend === 'down' ? '↓' : '→'}{' '}
                    Avg: {Number(summary.average).toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {METRIC_ICONS[selectedMetric]?.label || selectedMetric} Trend
          </h2>
        </div>
        <div className="h-64">
          {metricsLoading ? (
            <div className="flex items-center justify-center h-full">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : metrics.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No data available for this metric
            </div>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* Quick Log Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Log</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLogCard
            icon="⚖️"
            label="Weight"
            unit="kg"
            metricType="WEIGHT"
            onLog={(value) =>
              logMetricMutation.mutate({ metricType: 'WEIGHT', value, unit: 'kg' })
            }
          />
          <QuickLogCard
            icon="🩸"
            label="Blood Glucose"
            unit="mg/dL"
            metricType="BLOOD_GLUCOSE"
            onLog={(value) =>
              logMetricMutation.mutate({ metricType: 'BLOOD_GLUCOSE', value, unit: 'mg/dL' })
            }
          />
          <QuickLogCard
            icon="💧"
            label="Water Intake"
            unit="ml"
            metricType="WATER_INTAKE"
            onLog={(value) =>
              logMetricMutation.mutate({ metricType: 'WATER_INTAKE', value, unit: 'ml' })
            }
          />
          <QuickLogCard
            icon="😴"
            label="Sleep"
            unit="hours"
            metricType="SLEEP_DURATION"
            onLog={(value) =>
              logMetricMutation.mutate({ metricType: 'SLEEP_DURATION', value, unit: 'hours' })
            }
          />
        </div>
      </div>

      {/* Connect Device Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Connect Health App</h2>
            <p className="text-gray-600 mb-6">
              Choose a health app or device to sync your health data
            </p>
            <div className="space-y-3">
              {HEALTH_PROVIDERS.map((provider) => {
                const isConnected = connectedDevices.some((d) => d.provider === provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => !isConnected && connectDeviceMutation.mutate(provider.id)}
                    disabled={isConnected || connectDeviceMutation.isPending}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      isConnected
                        ? 'border-green-300 bg-green-50 cursor-default'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{provider.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-medium">{provider.name}</h3>
                        <p className="text-sm text-gray-500">{provider.description}</p>
                      </div>
                      {isConnected && (
                        <span className="text-green-600 text-sm font-medium">Connected</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick Log Card Component
function QuickLogCard({
  icon,
  label,
  unit,
  metricType,
  onLog,
}: {
  icon: string;
  label: string;
  unit: string;
  metricType: string;
  onLog: (value: number) => void;
}) {
  const [value, setValue] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  const handleLog = () => {
    if (value && !isNaN(Number(value))) {
      setIsLogging(true);
      onLog(Number(value));
      setTimeout(() => {
        setValue('');
        setIsLogging(false);
      }, 500);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={unit}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <button
          onClick={handleLog}
          disabled={!value || isLogging}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLogging ? '...' : 'Log'}
        </button>
      </div>
    </div>
  );
}
