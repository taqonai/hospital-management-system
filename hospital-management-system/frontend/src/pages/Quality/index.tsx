import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChartBarIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FunnelIcon,
  BellAlertIcon,
  DocumentMagnifyingGlassIcon,
  ListBulletIcon,
  ChartPieIcon,
  UserGroupIcon,
  HeartIcon,
  BeakerIcon,
  CalendarDaysIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { qualityApi } from '../../services/api';
import AuditTracker from './components/AuditTracker';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Placeholder components - will be imported from separate files
const QualityIndicators = ({ onViewDetails }: { onViewDetails?: (id: string) => void }) => (
  <div className="text-center py-16 text-gray-500">
    <ClipboardDocumentCheckIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
    <p className="font-medium">Quality Indicators Management</p>
    <p className="text-sm mt-2">Component will be loaded here</p>
  </div>
);

const IncidentReporting = ({ onViewDetails }: { onViewDetails?: (id: string) => void }) => (
  <div className="text-center py-16 text-gray-500">
    <ExclamationTriangleIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
    <p className="font-medium">Incident Reporting & Tracking</p>
    <p className="text-sm mt-2">Component will be loaded here</p>
  </div>
);

// Types
type TabType = 'dashboard' | 'indicators' | 'incidents' | 'audits';

interface QualityStats {
  totalIndicators: number;
  activeIndicators: number;
  complianceRate: number;
  openIncidents: number;
  severeEvents: number;
  sentinelEvents: number;
  pendingAudits: number;
  completedAudits: number;
}

interface QualityIndicator {
  id: string;
  name: string;
  category: string;
  target: number;
  actual: number;
  trend: 'up' | 'down' | 'stable';
  status: 'meeting' | 'at_risk' | 'below';
  lastMeasured: string;
}

interface Incident {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'sentinel';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  reportedAt: string;
  description: string;
  department: string;
  reporter: string;
}

interface KPIMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  target: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
}

// Mock data generators
const generateMockStats = (): QualityStats => ({
  totalIndicators: 48,
  activeIndicators: 42,
  complianceRate: 87.5,
  openIncidents: 12,
  severeEvents: 3,
  sentinelEvents: 1,
  pendingAudits: 8,
  completedAudits: 156,
});

const generateMockIndicators = (): QualityIndicator[] => [
  { id: '1', name: 'Hand Hygiene Compliance', category: 'Infection Control', target: 95, actual: 92.3, trend: 'up', status: 'at_risk', lastMeasured: '2026-01-06' },
  { id: '2', name: 'Medication Error Rate', category: 'Patient Safety', target: 0.5, actual: 0.3, trend: 'down', status: 'meeting', lastMeasured: '2026-01-06' },
  { id: '3', name: 'Patient Fall Rate', category: 'Patient Safety', target: 2, actual: 1.8, trend: 'stable', status: 'meeting', lastMeasured: '2026-01-06' },
  { id: '4', name: 'SSI Rate', category: 'Infection Control', target: 1, actual: 1.5, trend: 'up', status: 'below', lastMeasured: '2026-01-05' },
  { id: '5', name: 'CLABSI Rate', category: 'Infection Control', target: 0, actual: 0.2, trend: 'down', status: 'at_risk', lastMeasured: '2026-01-06' },
  { id: '6', name: 'Readmission Rate (30-day)', category: 'Clinical Outcomes', target: 10, actual: 8.5, trend: 'down', status: 'meeting', lastMeasured: '2026-01-06' },
  { id: '7', name: 'CAUTI Rate', category: 'Infection Control', target: 0, actual: 0.1, trend: 'stable', status: 'at_risk', lastMeasured: '2026-01-06' },
  { id: '8', name: 'Pressure Ulcer Rate', category: 'Nursing Quality', target: 1, actual: 0.8, trend: 'down', status: 'meeting', lastMeasured: '2026-01-05' },
];

