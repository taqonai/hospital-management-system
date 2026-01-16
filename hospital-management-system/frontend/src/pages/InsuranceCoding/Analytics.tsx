import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChartBarIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { GlassCard } from '../../components/ui/GlassCard';
import { insuranceCodingApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import clsx from 'clsx';

interface DateRange {
  startDate: string;
  endDate: string;
}

// Simple bar chart component using SVG
function BarChart({
  data,
  maxValue,
  height = 200,
  barColor = '#8B5CF6',
  labelKey = 'code',
  valueKey = 'count',
}: {
  data: Array<{ [key: string]: any }>;
  maxValue?: number;
  height?: number;
  barColor?: string;
  labelKey?: string;
  valueKey?: string;
}) {
  const max = maxValue || Math.max(...data.map((d) => d[valueKey] || 0), 1);
  const barWidth = Math.max(30, Math.min(60, 800 / data.length - 10));

  return (
    <div className="overflow-x-auto">
      <svg
        width={Math.max(data.length * (barWidth + 10), 400)}
        height={height + 60}
        className="overflow-visible"
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={50}
              y1={height - (pct / 100) * height}
              x2={data.length * (barWidth + 10) + 50}
              y2={height - (pct / 100) * height}
              stroke="#E5E7EB"
              strokeDasharray="4"
            />
            <text
              x={45}
              y={height - (pct / 100) * height + 4}
              textAnchor="end"
              className="fill-gray-400 text-xs"
            >
              {Math.round((pct / 100) * max)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((item, idx) => {
          const barHeight = ((item[valueKey] || 0) / max) * height;
          const x = 60 + idx * (barWidth + 10);
          const y = height - barHeight;

          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                rx={4}
                className="transition-all duration-300 hover:opacity-80"
              />
              <text
                x={x + barWidth / 2}
                y={height + 15}
                textAnchor="middle"
                className="fill-gray-600 text-xs font-mono"
              >
                {String(item[labelKey] || '').slice(0, 8)}
              </text>
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                className="fill-gray-800 text-xs font-medium"
              >
                {item[valueKey]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Line chart for trends
function LineChart({
  data,
  height = 200,
  lineColor = '#8B5CF6',
  showArea = true,
}: {
  data: Array<{ date: string; diagnoses: number; procedures: number; revenue: number }>;
  height?: number;
  lineColor?: string;
  showArea?: boolean;
}) {
  if (!data.length) return <div className="text-gray-400 text-center py-8">No data</div>;

  const width = Math.max(data.length * 60, 400);
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxDiagnoses = Math.max(...data.map((d) => d.diagnoses), 1);
  const maxProcedures = Math.max(...data.map((d) => d.procedures), 1);
  const maxValue = Math.max(maxDiagnoses, maxProcedures);

  const diagnosisPoints = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
    y: padding.top + chartHeight - (d.diagnoses / maxValue) * chartHeight,
  }));

  const procedurePoints = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
    y: padding.top + chartHeight - (d.procedures / maxValue) * chartHeight,
  }));

  const diagnosisPath = diagnosisPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const procedurePath = procedurePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight - (pct / 100) * chartHeight}
              x2={padding.left + chartWidth}
              y2={padding.top + chartHeight - (pct / 100) * chartHeight}
              stroke="#E5E7EB"
              strokeDasharray="4"
            />
            <text
              x={padding.left - 10}
              y={padding.top + chartHeight - (pct / 100) * chartHeight + 4}
              textAnchor="end"
              className="fill-gray-400 text-xs"
            >
              {Math.round((pct / 100) * maxValue)}
            </text>
          </g>
        ))}

        {/* Diagnosis line */}
        <path d={diagnosisPath} fill="none" stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" />
        {diagnosisPoints.map((p, i) => (
          <circle key={`d-${i}`} cx={p.x} cy={p.y} r={4} fill="#3B82F6" />
        ))}

        {/* Procedure line */}
        <path d={procedurePath} fill="none" stroke="#10B981" strokeWidth={2} strokeLinecap="round" />
        {procedurePoints.map((p, i) => (
          <circle key={`p-${i}`} cx={p.x} cy={p.y} r={4} fill="#10B981" />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={padding.left + (i / (data.length - 1 || 1)) * chartWidth}
            y={height - 10}
            textAnchor="middle"
            className="fill-gray-500 text-xs"
          >
            {d.date.slice(5)}
          </text>
        ))}

        {/* Legend */}
        <g transform={`translate(${padding.left + 10}, ${padding.top})`}>
          <rect x={0} y={0} width={12} height={12} fill="#3B82F6" rx={2} />
          <text x={16} y={10} className="fill-gray-600 text-xs">Diagnoses</text>
          <rect x={100} y={0} width={12} height={12} fill="#10B981" rx={2} />
          <text x={116} y={10} className="fill-gray-600 text-xs">Procedures</text>
        </g>
      </svg>
    </div>
  );
}

