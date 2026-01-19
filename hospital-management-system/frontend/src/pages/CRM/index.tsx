import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChartBarIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
  MegaphoneIcon,
  ChatBubbleLeftRightIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  CalendarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  TagIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { crmApi } from '../../services/api';
import { format, formatDistanceToNow } from 'date-fns';

// Types
interface Lead {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  source: string;
  status: string;
  priority: string;
  score: number;
  assignedTo?: { id: string; firstName: string; lastName: string };
  nextFollowUpAt?: string;
  createdAt: string;
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  _count?: { activities: number; communications: number; tasks: number };
}

interface DashboardStats {
  leadStats: {
    totalLeads: number;
    newLeads: number;
    contactedLeads: number;
    qualifiedLeads: number;
    convertedLeads: number;
    lostLeads: number;
    conversionRate: string;
    bySource: Array<{ source: string; _count: { source: number } }>;
  };
  overdueTasks: any[];
  recentLeads: Lead[];
}

// Tab configuration
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
  { id: 'leads', label: 'Leads', icon: UserPlusIcon },
  { id: 'tasks', label: 'Tasks', icon: ClipboardDocumentListIcon },
  { id: 'campaigns', label: 'Campaigns', icon: MegaphoneIcon },
  { id: 'surveys', label: 'Surveys', icon: ChatBubbleLeftRightIcon },
  { id: 'templates', label: 'Templates', icon: DocumentDuplicateIcon },
];

// Lead status configuration for Kanban
const leadStatuses = [
  { status: 'NEW', label: 'New', color: 'bg-purple-500', bgLight: 'bg-purple-50' },
  { status: 'CONTACTED', label: 'Contacted', color: 'bg-blue-500', bgLight: 'bg-blue-50' },
  { status: 'QUALIFIED', label: 'Qualified', color: 'bg-amber-500', bgLight: 'bg-amber-50' },
  { status: 'APPOINTMENT_SCHEDULED', label: 'Scheduled', color: 'bg-cyan-500', bgLight: 'bg-cyan-50' },
  { status: 'CONVERTED', label: 'Converted', color: 'bg-green-500', bgLight: 'bg-green-50' },
  { status: 'LOST', label: 'Lost', color: 'bg-gray-400', bgLight: 'bg-gray-50' },
];

const sourceLabels: Record<string, string> = {
  WEBSITE: 'Website',
  PHONE_CALL: 'Phone Call',
  WALK_IN: 'Walk-in',
  REFERRAL_PATIENT: 'Patient Referral',
  REFERRAL_DOCTOR: 'Doctor Referral',
  SOCIAL_MEDIA: 'Social Media',
  GOOGLE_ADS: 'Google Ads',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp',
  EMAIL_INQUIRY: 'Email',
  HEALTH_CAMP: 'Health Camp',
  CORPORATE: 'Corporate',
  INSURANCE_PARTNER: 'Insurance',
  OTHER: 'Other',
};

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-gray-100 text-gray-800',
};