const generateMockIncidents = (): Incident[] => [
  { id: 'INC-001', type: 'Medication Error', severity: 'medium', status: 'investigating', reportedAt: '2026-01-06T10:30:00', description: 'Wrong dosage administered', department: 'Medical Ward A', reporter: 'Nurse Williams' },
  { id: 'INC-002', type: 'Patient Fall', severity: 'high', status: 'open', reportedAt: '2026-01-06T08:15:00', description: 'Patient fell in bathroom', department: 'Orthopedic Ward', reporter: 'Nurse Johnson' },
  { id: 'INC-003', type: 'Equipment Failure', severity: 'low', status: 'resolved', reportedAt: '2026-01-05T14:20:00', description: 'IV pump malfunction', department: 'ICU', reporter: 'Nurse Davis' },
  { id: 'INC-004', type: 'Near Miss', severity: 'low', status: 'closed', reportedAt: '2026-01-05T09:45:00', description: 'Wrong patient identification caught before procedure', department: 'Surgery', reporter: 'Dr. Smith' },
  { id: 'INC-005', type: 'Sentinel Event', severity: 'sentinel', status: 'investigating', reportedAt: '2026-01-04T16:00:00', description: 'Retained surgical instrument', department: 'Surgery', reporter: 'Dr. Brown' },
];

const generateMockKPIs = (): KPIMetric[] => [
  { id: '1', name: 'Patient Safety Score', value: 94.2, unit: '%', target: 95, trend: 'up', status: 'warning' },
  { id: '2', name: 'Infection Rate', value: 1.2, unit: 'per 1000 patient days', target: 2, trend: 'down', status: 'good' },
  { id: '3', name: 'Readmission Rate', value: 8.5, unit: '%', target: 10, trend: 'down', status: 'good' },
  { id: '4', name: 'Patient Satisfaction', value: 88.7, unit: '%', target: 90, trend: 'up', status: 'warning' },
];

