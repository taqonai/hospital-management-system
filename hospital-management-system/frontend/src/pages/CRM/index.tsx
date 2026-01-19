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
  PencilIcon,
  TrashIcon,
  UserCircleIcon,
  ArrowRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { crmApi } from '../../services/api';
import api from '../../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// Types
interface Lead {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  source: string;
  sourceDetails?: string;
  status: string;
  priority: string;
  score: number;
  interestedIn?: string[];
  preferredDoctor?: string;
  preferredDate?: string;
  notes?: string;
  assignedTo?: { id: string; firstName: string; lastName: string };
  assignedToId?: string;
  nextFollowUpAt?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt?: string;
  convertedToPatientId?: string;
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  _count?: { activities: number; communications: number; tasks: number };
}

interface Activity {
  id: string;
  activityType: string;
  title: string;
  description?: string;
  outcome?: string;
  activityDate: string;
  performedBy: { id: string; firstName: string; lastName: string };
}

interface Tag {
  id: string;
  name: string;
  color: string;
  category?: string;
  _count?: { leadTags: number };
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
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
  { status: 'NEW', label: 'New', color: 'bg-purple-500', bgLight: 'bg-purple-50', textColor: 'text-purple-700' },
  { status: 'CONTACTED', label: 'Contacted', color: 'bg-blue-500', bgLight: 'bg-blue-50', textColor: 'text-blue-700' },
  { status: 'QUALIFIED', label: 'Qualified', color: 'bg-amber-500', bgLight: 'bg-amber-50', textColor: 'text-amber-700' },
  { status: 'APPOINTMENT_SCHEDULED', label: 'Scheduled', color: 'bg-cyan-500', bgLight: 'bg-cyan-50', textColor: 'text-cyan-700' },
  { status: 'CONSULTATION_DONE', label: 'Consulted', color: 'bg-indigo-500', bgLight: 'bg-indigo-50', textColor: 'text-indigo-700' },
  { status: 'CONVERTED', label: 'Converted', color: 'bg-green-500', bgLight: 'bg-green-50', textColor: 'text-green-700' },
  { status: 'LOST', label: 'Lost', color: 'bg-gray-400', bgLight: 'bg-gray-50', textColor: 'text-gray-700' },
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

const activityIcons: Record<string, string> = {
  CALL_MADE: 'bg-blue-100 text-blue-600',
  CALL_RECEIVED: 'bg-green-100 text-green-600',
  EMAIL_SENT: 'bg-purple-100 text-purple-600',
  EMAIL_RECEIVED: 'bg-indigo-100 text-indigo-600',
  SMS_SENT: 'bg-cyan-100 text-cyan-600',
  WHATSAPP_SENT: 'bg-emerald-100 text-emerald-600',
  MEETING: 'bg-amber-100 text-amber-600',
  NOTE_ADDED: 'bg-gray-100 text-gray-600',
  STATUS_CHANGED: 'bg-violet-100 text-violet-600',
  TASK_COMPLETED: 'bg-green-100 text-green-600',
  APPOINTMENT_BOOKED: 'bg-teal-100 text-teal-600',
  FOLLOW_UP_SCHEDULED: 'bg-orange-100 text-orange-600',
};

export default function CRM() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [filters, setFilters] = useState({ source: '', priority: '', assignedToId: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);

  const queryClient = useQueryClient();

  // Fetch staff members for assignment
  const { data: staffData } = useQuery({
    queryKey: ['staff-members'],
    queryFn: async () => {
      const response = await api.get('/doctors');
      // Also get users with receptionist role
      const usersResponse = await api.get('/rbac/users');
      const staff = [
        ...(response.data?.data || response.data || []),
        ...(usersResponse.data?.data || usersResponse.data || []).filter(
          (u: any) => ['HOSPITAL_ADMIN', 'RECEPTIONIST'].includes(u.role)
        ),
      ];
      return staff;
    },
  });

  // Fetch tags
  const { data: tagsData, refetch: refetchTags } = useQuery({
    queryKey: ['crm-tags'],
    queryFn: () => crmApi.getTags(),
  });

  // Queries
  const { data: dashboardData, isLoading: loadingDashboard } = useQuery<{ data: DashboardStats }>({
    queryKey: ['crm-dashboard'],
    queryFn: () => crmApi.getDashboard(),
    enabled: activeTab === 'dashboard',
  });

  const { data: leadsData, isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['crm-leads', searchQuery, filters],
    queryFn: () => crmApi.getLeads({
      search: searchQuery,
      limit: 100,
      ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
    }),
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
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      crmApi.updateLeadStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      toast.success('Lead status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const createLeadMutation = useMutation({
    mutationFn: (data: any) => crmApi.createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      setShowLeadModal(false);
      setEditingLead(null);
      toast.success('Lead created successfully');
    },
    onError: () => toast.error('Failed to create lead'),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crmApi.updateLead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      setShowLeadModal(false);
      setEditingLead(null);
      setSelectedLead(null);
      toast.success('Lead updated successfully');
    },
    onError: () => toast.error('Failed to update lead'),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      setSelectedLead(null);
      toast.success('Lead deleted successfully');
    },
    onError: () => toast.error('Failed to delete lead'),
  });

  const assignLeadMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => crmApi.assignLead(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Lead assigned successfully');
    },
    onError: () => toast.error('Failed to assign lead'),
  });

  const convertLeadMutation = useMutation({
    mutationFn: ({ id, patientData }: { id: string; patientData: any }) => crmApi.convertLead(id, patientData),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      setSelectedLead(null);
      toast.success(`Lead converted to patient: ${response.data?.patient?.mrn || 'Success'}`);
    },
    onError: () => toast.error('Failed to convert lead'),
  });

  const createTagMutation = useMutation({
    mutationFn: (data: any) => crmApi.createTag(data),
    onSuccess: () => {
      refetchTags();
      setShowTagModal(false);
      toast.success('Tag created successfully');
    },
    onError: () => toast.error('Failed to create tag'),
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

  // Clear filters
  const clearFilters = () => {
    setFilters({ source: '', priority: '', assignedToId: '' });
    setSearchQuery('');
  };

  const hasActiveFilters = filters.source || filters.priority || filters.assignedToId || searchQuery;

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
              {(!stats?.bySource || stats.bySource.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No data available</p>
              )}
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
              {(!dashboardData?.data?.recentLeads || dashboardData.data.recentLeads.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No recent leads</p>
              )}
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
        <div className="flex flex-col gap-4">
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
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-xl transition-colors ${
                  hasActiveFilters ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FunnelIcon className="h-5 w-5" />
                Filters
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                )}
              </button>
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTagModal(true)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <TagIcon className="h-5 w-5" />
                Tags
              </button>
              <button
                onClick={() => {
                  setEditingLead(null);
                  setShowLeadModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25"
              >
                <PlusIcon className="h-5 w-5" />
                New Lead
              </button>
            </div>
          </div>

          {/* Filters Row */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <select
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="">All Sources</option>
                {Object.entries(sourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
              <select
                value={filters.assignedToId}
                onChange={(e) => setFilters({ ...filters, assignedToId: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="">All Assignees</option>
                {staffData?.map((staff: StaffMember) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName}
                  </option>
                ))}
              </select>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>
          )}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leadsData?.data?.map((lead: Lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => setSelectedLead(lead)}>
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
                        leadStatuses.find(s => s.status === lead.status)?.bgLight || 'bg-gray-100'
                      } ${leadStatuses.find(s => s.status === lead.status)?.textColor || 'text-gray-700'}`}>
                        {leadStatuses.find(s => s.status === lead.status)?.label || lead.status}
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
                      <select
                        value={lead.assignedToId || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            assignLeadMutation.mutate({ id: lead.id, userId: e.target.value });
                          }
                        }}
                        className="text-sm border-0 bg-transparent focus:ring-0 cursor-pointer text-gray-600"
                      >
                        <option value="">Unassigned</option>
                        {staffData?.map((staff: StaffMember) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.firstName} {staff.lastName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingLead(lead);
                            setShowLeadModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <EllipsisVerticalIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!leadsData?.data || leadsData.data.length === 0) && (
              <div className="p-8 text-center text-gray-500">No leads found</div>
            )}
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
                  <span className="text-gray-900">{campaign.campaignType?.replace(/_/g, ' ') || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Channel</span>
                  <span className="text-gray-900">{campaign.channel?.replace(/_/g, ' ') || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sent</span>
                  <span className="text-gray-900">{campaign.sentCount || 0} / {campaign.totalRecipients || 0}</span>
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
                  <span className="text-gray-900">{survey.surveyType?.replace(/_/g, ' ') || '-'}</span>
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
                    <p className="text-sm text-gray-500">{template.category?.replace(/_/g, ' ') || '-'}</p>
                    {template.subject && <p className="text-sm text-gray-600 mt-1">Subject: {template.subject}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-sm text-gray-500">Used {template.usageCount || 0}x</span>
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

      {/* Lead Creation/Edit Modal */}
      {showLeadModal && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => {
            setShowLeadModal(false);
            setEditingLead(null);
          }}
          onSubmit={(data) => {
            if (editingLead) {
              updateLeadMutation.mutate({ id: editingLead.id, data });
            } else {
              createLeadMutation.mutate(data);
            }
          }}
          isLoading={createLeadMutation.isPending || updateLeadMutation.isPending}
        />
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          staffList={staffData || []}
          tagsList={tagsData?.data || []}
          onClose={() => setSelectedLead(null)}
          onStatusChange={(status, reason) => {
            updateStatusMutation.mutate({ id: selectedLead.id, status, reason });
          }}
          onAssign={(userId) => {
            assignLeadMutation.mutate({ id: selectedLead.id, userId });
          }}
          onConvert={(patientData) => {
            convertLeadMutation.mutate({ id: selectedLead.id, patientData });
          }}
          onEdit={() => {
            setEditingLead(selectedLead);
            setSelectedLead(null);
            setShowLeadModal(true);
          }}
          onDelete={() => {
            if (confirm('Are you sure you want to delete this lead?')) {
              deleteLeadMutation.mutate(selectedLead.id);
            }
          }}
          isConverting={convertLeadMutation.isPending}
          isAssigning={assignLeadMutation.isPending}
        />
      )}

      {/* Tag Management Modal */}
      {showTagModal && (
        <TagModal
          tags={tagsData?.data || []}
          onClose={() => setShowTagModal(false)}
          onCreate={(data) => createTagMutation.mutate(data)}
          isCreating={createTagMutation.isPending}
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

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.tags.slice(0, 2).map(({ tag }) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 text-xs rounded"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {lead.tags.length > 2 && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
              +{lead.tags.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <div className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
        {lead.assignedTo ? (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-medium">
            {lead.assignedTo.firstName[0]}{lead.assignedTo.lastName[0]}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
            <UserCircleIcon className="h-4 w-4 text-gray-400" />
          </div>
        )}
      </div>
    </div>
  );
}

// Lead Form Modal Component (Create/Edit)
function LeadFormModal({
  lead,
  onClose,
  onSubmit,
  isLoading
}: {
  lead: Lead | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    firstName: lead?.firstName || '',
    lastName: lead?.lastName || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    alternatePhone: lead?.alternatePhone || '',
    dateOfBirth: lead?.dateOfBirth ? lead.dateOfBirth.split('T')[0] : '',
    gender: lead?.gender || '',
    address: lead?.address || '',
    city: lead?.city || '',
    state: lead?.state || '',
    zipCode: lead?.zipCode || '',
    source: lead?.source || 'WEBSITE',
    sourceDetails: lead?.sourceDetails || '',
    priority: lead?.priority || 'MEDIUM',
    interestedIn: lead?.interestedIn?.join(', ') || '',
    preferredDoctor: lead?.preferredDoctor || '',
    preferredDate: lead?.preferredDate ? lead.preferredDate.split('T')[0] : '',
    notes: lead?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      interestedIn: formData.interestedIn ? formData.interestedIn.split(',').map(s => s.trim()).filter(Boolean) : [],
      dateOfBirth: formData.dateOfBirth || null,
      preferredDate: formData.preferredDate || null,
    };
    onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{lead ? 'Edit Lead' : 'New Lead'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Basic Info */}
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

          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone</label>
              <input
                type="tel"
                value={formData.alternatePhone}
                onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <input
                type="text"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Lead Details */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Details</label>
            <input
              type="text"
              value={formData.sourceDetails}
              onChange={(e) => setFormData({ ...formData, sourceDetails: e.target.value })}
              placeholder="e.g., Referred by Dr. Smith, Campaign XYZ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interested In</label>
            <input
              type="text"
              value={formData.interestedIn}
              onChange={(e) => setFormData({ ...formData, interestedIn: e.target.value })}
              placeholder="e.g., Cardiology, General Checkup (comma separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Doctor</label>
              <input
                type="text"
                value={formData.preferredDoctor}
                onChange={(e) => setFormData({ ...formData, preferredDoctor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
              <input
                type="date"
                value={formData.preferredDate}
                onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
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
              {isLoading ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Lead Detail Modal Component
function LeadDetailModal({
  lead,
  staffList,
  tagsList,
  onClose,
  onStatusChange,
  onAssign,
  onConvert,
  onEdit,
  onDelete,
  isConverting,
  isAssigning,
}: {
  lead: Lead;
  staffList: StaffMember[];
  tagsList: Tag[];
  onClose: () => void;
  onStatusChange: (status: string, reason?: string) => void;
  onAssign: (userId: string) => void;
  onConvert: (patientData: any) => void;
  onEdit: () => void;
  onDelete: () => void;
  isConverting: boolean;
  isAssigning: boolean;
}) {
  const [activeSection, setActiveSection] = useState<'details' | 'timeline' | 'convert'>('details');
  const [lostReason, setLostReason] = useState('');
  const [showLostReasonInput, setShowLostReasonInput] = useState(false);

  // Fetch lead timeline
  const { data: timelineData, isLoading: loadingTimeline } = useQuery({
    queryKey: ['lead-timeline', lead.id],
    queryFn: () => crmApi.getLeadTimeline(lead.id),
    enabled: activeSection === 'timeline',
  });

  // Fetch full lead details
  const { data: leadDetails } = useQuery({
    queryKey: ['lead-details', lead.id],
    queryFn: () => crmApi.getLead(lead.id),
  });

  const fullLead = leadDetails?.data || lead;

  const handleStatusChange = (status: string) => {
    if (status === 'LOST') {
      setShowLostReasonInput(true);
    } else {
      onStatusChange(status);
    }
  };

  const handleLostConfirm = () => {
    onStatusChange('LOST', lostReason);
    setShowLostReasonInput(false);
    setLostReason('');
  };

  const handleConvert = () => {
    onConvert({
      conversionReason: 'Manual conversion from CRM',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-lg font-semibold">
              {fullLead.firstName[0]}{fullLead.lastName[0]}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{fullLead.firstName} {fullLead.lastName}</h3>
              <p className="text-sm text-gray-500">{fullLead.leadNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
              <PencilIcon className="h-5 w-5 text-gray-500" />
            </button>
            <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
              <TrashIcon className="h-5 w-5 text-red-500" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveSection('details')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeSection === 'details' ? 'text-purple-600 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveSection('timeline')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeSection === 'timeline' ? 'text-purple-600 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Activity Timeline
          </button>
          {fullLead.status !== 'CONVERTED' && (
            <button
              onClick={() => setActiveSection('convert')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeSection === 'convert' ? 'text-purple-600 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Convert to Patient
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'details' && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{fullLead.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{fullLead.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Source</p>
                  <p className="font-medium text-gray-900">{sourceLabels[fullLead.source]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Score</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          fullLead.score >= 70 ? 'bg-green-500' :
                          fullLead.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${fullLead.score}%` }}
                      />
                    </div>
                    <span className="font-medium text-gray-900">{fullLead.score}</span>
                  </div>
                </div>
              </div>

              {/* Assignment */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Assigned To</p>
                <select
                  value={fullLead.assignedToId || ''}
                  onChange={(e) => e.target.value && onAssign(e.target.value)}
                  disabled={isAssigning}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.firstName} {staff.lastName} ({staff.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Actions */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Change Status</p>
                {showLostReasonInput ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      placeholder="Enter reason for lost lead..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleLostConfirm}
                        className="px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-lg"
                      >
                        Confirm Lost
                      </button>
                      <button
                        onClick={() => setShowLostReasonInput(false)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {leadStatuses.map((statusConfig) => (
                      <button
                        key={statusConfig.status}
                        onClick={() => handleStatusChange(statusConfig.status)}
                        disabled={fullLead.status === statusConfig.status}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          fullLead.status === statusConfig.status
                            ? `${statusConfig.color} text-white`
                            : `${statusConfig.bgLight} ${statusConfig.textColor} hover:bg-opacity-75`
                        }`}
                      >
                        {statusConfig.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {fullLead.tags?.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="px-2 py-1 text-sm rounded-lg"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {(!fullLead.tags || fullLead.tags.length === 0) && (
                    <span className="text-sm text-gray-400">No tags assigned</span>
                  )}
                </div>
              </div>

              {/* Notes */}
              {fullLead.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{fullLead.notes}</p>
                </div>
              )}

              {/* Activity Summary */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{fullLead._count?.activities || 0}</p>
                  <p className="text-sm text-gray-500">Activities</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{fullLead._count?.communications || 0}</p>
                  <p className="text-sm text-gray-500">Communications</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{fullLead._count?.tasks || 0}</p>
                  <p className="text-sm text-gray-500">Tasks</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'timeline' && (
            <div className="space-y-4">
              {loadingTimeline ? (
                <div className="flex justify-center py-8">
                  <ArrowPathIcon className="h-6 w-6 animate-spin text-purple-500" />
                </div>
              ) : (
                <>
                  {timelineData?.data?.map((activity: Activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activityIcons[activity.activityType] || 'bg-gray-100 text-gray-600'
                      }`}>
                        <ClockIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>{activity.performedBy?.firstName} {activity.performedBy?.lastName}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(activity.activityDate), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!timelineData?.data || timelineData.data.length === 0) && (
                    <p className="text-center text-gray-500 py-8">No activity recorded yet</p>
                  )}
                </>
              )}
            </div>
          )}

          {activeSection === 'convert' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-medium text-green-900 mb-2">Convert Lead to Patient</h4>
                <p className="text-sm text-green-700">
                  This will create a new patient record with the lead's information and mark the lead as converted.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">Lead Information to Transfer:</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name:</span>
                    <span className="text-gray-900">{fullLead.firstName} {fullLead.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone:</span>
                    <span className="text-gray-900">{fullLead.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="text-gray-900">{fullLead.email || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gender:</span>
                    <span className="text-gray-900">{fullLead.gender || '-'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConvert}
                disabled={isConverting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50"
              >
                {isConverting ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <ArrowRightIcon className="h-5 w-5" />
                    Convert to Patient
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Tag Modal Component
function TagModal({
  tags,
  onClose,
  onCreate,
  isCreating,
}: {
  tags: Tag[];
  onClose: () => void;
  onCreate: (data: any) => void;
  isCreating: boolean;
}) {
  const [newTag, setNewTag] = useState({ name: '', color: '#6366f1', category: '' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.name.trim()) {
      onCreate(newTag);
      setNewTag({ name: '', color: '#6366f1', category: '' });
    }
  };

  const colorOptions = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Manage Tags</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Create New Tag */}
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag Name</label>
              <input
                type="text"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                placeholder="e.g., VIP, Corporate"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTag({ ...newTag, color })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newTag.color === color ? 'border-gray-900' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={isCreating || !newTag.name.trim()}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 transition-all disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Tag'}
            </button>
          </form>

          {/* Existing Tags */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Existing Tags</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-3 py-1 text-sm rounded-lg flex items-center gap-2"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.name}
                  <span className="text-xs opacity-70">({tag._count?.leadTags || 0})</span>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-gray-400">No tags created yet</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
