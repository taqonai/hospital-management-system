import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { SyringeIcon, DNAAIIcon, MedicalShieldIcon, NotificationBellIcon } from '../../../icons/HMSIcons';
import { Doughnut } from 'react-chartjs-2';
import { useLabDashboard } from '../../../../hooks/useLabDashboard';
import KPICard from '../shared/KPICard';
import OccupancyGauge from '../shared/OccupancyGauge';
import ChartCard from '../ChartCard';
import { doughnutChartOptions, chartColors } from '../chartSetup';

export default function LabDashboard() {
  const navigate = useNavigate();
  const {
    labStats,
    pendingOrders,
    criticalResults,
    pendingSamples,
    isLoading,
    refetchAll,
  } = useLabDashboard();

  // Sample status chart data
  const sampleStatusData = {
    labels: ['Pending', 'Collected', 'Processing', 'Completed'],
    datasets: [{
      data: [
        pendingSamples?.length || labStats?.pendingOrders || 0,
        labStats?.collected || 0,
        labStats?.processing || 0,
        labStats?.completedToday || 0,
      ],
      backgroundColor: [
        chartColors.warning.main,
        chartColors.primary.main,
        chartColors.cyan.main,
        chartColors.success.main,
      ],
      borderWidth: 0,
    }],
  };

  const completionRate = labStats?.totalOrders > 0
    ? (labStats.completedToday / labStats.totalOrders) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Total Orders"
          value={labStats?.totalOrders || 0}
          icon={DNAAIIcon}
          color="blue"
          subtitle="Today"
          isLoading={isLoading}
          onClick={() => navigate('/laboratory?tab=orders')}
        />
        <KPICard
          title="Pending"
          value={labStats?.pendingOrders || pendingOrders?.length || 0}
          icon={SyringeIcon}
          color="amber"
          subtitle="Awaiting processing"
          isLoading={isLoading}
          onClick={() => navigate('/laboratory?tab=orders')}
        />
        <KPICard
          title="Completed"
          value={labStats?.completedToday || 0}
          icon={MedicalShieldIcon}
          color="emerald"
          subtitle="Today"
          isLoading={isLoading}
          onClick={() => navigate('/laboratory?tab=orders')}
        />
        <KPICard
          title="Critical Results"
          value={labStats?.criticalResults || criticalResults?.length || 0}
          icon={NotificationBellIcon}
          color="red"
          subtitle="Need attention"
          isLoading={isLoading}
          onClick={() => navigate('/laboratory?tab=critical')}
        />
      </div>

      {/* Critical Results Alert */}
      {(criticalResults?.length > 0 || labStats?.criticalResults > 0) && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500">
                <NotificationBellIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Critical Results</h3>
                <p className="text-sm text-red-700">Require immediate notification</p>
              </div>
            </div>
            <Link
              to="/laboratory?tab=critical"
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {criticalResults?.slice(0, 3).map((result: any) => (
              <div key={result.id} className="flex items-center justify-between p-3 rounded-lg bg-white">
                <div>
                  <p className="font-medium text-gray-900">{result.testName}</p>
                  <p className="text-sm text-gray-500">
                    {result.patientName} • Value: {result.value} {result.unit}
                  </p>
                </div>
                <Link
                  to="/laboratory?tab=critical"
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sample Status */}
        <ChartCard
          title="Sample Status"
          subtitle="Processing stages"
          isLoading={isLoading}
          height="h-64"
        >
          <Doughnut data={sampleStatusData} options={doughnutChartOptions} />
        </ChartCard>

        {/* Completion Progress */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Progress</h3>
          <div className="flex justify-center mb-4">
            <OccupancyGauge
              percentage={completionRate}
              label="Completion Rate"
              sublabel={`${labStats?.completedToday || 0} of ${labStats?.totalOrders || 0}`}
              size="lg"
              color="green"
            />
          </div>
        </div>

        {/* Pending Orders Queue */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pending Orders</h3>
            <Link
              to="/laboratory?tab=orders"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3 max-h-52 overflow-y-auto">
            {pendingOrders?.slice(0, 5).map((order: any) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{order.testName || order.test?.name}</p>
                  <p className="text-xs text-gray-500">{order.patientName}</p>
                </div>
                <Link
                  to="/laboratory?tab=orders"
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                >
                  View
                </Link>
              </div>
            ))}

            {(!pendingOrders || pendingOrders.length === 0) && (
              <div className="text-center py-6">
                <MedicalShieldIcon className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No pending orders</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/laboratory?tab=sample-tracking"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <SyringeIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Sample Tracking</p>
            <p className="text-xs text-gray-500">Track samples</p>
          </div>
        </Link>
        <Link
          to="/laboratory?tab=results"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-emerald-500 group-hover:scale-110 transition-transform">
            <DocumentTextIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Results Entry</p>
            <p className="text-xs text-gray-500">Enter results</p>
          </div>
        </Link>
        <Link
          to="/laboratory?tab=orders"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-amber-500 group-hover:scale-110 transition-transform">
            <DNAAIIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Lab Orders</p>
            <p className="text-xs text-gray-500">View all orders</p>
          </div>
        </Link>
        <Link
          to="/laboratory?tab=critical"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-red-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-red-500 group-hover:scale-110 transition-transform">
            <NotificationBellIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Critical Values</p>
            <p className="text-xs text-gray-500">Review alerts</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