export default function QualityManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [dateRange, setDateRange] = useState<string>('month');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // TanStack Query for fetching data
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['quality-stats'],
    queryFn: async () => {
      try {
        const response = await qualityApi.getStats();
        return response.data?.data || response.data;
      } catch {
        return generateMockStats();
      }
    },
    staleTime: 60000,
  });

  const { data: indicatorsData, isLoading: indicatorsLoading, refetch: refetchIndicators } = useQuery({
    queryKey: ['quality-indicators'],
    queryFn: async () => {
      try {
        const response = await qualityApi.getIndicators();
        return response.data?.data?.indicators || response.data?.indicators || generateMockIndicators();
      } catch {
        return generateMockIndicators();
      }
    },
    staleTime: 60000,
  });

  const { data: incidentsData, isLoading: incidentsLoading, refetch: refetchIncidents } = useQuery({
    queryKey: ['quality-incidents'],
    queryFn: async () => {
      try {
        const response = await qualityApi.getIncidents();
        return response.data?.data?.incidents || response.data?.incidents || generateMockIncidents();
      } catch {
        return generateMockIncidents();
      }
    },
    staleTime: 60000,
  });

  // Use mock data if API returns nothing
  const stats: QualityStats = statsData || generateMockStats();
  const indicators: QualityIndicator[] = indicatorsData || generateMockIndicators();
  const incidents: Incident[] = incidentsData || generateMockIncidents();
  const kpis: KPIMetric[] = generateMockKPIs();

  const handleRefresh = () => {
    refetchStats();
    refetchIndicators();
    refetchIncidents();
    setLastRefresh(new Date());
  };

  // Calculate derived stats
  const topPerformers = useMemo(() =>
    [...indicators]
      .filter(i => i.status === 'meeting')
      .sort((a, b) => (b.actual / b.target) - (a.actual / a.target))
      .slice(0, 3),
    [indicators]
  );

  const bottomPerformers = useMemo(() =>
    [...indicators]
      .filter(i => i.status === 'below' || i.status === 'at_risk')
      .sort((a, b) => (a.actual / a.target) - (b.actual / b.target))
      .slice(0, 3),
    [indicators]
  );

  const recentIncidents = useMemo(() =>
    [...incidents]
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
      .slice(0, 5),
    [incidents]
  );

  const openIncidentsCount = incidents.filter(i => i.status === 'open' || i.status === 'investigating').length;
  const sentinelCount = incidents.filter(i => i.severity === 'sentinel').length;

  // Chart data for quality trend
  const qualityTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Compliance Rate',
        data: [85, 86, 84, 88, 87, 89, 90, 88, 91, 89, 88, 87.5],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Target',
        data: [90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90],
        borderColor: 'rgb(156, 163, 175)',
        borderDash: [5, 5],
        tension: 0,
        fill: false,
      },
    ],
  };

  // Chart data for incident trend
  const incidentTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Low',
        data: [12, 15, 10, 14, 11, 9, 13, 10, 8, 11, 9, 10],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Medium',
        data: [5, 7, 6, 4, 5, 6, 4, 5, 3, 4, 4, 5],
        backgroundColor: 'rgba(234, 179, 8, 0.8)',
      },
      {
        label: 'High',
        data: [2, 3, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2],
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
      },
      {
        label: 'Sentinel',
        data: [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
    ],
  };

  // Chart data for incident severity distribution
  const incidentSeverityData = {
    labels: ['Low', 'Medium', 'High', 'Sentinel'],
    datasets: [
      {
        data: [
          incidents.filter(i => i.severity === 'low').length || 2,
          incidents.filter(i => i.severity === 'medium').length || 1,
          incidents.filter(i => i.severity === 'high').length || 1,
          incidents.filter(i => i.severity === 'sentinel').length || 1,
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
    },
    cutout: '60%',
  };

  // Helper functions
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'sentinel':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'investigating':
        return 'bg-purple-100 text-purple-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getIndicatorStatusBadge = (status: string) => {
    switch (status) {
      case 'meeting':
        return 'bg-green-100 text-green-800';
      case 'at_risk':
        return 'bg-yellow-100 text-yellow-800';
      case 'below':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="h-4 w-4 text-green-600" />;
      case 'down':
        return <ArrowTrendingDownIcon className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isLoading = statsLoading || indicatorsLoading || incidentsLoading;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl shadow-emerald-500/25">
            <ShieldCheckIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quality Management</h1>
            <p className="text-gray-500">Healthcare quality indicators, incident tracking, and audit management</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>

          <span className="text-sm text-gray-500 hidden md:inline">
            Updated: {lastRefresh.toLocaleTimeString()}
          </span>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh data"
          >
            <ArrowPathIcon className={`h-5 w-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Indicators */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-blue-100">
              <ListBulletIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalIndicators}</p>
          <p className="text-xs text-gray-500">Total Indicators</p>
        </div>

        {/* Active Indicators */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-green-100">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.activeIndicators}</p>
          <p className="text-xs text-gray-500">Active Indicators</p>
        </div>

        {/* Compliance Rate with Gauge */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-4 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-emerald-100">
              <ChartPieIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeDasharray={`${(stats.complianceRate / 100) * 125.6} 125.6`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-600">
                {Math.round(stats.complianceRate)}%
              </span>
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats.complianceRate.toFixed(1)}%</p>
          <p className="text-xs text-emerald-600">Compliance Rate</p>
        </div>

        {/* Open Incidents */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-4 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-amber-100">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
            </div>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              openIncidentsCount > 10 ? 'bg-red-100 text-red-700' :
              openIncidentsCount > 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
            }`}>
              {openIncidentsCount > 10 ? 'High' : openIncidentsCount > 5 ? 'Medium' : 'Low'}
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.openIncidents}</p>
          <p className="text-xs text-amber-600">Open Incidents</p>
        </div>

        {/* Severe Events */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl border border-orange-200 p-4 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-orange-100">
              <BellAlertIcon className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-orange-600">{stats.severeEvents}</p>
          <p className="text-xs text-orange-600">Severe Events (Month)</p>
        </div>

        {/* Sentinel Events */}
        <div className={`rounded-2xl border p-4 shadow-lg hover:shadow-xl transition-shadow ${
          sentinelCount > 0
            ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300 animate-pulse'
            : 'bg-white/80 backdrop-blur-xl border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-xl ${sentinelCount > 0 ? 'bg-red-200' : 'bg-red-100'}`}>
              <ExclamationCircleIcon className={`h-5 w-5 ${sentinelCount > 0 ? 'text-red-700' : 'text-red-600'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${sentinelCount > 0 ? 'text-red-700' : 'text-red-600'}`}>
            {stats.sentinelEvents}
          </p>
          <p className={`text-xs ${sentinelCount > 0 ? 'text-red-700' : 'text-red-600'}`}>
            Sentinel Events
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 px-4 bg-gray-50/50">
          <nav className="flex -mb-px overflow-x-auto">
            {[
              { id: 'dashboard' as TabType, label: 'Dashboard', icon: ChartBarIcon },
              { id: 'indicators' as TabType, label: 'Indicators', icon: ClipboardDocumentCheckIcon },
              { id: 'incidents' as TabType, label: 'Incidents', icon: ExclamationTriangleIcon, badge: openIncidentsCount },
              { id: 'audits' as TabType, label: 'Audits', icon: DocumentMagnifyingGlassIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full font-bold bg-amber-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* KPI Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className={`p-4 rounded-2xl border shadow-sm ${
                      kpi.status === 'good'
                        ? 'bg-green-50 border-green-200'
                        : kpi.status === 'warning'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-600">{kpi.name}</p>
                      {getTrendIcon(kpi.trend)}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-2xl font-bold ${
                        kpi.status === 'good' ? 'text-green-700' :
                        kpi.status === 'warning' ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        {kpi.value}
                      </p>
                      <span className="text-sm text-gray-500">{kpi.unit}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Target: {kpi.target}{kpi.unit === '%' ? '%' : ''}</span>
                        <span>{((kpi.value / kpi.target) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            kpi.status === 'good' ? 'bg-green-500' :
                            kpi.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quality Trend Chart */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5 text-emerald-600" />
                    Quality Trend
                  </h3>
                  <div className="h-64">
                    <Line data={qualityTrendData} options={chartOptions} />
                  </div>
                </div>

                {/* Incident Trend Chart */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                    Incident Trend
                  </h3>
                  <div className="h-64">
                    <Bar data={incidentTrendData} options={barChartOptions} />
                  </div>
                </div>
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Incidents */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-gray-600" />
                    Recent Incidents
                  </h3>
                  <div className="space-y-3">
                    {recentIncidents.map((incident) => (
                      <div
                        key={incident.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(incident.severity)}`}>
                            {incident.severity}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{incident.type}</p>
                            <p className="text-xs text-gray-500">{incident.department} - {formatDate(incident.reportedAt)}</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(incident.status)}`}>
                          {incident.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveTab('incidents')}
                    className="mt-4 w-full py-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    View All Incidents
                  </button>
                </div>

                {/* Incident Severity Distribution */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ChartPieIcon className="h-5 w-5 text-purple-600" />
                    Severity Distribution
                  </h3>
                  <div className="h-48">
                    <Doughnut data={incidentSeverityData} options={doughnutOptions} />
                  </div>
                </div>
              </div>

              {/* Indicator Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performers */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-6">
                  <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                    <ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />
                    Top Performing Indicators
                  </h3>
                  <div className="space-y-3">
                    {topPerformers.map((indicator, index) => (
                      <div
                        key={indicator.id}
                        className="flex items-center justify-between p-3 bg-white/80 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{indicator.name}</p>
                            <p className="text-xs text-gray-500">{indicator.category}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{indicator.actual}</p>
                          <p className="text-xs text-gray-500">Target: {indicator.target}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Needs Attention */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border border-red-200 p-6">
                  <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
                    <ArrowTrendingDownIcon className="h-5 w-5 text-red-600" />
                    Indicators Needing Attention
                  </h3>
                  <div className="space-y-3">
                    {bottomPerformers.map((indicator, index) => (
                      <div
                        key={indicator.id}
                        className="flex items-center justify-between p-3 bg-white/80 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            indicator.status === 'below' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
                          }`}>
                            !
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{indicator.name}</p>
                            <p className="text-xs text-gray-500">{indicator.category}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            indicator.status === 'below' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {indicator.actual}
                          </p>
                          <p className="text-xs text-gray-500">Target: {indicator.target}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Indicators Tab */}
          {activeTab === 'indicators' && (
            <QualityIndicators />
          )}

          {/* Incidents Tab */}
          {activeTab === 'incidents' && (
            <IncidentReporting />
          )}

          {/* Audits Tab */}
          {activeTab === 'audits' && (
            <AuditTracker />
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-emerald-600" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Report Incident', icon: ExclamationTriangleIcon, color: 'from-amber-500 to-orange-600' },
            { name: 'Add Measurement', icon: ChartBarIcon, color: 'from-blue-500 to-indigo-600' },
            { name: 'Start Audit', icon: ClipboardDocumentCheckIcon, color: 'from-purple-500 to-violet-600' },
            { name: 'Generate Report', icon: DocumentMagnifyingGlassIcon, color: 'from-emerald-500 to-teal-600' },
          ].map((action) => (
            <button
              key={action.name}
              className={`p-4 rounded-xl bg-gradient-to-br ${action.color} text-white hover:shadow-lg transition-all hover:scale-105`}
            >
              <action.icon className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm font-medium">{action.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
