import { Link } from 'react-router-dom';
import {
  PhoneIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { PatientIcon, DoctorAIIcon, MedicalReportAIIcon, NotificationBellIcon } from '../../../icons/HMSIcons';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useMarketingDashboard } from '../../../../hooks/useMarketingDashboard';
import KPICard from '../shared/KPICard';
import ChartCard from '../ChartCard';
import { barChartOptions, doughnutChartOptions, chartColors, chartColorPalette } from '../chartSetup';

export default function MarketingDashboard() {
  const {
    leadStats,
    leadConversion,
    crmDashboard,
    recentLeads,
    campaigns,
    overdueTasks,
    isLoading,
  } = useMarketingDashboard();

  // Lead funnel data
  const funnelData = {
    labels: ['New', 'Contacted', 'Qualified', 'Converted'],
    datasets: [{
      label: 'Leads',
      data: [
        leadStats?.newLeads || 0,
        leadStats?.contactedLeads || 0,
        leadStats?.qualifiedLeads || 0,
        leadStats?.convertedLeads || 0,
      ],
      backgroundColor: [
        chartColors.primary.main,
        chartColors.cyan.main,
        chartColors.warning.main,
        chartColors.success.main,
      ],
      borderRadius: 6,
    }],
  };

  // Source distribution
  const sourceData = {
    labels: leadConversion?.bySource?.map((s: any) => s.source) || [],
    datasets: [{
      data: leadConversion?.bySource?.map((s: any) => s.count) || [],
      backgroundColor: chartColorPalette,
      borderWidth: 0,
    }],
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-700';
      case 'CONTACTED': return 'bg-cyan-100 text-cyan-700';
      case 'QUALIFIED': return 'bg-amber-100 text-amber-700';
      case 'CONVERTED': return 'bg-emerald-100 text-emerald-700';
      case 'LOST': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Total Leads"
          value={leadStats?.totalLeads || crmDashboard?.totalLeads || 0}
          icon={PatientIcon}
          color="blue"
          subtitle="All time"
          isLoading={isLoading}
        />
        <KPICard
          title="New Today"
          value={crmDashboard?.newLeadsToday || 0}
          icon={DoctorAIIcon}
          color="cyan"
          subtitle="Fresh leads"
          isLoading={isLoading}
        />
        <KPICard
          title="Conversion Rate"
          value={`${(leadStats?.conversionRate || 0).toFixed(1)}%`}
          icon={MedicalReportAIIcon}
          color="emerald"
          subtitle="Lead to patient"
          isLoading={isLoading}
        />
        <KPICard
          title="Active Campaigns"
          value={campaigns?.campaigns?.length || 0}
          icon={NotificationBellIcon}
          color="purple"
          subtitle="Running"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Funnel */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Lead Funnel"
            subtitle="Conversion stages"
            isLoading={!leadStats}
          >
            <Bar data={funnelData} options={barChartOptions} />
          </ChartCard>
        </div>

        {/* Source Distribution */}
        <ChartCard
          title="Lead Sources"
          subtitle="By acquisition channel"
          isLoading={!leadConversion}
          height="h-64"
        >
          <Doughnut data={sourceData} options={doughnutChartOptions} />
        </ChartCard>
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Leads</h3>
            <Link
              to="/crm/leads"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recentLeads?.leads?.slice(0, 6).map((lead: any) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{lead.name}</p>
                  <p className="text-sm text-gray-500">{lead.source} • {lead.phone}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lead.status)}`}>
                  {lead.status}
                </span>
              </div>
            ))}

            {(!recentLeads?.leads || recentLeads.leads.length === 0) && (
              <div className="text-center py-8">
                <DoctorAIIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No recent leads</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Campaigns</h3>
            <Link
              to="/crm/campaigns"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {campaigns?.campaigns?.slice(0, 4).map((campaign: any) => (
              <div key={campaign.id} className="p-4 rounded-xl bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900">{campaign.name}</p>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Sent: {campaign.sentCount || 0}</span>
                  <span>Opened: {campaign.openedCount || 0}</span>
                  <span>Clicked: {campaign.clickedCount || 0}</span>
                </div>
              </div>
            ))}

            {(!campaigns?.campaigns || campaigns.campaigns.length === 0) && (
              <div className="text-center py-8">
                <NotificationBellIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No active campaigns</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overdue Tasks Alert */}
      {overdueTasks?.tasks?.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500">
                <NotificationBellIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Overdue Tasks</h3>
                <p className="text-sm text-red-700">{overdueTasks.tasks.length} tasks need attention</p>
              </div>
            </div>
            <Link
              to="/crm/tasks"
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {overdueTasks.tasks.slice(0, 3).map((task: any) => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-white">
                <div>
                  <p className="font-medium text-gray-900">{task.title}</p>
                  <p className="text-sm text-gray-500">{task.leadName} • Due: {task.dueDate}</p>
                </div>
                <button className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                  Complete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/crm/leads/new"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <DoctorAIIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Add Lead</p>
            <p className="text-xs text-gray-500">New prospect</p>
          </div>
        </Link>
        <Link
          to="/crm/campaigns/new"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-purple-500 group-hover:scale-110 transition-transform">
            <NotificationBellIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">New Campaign</p>
            <p className="text-xs text-gray-500">Email/SMS</p>
          </div>
        </Link>
        <Link
          to="/crm/tasks"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-amber-500 group-hover:scale-110 transition-transform">
            <NotificationBellIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Tasks</p>
            <p className="text-xs text-gray-500">Follow-ups</p>
          </div>
        </Link>
        <Link
          to="/crm/reports"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-emerald-500 group-hover:scale-110 transition-transform">
            <MedicalReportAIIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Reports</p>
            <p className="text-xs text-gray-500">Analytics</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