export default function CRM() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [filters, setFilters] = useState({ source: '', priority: '', assignedToId: '' });

  const queryClient = useQueryClient();

  // Queries
  const { data: dashboardData, isLoading: loadingDashboard } = useQuery<{ data: DashboardStats }>({
    queryKey: ['crm-dashboard'],
    queryFn: () => crmApi.getDashboard(),
    enabled: activeTab === 'dashboard',
  });

  const { data: leadsData, isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['crm-leads', searchQuery, filters],
    queryFn: () => crmApi.getLeads({ search: searchQuery, limit: 100, ...filters }),
    enabled: activeTab === 'leads',
  });

  const { data: tasksData, isLoading: loadingTasks } = useQuery({
    queryKey: ['crm-tasks'],
    queryFn: () => crmApi.getTasks({ limit: 50 }),
    enabled: activeTab === 'tasks',
  });

  const { data: campaignsData, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['crm-campaigns'],
    queryFn: () => crmApi.getCampaigns(),
    enabled: activeTab === 'campaigns',
  });

  const { data: surveysData, isLoading: loadingSurveys } = useQuery({
    queryKey: ['crm-surveys'],
    queryFn: () => crmApi.getSurveys(),
    enabled: activeTab === 'surveys',
  });

  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['crm-templates'],
    queryFn: () => crmApi.getTemplates(),
    enabled: activeTab === 'templates',
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      crmApi.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: (data: any) => crmApi.createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      setShowLeadModal(false);
    },
  });

  // Group leads by status for Kanban
  const leadsByStatus = useMemo(() => {
    if (!leadsData?.data) return {};
    const grouped: Record<string, Lead[]> = {};
    leadStatuses.forEach((s) => {
      grouped[s.status] = leadsData.data.filter((lead: Lead) => lead.status === s.status);
    });
    return grouped;
  }, [leadsData]);

  // Handle drag and drop for Kanban
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData('leadId', lead.id);
    e.dataTransfer.setData('currentStatus', lead.status);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const currentStatus = e.dataTransfer.getData('currentStatus');

    if (currentStatus !== newStatus) {
      updateStatusMutation.mutate({ id: leadId, status: newStatus });
    }
  };

  // Render Dashboard Tab
  const renderDashboard = () => {
    if (loadingDashboard) {
      return <div className="flex justify-center py-12"><ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" /></div>;
    }

    const stats = dashboardData?.data?.leadStats;

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Total Leads" value={stats?.totalLeads || 0} color="purple" />
          <StatCard label="New" value={stats?.newLeads || 0} color="blue" />
          <StatCard label="Contacted" value={stats?.contactedLeads || 0} color="indigo" />
          <StatCard label="Qualified" value={stats?.qualifiedLeads || 0} color="amber" />
          <StatCard label="Converted" value={stats?.convertedLeads || 0} color="green" />
          <StatCard label="Conversion Rate" value={`${stats?.conversionRate || 0}%`} color="teal" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Sources */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads by Source</h3>
            <div className="space-y-3">
              {stats?.bySource?.map((item: any) => (
                <div key={item.source} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{sourceLabels[item.source] || item.source}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                        style={{ width: `${(item._count.source / (stats?.totalLeads || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8">{item._count.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Leads */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Leads</h3>
            <div className="space-y-3">
              {dashboardData?.data?.recentLeads?.map((lead: any) => (
                <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                    <p className="text-sm text-gray-500">{sourceLabels[lead.source]}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    lead.status === 'NEW' ? 'bg-purple-100 text-purple-700' :
                    lead.status === 'CONTACTED' ? 'bg-blue-100 text-blue-700' :
                    lead.status === 'QUALIFIED' ? 'bg-amber-100 text-amber-700' :
                    lead.status === 'CONVERTED' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {lead.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overdue Tasks */}
        {dashboardData?.data?.overdueTasks && dashboardData.data.overdueTasks.length > 0 && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold text-red-900">Overdue Tasks</h3>
            </div>
            <div className="space-y-2">
              {dashboardData.data.overdueTasks.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <p className="text-sm text-gray-500">
                      Due {format(new Date(task.dueDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className="text-sm text-red-600">{task.lead?.firstName} {task.lead?.lastName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Leads Tab (Kanban)
  const renderLeads = () => {
    if (loadingLeads) {
      return <div className="flex justify-center py-12"><ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" /></div>;
    }

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowLeadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25"
          >
            <PlusIcon className="h-5 w-5" />
            New Lead
          </button>
        </div>

        {/* Kanban View */}
        {viewMode === 'kanban' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {leadStatuses.map((statusConfig) => (
              <div
                key={statusConfig.status}
                className="flex-shrink-0 w-72"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, statusConfig.status)}
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between p-3 rounded-t-xl ${statusConfig.bgLight}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusConfig.color}`} />
                    <span className="font-semibold text-gray-900">{statusConfig.label}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full">
                    {leadsByStatus[statusConfig.status]?.length || 0}
                  </span>
                </div>

                {/* Cards Container */}
                <div className={`min-h-[400px] p-2 rounded-b-xl ${statusConfig.bgLight} bg-opacity-50`}>
                  <div className="space-y-2">
                    {leadsByStatus[statusConfig.status]?.map((lead: Lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onDragStart={(e) => handleDragStart(e, lead)}
                        onClick={() => setSelectedLead(lead)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leadsData?.data?.map((lead: Lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                        <p className="text-sm text-gray-500">{lead.leadNumber}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <p className="text-gray-900">{lead.phone}</p>
                        {lead.email && <p className="text-gray-500">{lead.email}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{sourceLabels[lead.source]}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lead.status === 'NEW' ? 'bg-purple-100 text-purple-700' :
                        lead.status === 'CONTACTED' ? 'bg-blue-100 text-blue-700' :
                        lead.status === 'QUALIFIED' ? 'bg-amber-100 text-amber-700' :
                        lead.status === 'CONVERTED' ? 'bg-green-100 text-green-700' :
                        lead.status === 'LOST' ? 'bg-gray-100 text-gray-700' :
                        'bg-cyan-100 text-cyan-700'
                      }`}>
                        {lead.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              lead.score >= 70 ? 'bg-green-500' :
                              lead.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600">{lead.score}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Render Tasks Tab
  const renderTasks = () => {
    if (loadingTasks) {
      return <div className="flex justify-center py-12"><ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" /></div>;
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Tasks</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25">
            <PlusIcon className="h-5 w-5" />
            New Task
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {tasksData?.data?.map((task: any) => (
            <div key={task.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-3 h-3 rounded-full ${
                    task.status === 'COMPLETED' ? 'bg-green-500' :
                    task.status === 'OVERDUE' ? 'bg-red-500' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-gray-400'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        Due {format(new Date(task.dueDate), 'MMM d, yyyy')}
                      </span>
                      {task.lead && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <UserGroupIcon className="h-4 w-4" />
                          {task.lead.firstName} {task.lead.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[task.priority] || 'bg-gray-100 text-gray-800'}`}>
                    {task.priority}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {(!tasksData?.data || tasksData.data.length === 0) && (
            <div className="p-8 text-center text-gray-500">No tasks found</div>
          )}
        </div>
      </div>
    );
  };

  // Render Campaigns Tab
  const renderCampaigns = () => {
    if (loadingCampaigns) {
      return <div className="flex justify-center py-12"><ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" /></div>;
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Campaigns</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25">
            <PlusIcon className="h-5 w-5" />
            New Campaign
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaignsData?.data?.map((campaign: any) => (
            <div key={campaign.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">{campaign.name}</h4>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                    campaign.status === 'RUNNING' ? 'bg-green-100 text-green-700' :
                    campaign.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' :
                    campaign.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                    campaign.status === 'COMPLETED' ? 'bg-purple-100 text-purple-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                <MegaphoneIcon className="h-8 w-8 text-purple-200" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="text-gray-900">{campaign.campaignType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Channel</span>
                  <span className="text-gray-900">{campaign.channel.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sent</span>
                  <span className="text-gray-900">{campaign.sentCount} / {campaign.totalRecipients}</span>
                </div>
              </div>
            </div>
          ))}
          {(!campaignsData?.data || campaignsData.data.length === 0) && (
            <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
              No campaigns found. Create your first campaign to get started.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Surveys Tab
  const renderSurveys = () => {
    if (loadingSurveys) {
      return <div className="flex justify-center py-12"><ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" /></div>;
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Surveys</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25">
            <PlusIcon className="h-5 w-5" />
            New Survey
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveysData?.data?.map((survey: any) => (
            <div key={survey.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">{survey.name}</h4>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                    survey.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {survey.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <ChatBubbleLeftRightIcon className="h-8 w-8 text-purple-200" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="text-gray-900">{survey.surveyType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Responses</span>
                  <span className="text-gray-900">{survey._count?.responses || survey.responseCount || 0}</span>
                </div>
                {survey.avgRating && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Rating</span>
                    <span className="text-gray-900">{Number(survey.avgRating).toFixed(1)} / 5</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {(!surveysData?.data || surveysData.data.length === 0) && (
            <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
              No surveys found. Create your first survey to collect feedback.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Templates Tab
  const renderTemplates = () => {
    if (loadingTemplates) {
      return <div className="flex justify-center py-12"><ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" /></div>;
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Message Templates</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25">
            <PlusIcon className="h-5 w-5" />
            New Template
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {templatesData?.data?.map((template: any) => (
            <div key={template.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    template.channel === 'EMAIL' ? 'bg-blue-100 text-blue-600' :
                    template.channel === 'SMS' ? 'bg-green-100 text-green-600' :
                    template.channel === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {template.channel === 'EMAIL' ? <EnvelopeIcon className="h-5 w-5" /> :
                     template.channel === 'PHONE_CALL' ? <PhoneIcon className="h-5 w-5" /> :
                     <ChatBubbleLeftRightIcon className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-sm text-gray-500">{template.category.replace(/_/g, ' ')}</p>
                    {template.subject && <p className="text-sm text-gray-600 mt-1">Subject: {template.subject}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-sm text-gray-500">Used {template.usageCount}x</span>
                </div>
              </div>
            </div>
          ))}
          {(!templatesData?.data || templatesData.data.length === 0) && (
            <div className="p-8 text-center text-gray-500">No templates found</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
            Customer Relationship Management
          </h1>
          <p className="text-gray-500 mt-1">Manage leads, communications, and patient relationships</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'leads' && renderLeads()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'campaigns' && renderCampaigns()}
        {activeTab === 'surveys' && renderSurveys()}
        {activeTab === 'templates' && renderTemplates()}
      </div>

      {/* Lead Creation Modal */}
      {showLeadModal && (
        <LeadModal
          onClose={() => setShowLeadModal(false)}
          onSubmit={(data) => createLeadMutation.mutate(data)}
          isLoading={createLeadMutation.isPending}
        />
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={(status) => {
            updateStatusMutation.mutate({ id: selectedLead.id, status });
            setSelectedLead(null);
          }}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500 to-violet-600',
    blue: 'from-blue-500 to-indigo-600',
    indigo: 'from-indigo-500 to-purple-600',
    amber: 'from-amber-500 to-orange-600',
    green: 'from-green-500 to-emerald-600',
    teal: 'from-teal-500 to-cyan-600',
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <ArrowTrendingUpIcon className="h-5 w-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

// Lead Card Component (for Kanban)
function LeadCard({ lead, onDragStart, onClick }: { lead: Lead; onDragStart: (e: React.DragEvent) => void; onClick: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
          <p className="text-xs text-gray-500">{lead.leadNumber}</p>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[lead.priority] || 'bg-gray-100 text-gray-800'}`}>
          {lead.priority}
        </span>
      </div>

      <div className="space-y-1 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <PhoneIcon className="h-3 w-3" />
          {lead.phone}
        </div>
        <div className="flex items-center gap-1">
          <TagIcon className="h-3 w-3" />
          {sourceLabels[lead.source]}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <div className={`w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden`}>
            <div
              className={`h-full rounded-full ${
                lead.score >= 70 ? 'bg-green-500' :
                lead.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${lead.score}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500">{lead.score}</span>
        </div>
        {lead.assignedTo && (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-medium">
            {lead.assignedTo.firstName[0]}{lead.assignedTo.lastName[0]}
          </div>
        )}
      </div>
    </div>
  );
}

// Lead Modal Component
function LeadModal({ onClose, onSubmit, isLoading }: { onClose: () => void; onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: 'WEBSITE',
    priority: 'MEDIUM',
    interestedIn: [] as string[],
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">New Lead</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {Object.entries(sourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Lead Detail Modal Component
function LeadDetailModal({ lead, onClose, onStatusChange }: { lead: Lead; onClose: () => void; onStatusChange: (status: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{lead.firstName} {lead.lastName}</h3>
            <p className="text-sm text-gray-500">{lead.leadNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium text-gray-900">{lead.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{lead.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Source</p>
              <p className="font-medium text-gray-900">{sourceLabels[lead.source]}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Score</p>
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      lead.score >= 70 ? 'bg-green-500' :
                      lead.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${lead.score}%` }}
                  />
                </div>
                <span className="font-medium text-gray-900">{lead.score}</span>
              </div>
            </div>
          </div>

          {/* Status Actions */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Change Status</p>
            <div className="flex flex-wrap gap-2">
              {leadStatuses.map((statusConfig) => (
                <button
                  key={statusConfig.status}
                  onClick={() => onStatusChange(statusConfig.status)}
                  disabled={lead.status === statusConfig.status}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    lead.status === statusConfig.status
                      ? `${statusConfig.color} text-white`
                      : `${statusConfig.bgLight} text-gray-700 hover:bg-opacity-75`
                  }`}
                >
                  {statusConfig.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Summary */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{lead._count?.activities || 0}</p>
              <p className="text-sm text-gray-500">Activities</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{lead._count?.communications || 0}</p>
              <p className="text-sm text-gray-500">Communications</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{lead._count?.tasks || 0}</p>
              <p className="text-sm text-gray-500">Tasks</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
          <button
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all"
          >
            Convert to Patient
          </button>
        </div>
      </div>
    </div>
  );
}