// Donut chart for distributions
function DonutChart({
  data,
  size = 200,
  innerRadius = 60,
}: {
  data: Array<{ level: string; count: number; percentage: number }>;
  size?: number;
  innerRadius?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <div className="text-gray-400 text-center py-8">No data</div>;

  const outerRadius = size / 2 - 10;
  const center = size / 2;

  const colors: Record<string, string> = {
    HIGH: '#10B981',
    MEDIUM: '#3B82F6',
    LOW: '#F59E0B',
    UNSPECIFIED: '#EF4444',
  };

  let currentAngle = 0;
  const arcs = data.map((item) => {
    const startAngle = currentAngle;
    const angle = (item.count / total) * 360;
    currentAngle += angle;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((startAngle + angle - 90) * Math.PI) / 180;

    const x1 = center + outerRadius * Math.cos(startRad);
    const y1 = center + outerRadius * Math.sin(startRad);
    const x2 = center + outerRadius * Math.cos(endRad);
    const y2 = center + outerRadius * Math.sin(endRad);

    const ix1 = center + innerRadius * Math.cos(startRad);
    const iy1 = center + innerRadius * Math.sin(startRad);
    const ix2 = center + innerRadius * Math.cos(endRad);
    const iy2 = center + innerRadius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const path = `
      M ${x1} ${y1}
      A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${ix2} ${iy2}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}
      Z
    `;

    return { ...item, path, color: colors[item.level] || '#9CA3AF' };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size}>
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.path}
            fill={arc.color}
            className="transition-all duration-300 hover:opacity-80"
          />
        ))}
        <text x={center} y={center} textAnchor="middle" className="fill-gray-800 text-xl font-bold">
          {total}
        </text>
        <text x={center} y={center + 16} textAnchor="middle" className="fill-gray-500 text-xs">
          Total
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: arc.color }}
            />
            <span className="text-sm text-gray-600">{arc.level}</span>
            <span className="text-sm font-medium text-gray-800">{arc.count}</span>
            <span className="text-xs text-gray-400">({arc.percentage.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Metric card component
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'purple',
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'purple' | 'blue' | 'green' | 'orange' | 'red';
  trend?: { value: number; isPositive: boolean };
}) {
  const colorClasses = {
    purple: 'bg-purple-500/10 text-purple-500',
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    orange: 'bg-orange-500/10 text-orange-500',
    red: 'bg-red-500/10 text-red-500',
  };

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx('p-3 rounded-lg', colorClasses[color])}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        {trend && (
          <div className={clsx(
            'flex items-center gap-1 text-sm',
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          )}>
            <ArrowTrendingUpIcon
              className={clsx('w-4 h-4', !trend.isPositive && 'rotate-180')}
            />
            {trend.value.toFixed(1)}%
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default function Analytics() {
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  });

  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

  // Queries
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['coding-analytics-dashboard', dateRange],
    queryFn: () => insuranceCodingApi.getAnalyticsDashboard(dateRange).then((r) => r.data),
  });

  const { data: icdUsageData, isLoading: icdLoading } = useQuery({
    queryKey: ['coding-analytics-icd', dateRange],
    queryFn: () => insuranceCodingApi.getICD10Usage({ ...dateRange, limit: 10 }).then((r) => r.data),
  });

  const { data: cptUsageData, isLoading: cptLoading } = useQuery({
    queryKey: ['coding-analytics-cpt', dateRange],
    queryFn: () => insuranceCodingApi.getCPTUsage({ ...dateRange, limit: 10 }).then((r) => r.data),
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['coding-analytics-revenue', dateRange],
    queryFn: () => insuranceCodingApi.getRevenueByCategory(dateRange).then((r) => r.data),
  });

  const { data: aiData, isLoading: aiLoading } = useQuery({
    queryKey: ['coding-analytics-ai', dateRange],
    queryFn: () => insuranceCodingApi.getAIAdoptionMetrics(dateRange).then((r) => r.data),
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['coding-analytics-trends', dateRange, granularity],
    queryFn: () => insuranceCodingApi.getCodingTrends({ ...dateRange, granularity }).then((r) => r.data),
  });

  const { data: codePairsData, isLoading: pairsLoading } = useQuery({
    queryKey: ['coding-analytics-pairs', dateRange],
    queryFn: () => insuranceCodingApi.getTopCodePairs({ ...dateRange, limit: 10 }).then((r) => r.data),
  });

  const { data: specificityData, isLoading: specificityLoading } = useQuery({
    queryKey: ['coding-analytics-specificity', dateRange],
    queryFn: () => insuranceCodingApi.getSpecificityAnalysis(dateRange).then((r) => r.data),
  });

  const { data: dischargeData, isLoading: dischargeLoading } = useQuery({
    queryKey: ['coding-analytics-discharge', dateRange],
    queryFn: () => insuranceCodingApi.getDischargeCodingAnalytics(dateRange).then((r) => r.data),
  });

  const dashboard = dashboardData?.data;
  const icdUsage = icdUsageData?.data || [];
  const cptUsage = cptUsageData?.data || [];
  const revenue = revenueData?.data || [];
  const aiMetrics = aiData?.data;
  const trends = trendsData?.data || [];
  const codePairs = codePairsData?.data || [];
  const specificity = specificityData?.data;
  const discharge = dischargeData?.data;

  const formatCurrency = (value: number) => {
    return `AED ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isLoading =
    dashboardLoading ||
    icdLoading ||
    cptLoading ||
    revenueLoading ||
    aiLoading ||
    trendsLoading ||
    pairsLoading ||
    specificityLoading ||
    dischargeLoading;

  return (
    <div className="space-y-6">
      {/* Header with Date Range */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Coding Analytics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Insurance coding metrics and insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-500">Loading analytics...</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MetricCard
              title="Total Diagnoses"
              value={dashboard?.totalDiagnoses?.toLocaleString() || '0'}
              icon={DocumentTextIcon}
              color="blue"
            />
            <MetricCard
              title="Total Procedures"
              value={dashboard?.totalProcedures?.toLocaleString() || '0'}
              icon={ClipboardDocumentListIcon}
              color="green"
            />
            <MetricCard
              title="Unique ICD-10"
              value={dashboard?.uniqueIcdCodes?.toLocaleString() || '0'}
              icon={DocumentTextIcon}
              color="purple"
            />
            <MetricCard
              title="Unique CPT"
              value={dashboard?.uniqueCptCodes?.toLocaleString() || '0'}
              icon={ClipboardDocumentListIcon}
              color="orange"
            />
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(dashboard?.totalRevenue || 0)}
              icon={CurrencyDollarIcon}
              color="green"
            />
            <MetricCard
              title="AI Adoption"
              value={`${Number(dashboard?.aiAdoptionRate || 0).toFixed(1)}%`}
              icon={SparklesIcon}
              color="purple"
            />
          </div>

          {/* AI Adoption Details */}
          {aiMetrics && (
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <SparklesIcon className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  AI Coding Adoption
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Diagnosis AI Adoption</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                    {Number(aiMetrics.diagnoses?.adoptionRate || 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    {aiMetrics.diagnoses?.aiSuggested || 0} of {aiMetrics.diagnoses?.total || 0} codes
                  </p>
                  <p className="text-xs text-blue-500">
                    Avg confidence: {Number(aiMetrics.diagnoses?.avgConfidence || 0).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <p className="text-sm text-green-600 dark:text-green-400 mb-1">Procedure AI Adoption</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {Number(aiMetrics.procedures?.adoptionRate || 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-green-500 mt-1">
                    {aiMetrics.procedures?.aiSuggested || 0} of {aiMetrics.procedures?.total || 0} codes
                  </p>
                  <p className="text-xs text-green-500">
                    Avg confidence: {Number(aiMetrics.procedures?.avgConfidence || 0).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                  <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">Overall AI Adoption</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    {Number(aiMetrics.overall?.overallAdoptionRate || 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-purple-500 mt-1">
                    {aiMetrics.overall?.aiSuggestedCodes || 0} of {aiMetrics.overall?.totalCodes || 0} total codes
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Coding Trends */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Coding Trends
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {(['day', 'week', 'month'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={clsx(
                      'px-3 py-1 rounded-lg text-sm font-medium',
                      granularity === g
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <LineChart data={trends} height={250} />
          </GlassCard>

          {/* Code Usage Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ICD-10 Usage */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <DocumentTextIcon className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Top ICD-10 Codes
                </h3>
              </div>
              {icdUsage.length > 0 ? (
                <BarChart data={icdUsage} barColor="#3B82F6" labelKey="code" valueKey="count" />
              ) : (
                <div className="text-center py-8 text-gray-400">No diagnosis data</div>
              )}
            </GlassCard>

            {/* CPT Usage */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardDocumentListIcon className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Top CPT Codes
                </h3>
              </div>
              {cptUsage.length > 0 ? (
                <BarChart data={cptUsage} barColor="#10B981" labelKey="code" valueKey="count" />
              ) : (
                <div className="text-center py-8 text-gray-400">No procedure data</div>
              )}
            </GlassCard>
          </div>

          {/* Specificity Analysis and Code Pairs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Specificity Analysis */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ChartBarIcon className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Code Specificity Distribution
                </h3>
              </div>
              {specificity?.distribution ? (
                <>
                  <DonutChart data={specificity.distribution} />
                  {specificity.recommendations?.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800">Recommendation</p>
                          <p className="text-sm text-yellow-700">{specificity.recommendations[0]}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">No specificity data</div>
              )}
            </GlassCard>

            {/* Top Code Pairs */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <LinkIcon className="w-5 h-5 text-cyan-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Common ICD-CPT Pairs
                </h3>
              </div>
              {codePairs.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {codePairs.map((pair: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium text-blue-600">
                            {pair.icdCode}
                          </span>
                          <span className="text-gray-400">+</span>
                          <span className="font-mono text-sm font-medium text-green-600">
                            {pair.cptCode}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {pair.icdDescription?.slice(0, 40)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          {pair.count}
                        </span>
                        <p className="text-xs text-gray-400">uses</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">No code pair data</div>
              )}
            </GlassCard>
          </div>

          {/* Revenue by Category */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CurrencyDollarIcon className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Revenue by CPT Category
              </h3>
            </div>
            {revenue.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {revenue.slice(0, 8).map((cat: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl"
                  >
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {cat.category || 'Other'}
                    </p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400 mt-1">
                      {formatCurrency(cat.revenue)}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{cat.count} procedures</span>
                      <span>{Number(cat.percentage || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">No revenue data</div>
            )}
          </GlassCard>

          {/* Discharge Coding Stats */}
          {discharge && (
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardDocumentListIcon className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Discharge Coding (IPD)
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {discharge.total || 0}
                  </p>
                  <p className="text-sm text-gray-500">Total</p>
                </div>
                {Object.entries(discharge.byStatus || {}).map(([status, count]) => (
                  <div key={status} className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {Number(count || 0)}
                    </p>
                    <p className="text-sm text-gray-500">{status}</p>
                  </div>
                ))}
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {Number(discharge.completionRate || 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-green-600">Completion Rate</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(discharge.avgTotalCharges || 0)}
                  </p>
                  <p className="text-sm text-blue-600">Avg Charges</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                    {Number(discharge.avgAcceptancePrediction || 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-purple-600">Avg Acceptance</p>
                </div>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
