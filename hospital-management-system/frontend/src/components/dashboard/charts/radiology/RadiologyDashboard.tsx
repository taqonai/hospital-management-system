import { Link } from 'react-router-dom';
import {
  PhotoIcon,
  ClockIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Doughnut } from 'react-chartjs-2';
import { useRadiologyDashboard } from '../../../../hooks/useRadiologyDashboard';
import KPICard from '../shared/KPICard';
import ChartCard from '../ChartCard';
import { doughnutChartOptions, chartColorPalette } from '../chartSetup';

export default function RadiologyDashboard() {
  const {
    radiologyStats,
    worklist,
    pendingReports,
    isLoading,
  } = useRadiologyDashboard();

  // Modality distribution chart - only create when API data is available
  const hasModalityData = radiologyStats?.byModality && radiologyStats.byModality.length > 0;
  const modalityData = hasModalityData ? {
    labels: radiologyStats.byModality.map((m: any) => m.modality),
    datasets: [{
      data: radiologyStats.byModality.map((m: any) => m.count),
      backgroundColor: chartColorPalette,
      borderWidth: 0,
    }],
  } : null;

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'STAT':
      case 'URGENT': return 'bg-red-100 text-red-700';
      case 'ROUTINE': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Total Orders"
          value={radiologyStats?.totalOrders || 0}
          icon={PhotoIcon}
          color="blue"
          subtitle="Today"
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Studies"
          value={radiologyStats?.pendingOrders || worklist?.length || 0}
          icon={ClockIcon}
          color="amber"
          subtitle="Awaiting imaging"
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Reports"
          value={radiologyStats?.pendingReports || pendingReports?.length || 0}
          icon={DocumentTextIcon}
          color="purple"
          subtitle="Need reporting"
          isLoading={isLoading}
        />
        <KPICard
          title="AI Analyzed"
          value={radiologyStats?.aiAnalyzed || 0}
          icon={SparklesIcon}
          color="emerald"
          subtitle="AI-assisted readings"
          isLoading={isLoading}
        />
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modality Distribution */}
        <ChartCard
          title="By Modality"
          subtitle="Today's distribution"
          isLoading={isLoading}
          height="h-64"
        >
          {modalityData ? (
            <Doughnut data={modalityData} options={doughnutChartOptions} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <PhotoIcon className="h-12 w-12 mb-2" />
              <p className="text-sm">No modality data available</p>
            </div>
          )}
        </ChartCard>

        {/* Worklist */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Imaging Worklist</h3>
            <Link
              to="/radiology/worklist"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Patient</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Study</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Priority</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {worklist?.slice(0, 5).map((study: any) => (
                  <tr key={study.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{study.patientName}</p>
                      <p className="text-xs text-gray-500">{study.mrn}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-900">{study.modality}</p>
                      <p className="text-xs text-gray-500">{study.bodyPart}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(study.priority)}`}>
                        {study.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{study.status}</td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/radiology/study/${study.id}`}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!worklist || worklist.length === 0) && (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-500">No studies in worklist</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Reports */}
      {pendingReports?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pending Reports</h3>
            <Link
              to="/radiology/pending-reports"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingReports.slice(0, 6).map((study: any) => (
              <div key={study.id} className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{study.patientName}</p>
                    <p className="text-sm text-gray-600">{study.modality} - {study.bodyPart}</p>
                    <p className="text-xs text-gray-500 mt-1">{study.studyDate}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(study.priority)}`}>
                    {study.priority}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    to={`/radiology/report/${study.id}`}
                    className="flex-1 text-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Write Report
                  </Link>
                  <Link
                    to={`/radiology/ai-analysis/${study.id}`}
                    className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium"
                  >
                    AI
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/radiology/worklist"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <PhotoIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Worklist</p>
            <p className="text-xs text-gray-500">View studies</p>
          </div>
        </Link>
        <Link
          to="/radiology/report"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-emerald-500 group-hover:scale-110 transition-transform">
            <DocumentTextIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Write Report</p>
            <p className="text-xs text-gray-500">Create findings</p>
          </div>
        </Link>
        <Link
          to="/medical-imaging"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 group-hover:scale-110 transition-transform">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">AI Analysis</p>
            <p className="text-xs text-gray-500">Get insights</p>
          </div>
        </Link>
        <Link
          to="/radiology/orders"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-amber-500 group-hover:scale-110 transition-transform">
            <ClockIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Orders</p>
            <p className="text-xs text-gray-500">View requests</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
