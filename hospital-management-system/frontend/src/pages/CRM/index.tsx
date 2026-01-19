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
  UserIcon,
  CalendarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  TagIcon,
  PlayIcon,
  PauseIcon,
  ChartPieIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PencilIcon,
  TrashIcon,
  UserCircleIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  PaperAirplaneIcon,
  EyeIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
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
    scheduledLeads: number;
    convertedLeads: number;
    lostLeads: number;
    conversionRate: string;
    newThisMonth: number;
    bySource: Array<{ source: string; _count: { source: number } }>;
  };
  taskStats: {
    openTasks: number;
    overdueTasks: number;
    completedToday: number;
    completedTasks: number;
  };
  communicationStats: {
    totalCount: number;
    todayCount: number;
    emailCount: number;
    phoneCount: number;
    whatsappCount: number;
    smsCount: number;
  };
  surveyStats: {
    avgNPS: number;
    promoters: number;
    passives: number;
    detractors: number;
  };
  overdueTasks: any[];
  recentLeads: Lead[];
}

// Tab configuration
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
  { id: 'leads', label: 'Leads', icon: UserPlusIcon },
  { id: 'communications', label: 'Communications', icon: ChatBubbleOvalLeftEllipsisIcon },
  { id: 'tasks', label: 'Tasks', icon: ClipboardDocumentListIcon },
  { id: 'campaigns', label: 'Campaigns', icon: MegaphoneIcon },
  { id: 'surveys', label: 'Surveys', icon: ChatBubbleLeftRightIcon },
  { id: 'templates', label: 'Templates', icon: DocumentDuplicateIcon },
  { id: 'reports', label: 'Reports', icon: DocumentTextIcon },
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
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<any>(null);
  // Phase 4: Task & Campaign state
  const [taskFilter, setTaskFilter] = useState<'all' | 'my' | 'overdue' | 'today'>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [showCampaignDetailModal, setShowCampaignDetailModal] = useState(false);
  // Phase 5: Survey & Analytics state
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [showSurveyDetailModal, setShowSurveyDetailModal] = useState(false);

  const queryClient = useQueryClient();

  // Fetch staff members for assignment (all non-patient users)
  const { data: staffData } = useQuery({
    queryKey: ['staff-members'],
    queryFn: async () => {
      const usersResponse = await api.get('/rbac/users');
      // The API returns { success: true, data: [...users] }
      const users = usersResponse.data?.data || usersResponse.data || [];
      return users;
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

  const { data: tasksData, isLoading: loadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['crm-tasks', taskFilter],
    queryFn: () => {
      if (taskFilter === 'my') return crmApi.getMyTasks();
      if (taskFilter === 'overdue') return crmApi.getOverdueTasks();
      return crmApi.getTasks({ limit: 50 });
    },
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

  // Phase 5: Survey responses query
  const { data: surveyResponsesData, isLoading: loadingSurveyResponses } = useQuery({
    queryKey: ['crm-survey-responses', selectedSurvey?.id],
    queryFn: () => crmApi.getSurveyResponses(selectedSurvey.id),
    enabled: !!selectedSurvey?.id && showSurveyDetailModal,
  });

  // Phase 5: Lead conversion report query
  const { data: conversionReportData } = useQuery({
    queryKey: ['crm-conversion-report'],
    queryFn: () => crmApi.getLeadConversionReport(),
    enabled: activeTab === 'dashboard',
  });

  const { data: templatesData, isLoading: loadingTemplates, refetch: refetchTemplates } = useQuery({
    queryKey: ['crm-templates'],
    queryFn: () => crmApi.getTemplates(),
    enabled: activeTab === 'templates' || showCommunicationModal,
  });

  const { data: communicationsData, isLoading: loadingCommunications } = useQuery({
    queryKey: ['crm-communications'],
    queryFn: () => crmApi.getCommunications({ limit: 50 }),
    enabled: activeTab === 'communications',
  });

  const { data: commStatsData } = useQuery({
    queryKey: ['crm-communication-stats'],
    queryFn: () => crmApi.getCommunicationStats(),
    enabled: activeTab === 'communications',
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

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => crmApi.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] });
      setShowTaskModal(false);
      toast.success('Task created successfully');
    },
    onError: () => toast.error('Failed to create task'),
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => crmApi.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
      setShowCampaignModal(false);
      toast.success('Campaign created successfully');
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  // Phase 4: Task status update mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ id, status, outcome }: { id: string; status: string; outcome?: string }) =>
      crmApi.updateTaskStatus(id, status, outcome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      toast.success('Task status updated');
    },
    onError: () => toast.error('Failed to update task status'),
  });

  // Phase 4: Campaign launch mutation
  const launchCampaignMutation = useMutation({
    mutationFn: (id: string) => crmApi.launchCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      setShowCampaignDetailModal(false);
      toast.success('Campaign launched successfully');
    },
    onError: () => toast.error('Failed to launch campaign'),
  });

  // Phase 4: Campaign pause mutation
  const pauseCampaignMutation = useMutation({
    mutationFn: (id: string) => crmApi.pauseCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
      setShowCampaignDetailModal(false);
      toast.success('Campaign paused');
    },
    onError: () => toast.error('Failed to pause campaign'),
  });

  const createSurveyMutation = useMutation({
    mutationFn: (data: any) => crmApi.createSurvey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-surveys'] });
      setShowSurveyModal(false);
      toast.success('Survey created successfully');
    },
    onError: () => toast.error('Failed to create survey'),
  });

  const logCommunicationMutation = useMutation({
    mutationFn: (data: any) => crmApi.logCommunication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-communications'] });
      queryClient.invalidateQueries({ queryKey: ['crm-communication-stats'] });
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      setShowCommunicationModal(false);
      toast.success('Communication logged successfully');
    },
    onError: () => toast.error('Failed to log communication'),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => crmApi.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-templates'] });
      setShowTemplateModal(false);
      setEditingTemplate(null);
      toast.success('Template created successfully');
    },
    onError: () => toast.error('Failed to create template'),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crmApi.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-templates'] });
      setShowTemplateModal(false);
      setEditingTemplate(null);
      toast.success('Template updated successfully');
    },
    onError: () => toast.error('Failed to update template'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: () => toast.error('Failed to delete template'),
  });

  // Group leads by status for Kanban
  const leads = leadsData?.data?.data || [];
  const leadsByStatus = useMemo(() => {
    if (!leads || leads.length === 0) return {};
    const grouped: Record<string, Lead[]> = {};
    leadStatuses.forEach((s) => {
      grouped[s.status] = leads.filter((lead: Lead) => lead.status === s.status);
    });
    return grouped;
  }, [leads]);

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
    const taskStats = dashboardData?.data?.taskStats;
    const commStats = dashboardData?.data?.communicationStats;
    const surveyStats = dashboardData?.data?.surveyStats;

    // Calculate pipeline funnel percentages
    const totalLeads = stats?.totalLeads || 0;
    const pipelineStages = [
      { label: 'New', count: stats?.newLeads || 0, color: 'purple' },
      { label: 'Contacted', count: stats?.contactedLeads || 0, color: 'blue' },
      { label: 'Qualified', count: stats?.qualifiedLeads || 0, color: 'amber' },
      { label: 'Scheduled', count: stats?.scheduledLeads || 0, color: 'cyan' },
      { label: 'Converted', count: stats?.convertedLeads || 0, color: 'green' },
    ];

    // NPS calculation helper
    const getNPSCategory = (score: number) => {
      if (score >= 50) return { label: 'Excellent', color: 'text-green-600' };
      if (score >= 0) return { label: 'Good', color: 'text-blue-600' };
      if (score >= -50) return { label: 'Needs Improvement', color: 'text-amber-600' };
      return { label: 'Critical', color: 'text-red-600' };
    };

    const npsScore = surveyStats?.avgNPS || 0;
    const npsCategory = getNPSCategory(npsScore);

    return (
      <div className="space-y-6">
        {/* Top Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Total Leads" value={stats?.totalLeads || 0} color="purple" />
          <StatCard label="This Month" value={stats?.newThisMonth || 0} color="blue" />
          <StatCard label="Converted" value={stats?.convertedLeads || 0} color="green" />
          <StatCard label="Conversion Rate" value={`${stats?.conversionRate || 0}%`} color="teal" />
          <StatCard label="Open Tasks" value={taskStats?.openTasks || 0} color="amber" />
          <StatCard label="Avg NPS" value={npsScore} color="indigo" />
        </div>

        {/* Pipeline Funnel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Pipeline Funnel</h3>
          <div className="space-y-3">
            {pipelineStages.map((stage, index) => {
              const percentage = totalLeads > 0 ? Math.round((stage.count / totalLeads) * 100) : 0;
              const widthPercent = totalLeads > 0 ? Math.max(20, 100 - (index * 15)) : 100;
              const colorClasses: Record<string, string> = {
                purple: 'from-purple-500 to-violet-500',
                blue: 'from-blue-500 to-indigo-500',
                amber: 'from-amber-500 to-orange-500',
                cyan: 'from-cyan-500 to-teal-500',
                green: 'from-green-500 to-emerald-500',
              };

              return (
                <div key={stage.label} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-gray-600">{stage.label}</span>
                  <div className="flex-1 flex items-center justify-center">
                    <div
                      className={`h-10 bg-gradient-to-r ${colorClasses[stage.color]} rounded-lg flex items-center justify-center transition-all`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      <span className="text-white font-semibold text-sm">
                        {stage.count} ({percentage}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead Sources */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads by Source</h3>
            <div className="space-y-3">
              {stats?.bySource?.slice(0, 6).map((item: any) => {
                const percentage = totalLeads > 0 ? Math.round((item._count.source / totalLeads) * 100) : 0;
                return (
                  <div key={item.source} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 truncate flex-1">{sourceLabels[item.source] || item.source}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">{item._count.source}</span>
                    </div>
                  </div>
                );
              })}
              {(!stats?.bySource || stats.bySource.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No data available</p>
              )}
            </div>
          </div>

          {/* NPS Score Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Net Promoter Score</h3>
            <div className="text-center py-4">
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke={npsScore >= 50 ? '#10b981' : npsScore >= 0 ? '#3b82f6' : npsScore >= -50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(0, (npsScore + 100) / 200 * 352)} 352`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${npsCategory.color}`}>{npsScore}</span>
                </div>
              </div>
              <p className={`text-lg font-semibold ${npsCategory.color}`}>{npsCategory.label}</p>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="font-bold text-green-700">{surveyStats?.promoters || 0}</p>
                  <p className="text-green-600">Promoters</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="font-bold text-gray-700">{surveyStats?.passives || 0}</p>
                  <p className="text-gray-600">Passives</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="font-bold text-red-700">{surveyStats?.detractors || 0}</p>
                  <p className="text-red-600">Detractors</p>
                </div>
              </div>
            </div>
          </div>

          {/* Task & Communication Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Overview</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-700">Open Tasks</span>
                </div>
                <span className="font-bold text-blue-600">{taskStats?.openTasks || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-gray-700">Overdue Tasks</span>
                </div>
                <span className="font-bold text-red-600">{taskStats?.overdueTasks || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckIcon className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Completed Today</span>
                </div>
                <span className="font-bold text-green-600">{taskStats?.completedToday || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-purple-600" />
                  <span className="text-sm text-gray-700">Communications Today</span>
                </div>
                <span className="font-bold text-purple-600">{commStats?.todayCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Leads & Overdue Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Leads</h3>
            <div className="space-y-3">
              {dashboardData?.data?.recentLeads?.slice(0, 5).map((lead: any) => (
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

          {/* Overdue Tasks */}
          <div className={`rounded-2xl border p-6 ${
            dashboardData?.data?.overdueTasks?.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className={`h-5 w-5 ${dashboardData?.data?.overdueTasks?.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              <h3 className={`text-lg font-semibold ${dashboardData?.data?.overdueTasks?.length > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                Overdue Tasks
              </h3>
            </div>
            {dashboardData?.data?.overdueTasks && dashboardData.data.overdueTasks.length > 0 ? (
              <div className="space-y-2">
                {dashboardData.data.overdueTasks.slice(0, 5).map((task: any) => (
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
            ) : (
              <div className="text-center py-8">
                <CheckIcon className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-600">All caught up! No overdue tasks.</p>
              </div>
            )}
          </div>
        </div>
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
                {leads.map((lead: Lead) => (
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
            {(!leads || leads.length === 0) && (
              <div className="p-8 text-center text-gray-500">No leads found</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Communications Tab
  const renderCommunications = () => {
    if (loadingCommunications) {
      return <div className="flex justify-center py-12"><ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" /></div>;
    }

    const communications = communicationsData?.data?.data || [];
    const stats = commStatsData?.data?.data || commStatsData?.data || {};

    const channelIcons: Record<string, any> = {
      PHONE_CALL: PhoneIcon,
      EMAIL: EnvelopeIcon,
      SMS: ChatBubbleLeftRightIcon,
      WHATSAPP: ChatBubbleLeftRightIcon,
      IN_PERSON: UserGroupIcon,
      VIDEO_CALL: UserGroupIcon,
    };

    const channelColors: Record<string, string> = {
      PHONE_CALL: 'bg-blue-100 text-blue-600',
      EMAIL: 'bg-purple-100 text-purple-600',
      SMS: 'bg-green-100 text-green-600',
      WHATSAPP: 'bg-emerald-100 text-emerald-600',
      IN_PERSON: 'bg-amber-100 text-amber-600',
      VIDEO_CALL: 'bg-cyan-100 text-cyan-600',
    };

    const statusColors: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-700',
      SENT: 'bg-blue-100 text-blue-700',
      DELIVERED: 'bg-green-100 text-green-700',
      READ: 'bg-purple-100 text-purple-700',
      RESPONDED: 'bg-emerald-100 text-emerald-700',
      FAILED: 'bg-red-100 text-red-700',
    };

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <PhoneIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.byChannel?.PHONE_CALL || 0}</p>
                <p className="text-sm text-gray-500">Calls</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <EnvelopeIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.byChannel?.EMAIL || 0}</p>
                <p className="text-sm text-gray-500">Emails</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{(stats.byChannel?.SMS || 0) + (stats.byChannel?.WHATSAPP || 0)}</p>
                <p className="text-sm text-gray-500">Messages</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Recent Communications</h3>
          <button
            onClick={() => setShowCommunicationModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25"
          >
            <PlusIcon className="h-5 w-5" />
            Log Communication
          </button>
        </div>

        {/* Communications List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {communications.map((comm: any) => {
            const ChannelIcon = channelIcons[comm.channel] || ChatBubbleLeftRightIcon;
            return (
              <div key={comm.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${channelColors[comm.channel] || 'bg-gray-100 text-gray-600'}`}>
                    <ChannelIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {comm.lead ? `${comm.lead.firstName} ${comm.lead.lastName}` :
                           comm.patient ? `${comm.patient.firstName} ${comm.patient.lastName}` : 'Unknown'}
                        </p>
                        {comm.subject && <p className="text-sm text-gray-600 mt-0.5">{comm.subject}</p>}
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{comm.content}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[comm.status] || 'bg-gray-100 text-gray-700'}`}>
                          {comm.status}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${comm.direction === 'OUTBOUND' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                          {comm.direction === 'OUTBOUND' ? '↑ Out' : '↓ In'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{comm.channel?.replace(/_/g, ' ')}</span>
                      <span>•</span>
                      <span>{format(new Date(comm.createdAt), 'MMM d, yyyy h:mm a')}</span>
                      {comm.initiatedBy && (
                        <>
                          <span>•</span>
                          <span>By {comm.initiatedBy.firstName} {comm.initiatedBy.lastName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {communications.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No communications logged yet. Click "Log Communication" to add one.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Tasks Tab
  const renderTasks = () => {
    const tasks = tasksData?.data?.data || [];

    // Filter tasks for "today" view
    const filteredTasks = taskFilter === 'today'
      ? tasks.filter((task: any) => {
          const dueDate = new Date(task.dueDate);
          const today = new Date();
          return dueDate.toDateString() === today.toDateString();
        })
      : tasks;

    const taskFilters = [
      { id: 'all', label: 'All Tasks', count: tasks.length },
      { id: 'my', label: 'My Tasks', count: null },
      { id: 'overdue', label: 'Overdue', count: null },
      { id: 'today', label: 'Due Today', count: null },
    ];

    const getTaskStatusActions = (task: any) => {
      if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return null;

      return (
        <div className="flex items-center gap-1">
          {task.status === 'PENDING' && (
            <button
              onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: 'IN_PROGRESS' })}
              className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              disabled={updateTaskStatusMutation.isPending}
            >
              Start
            </button>
          )}
          {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
            <>
              <button
                onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: 'COMPLETED' })}
                className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                disabled={updateTaskStatusMutation.isPending}
              >
                Complete
              </button>
              <button
                onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: 'CANCELLED' })}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                disabled={updateTaskStatusMutation.isPending}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        {/* Header with filter tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            {taskFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setTaskFilter(filter.id as any)}
                className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
                  taskFilter === filter.id
                    ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
                }`}
              >
                {filter.label}
                {filter.count !== null && (
                  <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                    taskFilter === filter.id ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowTaskModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25"
          >
            <PlusIcon className="h-5 w-5" />
            New Task
          </button>
        </div>

        {loadingTasks ? (
          <div className="flex justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            {filteredTasks.map((task: any) => {
              const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';

              return (
                <div key={task.id} className={`p-4 hover:bg-gray-50 ${isOverdue ? 'bg-red-50/50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                        task.status === 'COMPLETED' ? 'bg-green-500' :
                        task.status === 'CANCELLED' ? 'bg-gray-400' :
                        isOverdue ? 'bg-red-500' :
                        task.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${task.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {task.title}
                          </p>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            task.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' :
                            isOverdue ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {isOverdue && task.status === 'PENDING' ? 'OVERDUE' : task.status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-1 truncate">{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 mt-2">
                          <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            <CalendarIcon className="h-4 w-4" />
                            Due {format(new Date(task.dueDate), 'MMM d, yyyy h:mm a')}
                          </span>
                          {task.lead && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <UserGroupIcon className="h-4 w-4" />
                              {task.lead.firstName} {task.lead.lastName}
                            </span>
                          )}
                          {task.assignedTo && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <UserIcon className="h-4 w-4" />
                              {task.assignedTo.firstName} {task.assignedTo.lastName}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[task.priority] || 'bg-gray-100 text-gray-800'}`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {getTaskStatusActions(task)}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredTasks.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                {taskFilter === 'my' ? 'No tasks assigned to you' :
                 taskFilter === 'overdue' ? 'No overdue tasks' :
                 taskFilter === 'today' ? 'No tasks due today' :
                 'No tasks found'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Campaigns Tab
  const renderCampaigns = () => {
    if (loadingCampaigns) {
      return <div className="flex justify-center py-12"><ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" /></div>;
    }

    const campaigns = campaignsData?.data?.data || [];
    const activeCampaigns = campaigns.filter((c: any) => c.status === 'RUNNING').length;
    const draftCampaigns = campaigns.filter((c: any) => c.status === 'DRAFT').length;
    const completedCampaigns = campaigns.filter((c: any) => c.status === 'COMPLETED').length;

    const handleCampaignClick = (campaign: any) => {
      setSelectedCampaign(campaign);
      setShowCampaignDetailModal(true);
    };

    return (
      <div className="space-y-6">
        {/* Campaign Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <MegaphoneIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
                <p className="text-xs text-gray-500">Total Campaigns</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <PlayIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{activeCampaigns}</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <PencilIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{draftCampaigns}</p>
                <p className="text-xs text-gray-500">Drafts</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <CheckIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{completedCampaigns}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Campaigns</h3>
          <button
            onClick={() => setShowCampaignModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25"
          >
            <PlusIcon className="h-5 w-5" />
            New Campaign
          </button>
        </div>

        {/* Campaign Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign: any) => {
            const progressPercent = campaign.totalRecipients > 0
              ? Math.round((campaign.sentCount || 0) / campaign.totalRecipients * 100)
              : 0;

            return (
              <div
                key={campaign.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleCampaignClick(campaign)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">{campaign.name}</h4>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                      campaign.status === 'RUNNING' ? 'bg-green-100 text-green-700' :
                      campaign.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' :
                      campaign.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                      campaign.status === 'COMPLETED' ? 'bg-purple-100 text-purple-700' :
                      campaign.status === 'PAUSED' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <MegaphoneIcon className="h-8 w-8 text-purple-200" />
                </div>

                {campaign.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{campaign.description}</p>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="text-gray-900">{campaign.campaignType?.replace(/_/g, ' ') || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Channel</span>
                    <span className="text-gray-900">{campaign.channel?.replace(/_/g, ' ') || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Progress</span>
                    <span className="text-gray-900">{campaign.sentCount || 0} / {campaign.totalRecipients || 0}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                {campaign.totalRecipients > 0 && (
                  <div className="mt-3">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          campaign.status === 'COMPLETED' ? 'bg-green-500' :
                          campaign.status === 'RUNNING' ? 'bg-blue-500' :
                          'bg-gray-400'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{progressPercent}% sent</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                  {campaign.status === 'DRAFT' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        launchCampaignMutation.mutate(campaign.id);
                      }}
                      disabled={launchCampaignMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <PlayIcon className="h-4 w-4" />
                      Launch
                    </button>
                  )}
                  {campaign.status === 'RUNNING' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pauseCampaignMutation.mutate(campaign.id);
                      }}
                      disabled={pauseCampaignMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <PauseIcon className="h-4 w-4" />
                      Pause
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCampaignClick(campaign);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <ChartPieIcon className="h-4 w-4" />
                    Details
                  </button>
                </div>
              </div>
            );
          })}
          {campaigns.length === 0 && (
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

    const surveys = surveysData?.data?.data || [];
    const activeSurveys = surveys.filter((s: any) => s.isActive).length;
    const totalResponses = surveys.reduce((sum: number, s: any) => sum + (s._count?.responses || s.responseCount || 0), 0);
    const avgRating = surveys.length > 0
      ? surveys.reduce((sum: number, s: any) => sum + (Number(s.avgRating) || 0), 0) / surveys.filter((s: any) => s.avgRating).length
      : 0;

    const surveyTypeLabels: Record<string, string> = {
      POST_VISIT: 'Post Visit',
      POST_DISCHARGE: 'Post Discharge',
      NPS: 'Net Promoter Score',
      CSAT: 'Customer Satisfaction',
      SERVICE_QUALITY: 'Service Quality',
      DOCTOR_FEEDBACK: 'Doctor Feedback',
      CUSTOM: 'Custom',
    };

    const handleSurveyClick = (survey: any) => {
      setSelectedSurvey(survey);
      setShowSurveyDetailModal(true);
    };

    return (
      <div className="space-y-6">
        {/* Survey Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{surveys.length}</p>
                <p className="text-xs text-gray-500">Total Surveys</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{activeSurveys}</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <UserGroupIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalResponses}</p>
                <p className="text-xs text-gray-500">Responses</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <ArrowTrendingUpIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{avgRating ? avgRating.toFixed(1) : '-'}</p>
                <p className="text-xs text-gray-500">Avg Rating</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Surveys</h3>
          <button
            onClick={() => setShowSurveyModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25"
          >
            <PlusIcon className="h-5 w-5" />
            New Survey
          </button>
        </div>

        {/* Survey Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey: any) => {
            const responseCount = survey._count?.responses || survey.responseCount || 0;
            const rating = survey.avgRating ? Number(survey.avgRating) : null;
            const npsScore = survey.avgNPS ? Number(survey.avgNPS) : null;

            return (
              <div
                key={survey.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSurveyClick(survey)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">{survey.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        survey.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {survey.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                        {surveyTypeLabels[survey.surveyType] || survey.surveyType}
                      </span>
                    </div>
                  </div>
                  <ChatBubbleLeftRightIcon className="h-8 w-8 text-purple-200" />
                </div>

                {survey.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{survey.description}</p>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Responses</span>
                    <span className="font-medium text-gray-900">{responseCount}</span>
                  </div>
                  {rating !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Avg Rating</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-900">{rating.toFixed(1)}</span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-sm ${star <= Math.round(rating) ? 'text-amber-400' : 'text-gray-300'}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {npsScore !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">NPS Score</span>
                      <span className={`font-medium ${
                        npsScore >= 50 ? 'text-green-600' :
                        npsScore >= 0 ? 'text-blue-600' :
                        npsScore >= -50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {npsScore}
                      </span>
                    </div>
                  )}
                </div>

                {/* View Responses Button */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSurveyClick(survey);
                    }}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <EyeIcon className="h-4 w-4" />
                    View Responses
                  </button>
                </div>
              </div>
            );
          })}
          {surveys.length === 0 && (
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

    const templates = templatesData?.data?.data || [];

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Message Templates</h3>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowTemplateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg shadow-purple-500/25"
          >
            <PlusIcon className="h-5 w-5" />
            New Template
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {templates.map((template: any) => (
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
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-sm text-gray-500">{template.category?.replace(/_/g, ' ') || '-'}</p>
                    {template.subject && <p className="text-sm text-gray-600 mt-1">Subject: {template.subject}</p>}
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{template.content}</p>
                    {template.variables?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.variables.map((v: string) => (
                          <span key={v} className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 rounded">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-sm text-gray-500">Used {template.usageCount || 0}x</span>
                  <button
                    onClick={() => setPreviewingTemplate(template)}
                    className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Preview"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowTemplateModal(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this template?')) {
                        deleteTemplateMutation.mutate(template.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No templates found. Create your first template to get started.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Reports Tab
  const renderReports = () => {
    const stats = dashboardData?.data?.leadStats;
    const taskStats = dashboardData?.data?.taskStats;
    const commStats = dashboardData?.data?.communicationStats;
    const conversionData = conversionReportData?.data?.data;

    // Sample data for reports - in production, this would come from API
    const reportTypes = [
      {
        id: 'lead-conversion',
        name: 'Lead Conversion Report',
        description: 'Track conversion rates across lead sources and time periods',
        icon: ArrowTrendingUpIcon,
        color: 'purple',
      },
      {
        id: 'communication-metrics',
        name: 'Communication Metrics',
        description: 'Analyze communication effectiveness by channel and template',
        icon: ChatBubbleOvalLeftEllipsisIcon,
        color: 'blue',
      },
      {
        id: 'staff-performance',
        name: 'Staff Performance',
        description: 'Measure staff productivity in lead handling and task completion',
        icon: UserGroupIcon,
        color: 'green',
      },
      {
        id: 'roi-analysis',
        name: 'ROI by Source',
        description: 'Calculate return on investment for each lead acquisition channel',
        icon: ChartPieIcon,
        color: 'amber',
      },
      {
        id: 'survey-insights',
        name: 'Survey Insights',
        description: 'Patient satisfaction trends and NPS analysis over time',
        icon: ChatBubbleLeftRightIcon,
        color: 'teal',
      },
      {
        id: 'campaign-performance',
        name: 'Campaign Performance',
        description: 'Detailed analysis of marketing campaign effectiveness',
        icon: MegaphoneIcon,
        color: 'indigo',
      },
    ];

    const colorClasses: Record<string, { bg: string; text: string; gradient: string }> = {
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', gradient: 'from-purple-500 to-violet-600' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', gradient: 'from-blue-500 to-indigo-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600', gradient: 'from-green-500 to-emerald-600' },
      amber: { bg: 'bg-amber-100', text: 'text-amber-600', gradient: 'from-amber-500 to-orange-600' },
      teal: { bg: 'bg-teal-100', text: 'text-teal-600', gradient: 'from-teal-500 to-cyan-600' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', gradient: 'from-indigo-500 to-purple-600' },
    };

    // Mock monthly data for the conversion chart
    const monthlyData = conversionData?.monthlyTrends || [
      { month: 'Jul', leads: 45, converted: 12 },
      { month: 'Aug', leads: 52, converted: 15 },
      { month: 'Sep', leads: 48, converted: 18 },
      { month: 'Oct', leads: 61, converted: 22 },
      { month: 'Nov', leads: 55, converted: 19 },
      { month: 'Dec', leads: 67, converted: 28 },
    ];
    const maxLeads = Math.max(...monthlyData.map((d: any) => d.leads), 1);

    return (
      <div className="space-y-6">
        {/* Reports Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <UserPlusIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalLeads || 0}</p>
                <p className="text-xs text-gray-500">Total Leads</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.conversionRate || 0}%</p>
                <p className="text-xs text-gray-500">Conversion Rate</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{commStats?.totalCount || 0}</p>
                <p className="text-xs text-gray-500">Communications</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <ClipboardDocumentListIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{taskStats?.completedTasks || 0}</p>
                <p className="text-xs text-gray-500">Tasks Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Trend Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Lead Conversion Trend</h3>
              <p className="text-sm text-gray-500">Monthly leads vs conversions</p>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="h-64">
            <div className="flex items-end justify-between h-full gap-4">
              {monthlyData.map((data: any, index: number) => {
                const leadHeight = (data.leads / maxLeads) * 100;
                const convertedHeight = (data.converted / maxLeads) * 100;
                return (
                  <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full h-48 flex items-end justify-center gap-1">
                      <div
                        className="w-6 bg-gradient-to-t from-purple-300 to-purple-400 rounded-t-lg transition-all"
                        style={{ height: `${leadHeight}%` }}
                        title={`Leads: ${data.leads}`}
                      />
                      <div
                        className="w-6 bg-gradient-to-t from-green-400 to-green-500 rounded-t-lg transition-all"
                        style={{ height: `${convertedHeight}%` }}
                        title={`Converted: ${data.converted}`}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{data.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-purple-400" />
              <span className="text-sm text-gray-600">Leads</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-sm text-gray-600">Converted</span>
            </div>
          </div>
        </div>

        {/* Source Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Source Performance</h3>
            <div className="space-y-3">
              {stats?.bySource?.slice(0, 6).map((item: any) => {
                const total = stats?.totalLeads || 1;
                const percentage = Math.round((item._count.source / total) * 100);
                const sourceLabel = sourceLabels[item.source] || item.source;
                return (
                  <div key={item.source} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex-1 truncate">{sourceLabel}</span>
                    <div className="flex items-center gap-3 ml-2">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-12 text-right">{item._count.source}</span>
                      <span className="text-xs text-gray-500 w-10 text-right">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
              {(!stats?.bySource || stats.bySource.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No source data available</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Communication Channels</h3>
            <div className="space-y-3">
              {[
                { channel: 'Email', count: commStats?.emailCount || 0, color: 'blue' },
                { channel: 'Phone', count: commStats?.phoneCount || 0, color: 'green' },
                { channel: 'WhatsApp', count: commStats?.whatsappCount || 0, color: 'emerald' },
                { channel: 'SMS', count: commStats?.smsCount || 0, color: 'purple' },
              ].map((item) => {
                const total = commStats?.totalCount || 1;
                const percentage = Math.round((item.count / total) * 100);
                return (
                  <div key={item.channel} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex-1">{item.channel}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-${item.color}-500 rounded-full`}
                          style={{ width: `${percentage || 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-12 text-right">{item.count}</span>
                      <span className="text-xs text-gray-500 w-10 text-right">{percentage || 0}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Available Reports */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map((report) => {
              const colors = colorClasses[report.color];
              return (
                <div
                  key={report.id}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${colors.bg}`}>
                      <report.icon className={`h-6 w-6 ${colors.text}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                        {report.name}
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-100">
                    <button className={`flex items-center gap-1 text-sm font-medium bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent hover:opacity-80 transition-opacity`}>
                      Generate Report
                      <ArrowRightIcon className="h-4 w-4 text-purple-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
        {activeTab === 'communications' && renderCommunications()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'campaigns' && renderCampaigns()}
        {activeTab === 'surveys' && renderSurveys()}
        {activeTab === 'templates' && renderTemplates()}
        {activeTab === 'reports' && renderReports()}
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
          tagsList={tagsData?.data?.data || []}
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
          tags={tagsData?.data?.data || []}
          onClose={() => setShowTagModal(false)}
          onCreate={(data) => createTagMutation.mutate(data)}
          isCreating={createTagMutation.isPending}
        />
      )}

      {/* Task Creation Modal */}
      {showTaskModal && (
        <TaskModal
          staffList={staffData || []}
          leads={leads}
          onClose={() => setShowTaskModal(false)}
          onCreate={(data) => createTaskMutation.mutate(data)}
          isCreating={createTaskMutation.isPending}
        />
      )}

      {/* Campaign Creation Modal */}
      {showCampaignModal && (
        <CampaignModal
          onClose={() => setShowCampaignModal(false)}
          onCreate={(data) => createCampaignMutation.mutate(data)}
          isCreating={createCampaignMutation.isPending}
        />
      )}

      {/* Survey Creation Modal */}
      {showSurveyModal && (
        <SurveyModal
          onClose={() => setShowSurveyModal(false)}
          onCreate={(data) => createSurveyMutation.mutate(data)}
          isCreating={createSurveyMutation.isPending}
        />
      )}

      {/* Communication Logging Modal */}
      {showCommunicationModal && (
        <CommunicationModal
          leads={leads}
          templates={templatesData?.data?.data || []}
          onClose={() => setShowCommunicationModal(false)}
          onCreate={(data) => logCommunicationMutation.mutate(data)}
          isCreating={logCommunicationMutation.isPending}
        />
      )}

      {/* Template Creation/Edit Modal */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          onCreate={(data) => createTemplateMutation.mutate(data)}
          onUpdate={(id, data) => updateTemplateMutation.mutate({ id, data })}
          isCreating={createTemplateMutation.isPending}
          isUpdating={updateTemplateMutation.isPending}
        />
      )}

      {/* Template Preview Modal */}
      {previewingTemplate && (
        <TemplatePreviewModal
          template={previewingTemplate}
          onClose={() => setPreviewingTemplate(null)}
        />
      )}

      {/* Campaign Detail Modal */}
      {showCampaignDetailModal && selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          onClose={() => {
            setShowCampaignDetailModal(false);
            setSelectedCampaign(null);
          }}
          onLaunch={() => launchCampaignMutation.mutate(selectedCampaign.id)}
          onPause={() => pauseCampaignMutation.mutate(selectedCampaign.id)}
          isLaunching={launchCampaignMutation.isPending}
          isPausing={pauseCampaignMutation.isPending}
        />
      )}

      {/* Survey Detail Modal */}
      {showSurveyDetailModal && selectedSurvey && (
        <SurveyDetailModal
          survey={selectedSurvey}
          responses={surveyResponsesData?.data?.data || []}
          isLoading={loadingSurveyResponses}
          onClose={() => {
            setShowSurveyDetailModal(false);
            setSelectedSurvey(null);
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

  const fullLead = leadDetails?.data?.data || lead;

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
                  {(timelineData?.data?.data || []).map((activity: Activity) => (
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
                  {(!timelineData?.data?.data || timelineData.data.data.length === 0) && (
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

// Task Modal Component
function TaskModal({
  staffList,
  leads,
  onClose,
  onCreate,
  isCreating,
}: {
  staffList: StaffMember[];
  leads: Lead[];
  onClose: () => void;
  onCreate: (data: any) => void;
  isCreating: boolean;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taskType: 'FOLLOW_UP_CALL',
    priority: 'MEDIUM',
    assignedToId: '',
    leadId: '',
    dueDate: '',
  });

  const taskTypes = [
    { value: 'FOLLOW_UP_CALL', label: 'Follow-up Call' },
    { value: 'FOLLOW_UP_EMAIL', label: 'Follow-up Email' },
    { value: 'FOLLOW_UP_VISIT', label: 'Follow-up Visit' },
    { value: 'APPOINTMENT_SCHEDULING', label: 'Appointment Scheduling' },
    { value: 'DOCUMENT_COLLECTION', label: 'Document Collection' },
    { value: 'FEEDBACK_COLLECTION', label: 'Feedback Collection' },
    { value: 'PAYMENT_REMINDER', label: 'Payment Reminder' },
    { value: 'CUSTOM', label: 'Custom' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim() && formData.assignedToId && formData.dueDate) {
      onCreate({
        ...formData,
        leadId: formData.leadId || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Create New Task</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Call Mr. Smith for follow-up"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
              <select
                value={formData.taskType}
                onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {taskTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
            <select
              value={formData.assignedToId}
              onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
            >
              <option value="">Select staff member</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.firstName} {staff.lastName} ({staff.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Lead (Optional)</label>
            <select
              value={formData.leadId}
              onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">No lead selected</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.firstName} {lead.lastName} ({lead.leadNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
            <input
              type="datetime-local"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
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
              disabled={isCreating || !formData.title.trim() || !formData.assignedToId || !formData.dueDate}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 transition-all disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Campaign Modal Component
function CampaignModal({
  onClose,
  onCreate,
  isCreating,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
  isCreating: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campaignType: 'PROMOTION',
    channel: 'EMAIL',
    targetAudience: { criteria: 'all_leads' },
  });

  const campaignTypes = [
    { value: 'HEALTH_CAMP', label: 'Health Camp' },
    { value: 'PROMOTION', label: 'Promotion' },
    { value: 'AWARENESS', label: 'Awareness' },
    { value: 'SEASONAL', label: 'Seasonal' },
    { value: 'FOLLOW_UP', label: 'Follow-up' },
    { value: 'RE_ENGAGEMENT', label: 'Re-engagement' },
    { value: 'BIRTHDAY', label: 'Birthday' },
    { value: 'FEEDBACK', label: 'Feedback' },
    { value: 'CUSTOM', label: 'Custom' },
  ];

  const channels = [
    { value: 'EMAIL', label: 'Email' },
    { value: 'SMS', label: 'SMS' },
    { value: 'WHATSAPP', label: 'WhatsApp' },
    { value: 'PHONE_CALL', label: 'Phone Call' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onCreate(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Create New Campaign</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Summer Health Checkup Promo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Campaign objectives and details..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Type</label>
              <select
                value={formData.campaignType}
                onChange={(e) => setFormData({ ...formData, campaignType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {campaignTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {channels.map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
            <select
              value={formData.targetAudience.criteria}
              onChange={(e) => setFormData({ ...formData, targetAudience: { criteria: e.target.value } })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all_leads">All Leads</option>
              <option value="new_leads">New Leads Only</option>
              <option value="qualified_leads">Qualified Leads</option>
              <option value="nurturing_leads">Nurturing Leads</option>
              <option value="all_patients">All Patients</option>
            </select>
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
              disabled={isCreating || !formData.name.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 transition-all disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Survey Modal Component
function SurveyModal({
  onClose,
  onCreate,
  isCreating,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
  isCreating: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    surveyType: 'POST_VISIT',
    isAnonymous: false,
    questions: [
      { type: 'rating', text: 'How would you rate your overall experience?', required: true },
      { type: 'text', text: 'Any additional feedback?', required: false },
    ],
  });

  const surveyTypes = [
    { value: 'POST_VISIT', label: 'Post Visit' },
    { value: 'POST_DISCHARGE', label: 'Post Discharge' },
    { value: 'NPS', label: 'NPS (Net Promoter Score)' },
    { value: 'CSAT', label: 'CSAT (Customer Satisfaction)' },
    { value: 'SERVICE_QUALITY', label: 'Service Quality' },
    { value: 'DOCTOR_FEEDBACK', label: 'Doctor Feedback' },
    { value: 'CUSTOM', label: 'Custom' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onCreate(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Create New Survey</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Survey Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Post-Consultation Feedback"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Purpose of this survey..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Survey Type</label>
            <select
              value={formData.surveyType}
              onChange={(e) => setFormData({ ...formData, surveyType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {surveyTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={formData.isAnonymous}
              onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="isAnonymous" className="text-sm text-gray-700">
              Allow anonymous responses
            </label>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Default Questions</p>
            <ul className="space-y-2 text-sm text-gray-600">
              {formData.questions.map((q, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs">{i + 1}</span>
                  {q.text}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-2">You can customize questions after creation</p>
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
              disabled={isCreating || !formData.name.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 transition-all disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Survey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Communication Modal Component
function CommunicationModal({
  leads,
  templates,
  onClose,
  onCreate,
  isCreating,
}: {
  leads: Lead[];
  templates: any[];
  onClose: () => void;
  onCreate: (data: any) => void;
  isCreating: boolean;
}) {
  const [formData, setFormData] = useState({
    leadId: '',
    channel: 'PHONE_CALL',
    direction: 'OUTBOUND',
    subject: '',
    content: '',
    templateId: '',
    outcome: '',
  });

  const channels = [
    { value: 'PHONE_CALL', label: 'Phone Call', icon: '📞' },
    { value: 'EMAIL', label: 'Email', icon: '📧' },
    { value: 'SMS', label: 'SMS', icon: '💬' },
    { value: 'WHATSAPP', label: 'WhatsApp', icon: '📱' },
    { value: 'IN_PERSON', label: 'In Person', icon: '🤝' },
    { value: 'VIDEO_CALL', label: 'Video Call', icon: '📹' },
  ];

  const directions = [
    { value: 'OUTBOUND', label: 'Outbound (You contacted them)' },
    { value: 'INBOUND', label: 'Inbound (They contacted you)' },
  ];

  const outcomes = [
    { value: '', label: 'Select outcome...' },
    { value: 'CONNECTED', label: 'Connected - Interested' },
    { value: 'CONNECTED_NOT_INTERESTED', label: 'Connected - Not Interested' },
    { value: 'CONNECTED_CALLBACK', label: 'Connected - Callback Requested' },
    { value: 'NO_ANSWER', label: 'No Answer' },
    { value: 'BUSY', label: 'Busy' },
    { value: 'VOICEMAIL', label: 'Left Voicemail' },
    { value: 'WRONG_NUMBER', label: 'Wrong Number' },
    { value: 'APPOINTMENT_BOOKED', label: 'Appointment Booked' },
    { value: 'INFORMATION_SENT', label: 'Information Sent' },
  ];

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setFormData({
      ...formData,
      templateId,
      subject: template?.subject || formData.subject,
      content: template?.content || formData.content,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.content.trim()) {
      onCreate({
        ...formData,
        leadId: formData.leadId || undefined,
        templateId: formData.templateId || undefined,
        outcome: formData.outcome || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Log Communication</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Channel *</label>
            <div className="grid grid-cols-3 gap-2">
              {channels.map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, channel: ch.value })}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    formData.channel === ch.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{ch.icon}</span>
                  <p className="text-xs mt-1 font-medium">{ch.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
            <select
              value={formData.direction}
              onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {directions.map((dir) => (
                <option key={dir.value} value={dir.value}>{dir.label}</option>
              ))}
            </select>
          </div>

          {/* Lead Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Lead</label>
            <select
              value={formData.leadId}
              onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">No lead selected</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.firstName} {lead.lastName} ({lead.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Template Selection (for Email/SMS/WhatsApp) */}
          {['EMAIL', 'SMS', 'WHATSAPP'].includes(formData.channel) && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Use Template</label>
              <select
                value={formData.templateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Don't use template</option>
                {templates
                  .filter(t => t.channel === formData.channel)
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Subject (for Email) */}
          {formData.channel === 'EMAIL' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email subject..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          )}

          {/* Content/Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {['PHONE_CALL', 'IN_PERSON', 'VIDEO_CALL'].includes(formData.channel) ? 'Notes *' : 'Message *'}
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder={
                ['PHONE_CALL', 'IN_PERSON', 'VIDEO_CALL'].includes(formData.channel)
                  ? 'What was discussed...'
                  : 'Message content...'
              }
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
            />
          </div>

          {/* Outcome (for calls) */}
          {['PHONE_CALL', 'VIDEO_CALL'].includes(formData.channel) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
              <select
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {outcomes.map((outcome) => (
                  <option key={outcome.value} value={outcome.value}>{outcome.label}</option>
                ))}
              </select>
            </div>
          )}

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
              disabled={isCreating || !formData.content.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 transition-all disabled:opacity-50"
            >
              {isCreating ? 'Logging...' : 'Log Communication'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Template Modal Component
function TemplateModal({
  template,
  onClose,
  onCreate,
  onUpdate,
  isCreating,
  isUpdating,
}: {
  template: any | null;
  onClose: () => void;
  onCreate: (data: any) => void;
  onUpdate: (id: string, data: any) => void;
  isCreating: boolean;
  isUpdating: boolean;
}) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    channel: template?.channel || 'EMAIL',
    category: template?.category || 'CUSTOM',
    subject: template?.subject || '',
    content: template?.content || '',
    variables: template?.variables || [],
  });

  const [newVariable, setNewVariable] = useState('');

  const channels = [
    { value: 'EMAIL', label: 'Email' },
    { value: 'SMS', label: 'SMS' },
    { value: 'WHATSAPP', label: 'WhatsApp' },
  ];

  const categories = [
    { value: 'APPOINTMENT_REMINDER', label: 'Appointment Reminder' },
    { value: 'FOLLOW_UP', label: 'Follow Up' },
    { value: 'WELCOME', label: 'Welcome Message' },
    { value: 'FEEDBACK_REQUEST', label: 'Feedback Request' },
    { value: 'PROMOTION', label: 'Promotion' },
    { value: 'HEALTH_TIP', label: 'Health Tip' },
    { value: 'BIRTHDAY', label: 'Birthday' },
    { value: 'CUSTOM', label: 'Custom' },
  ];

  const addVariable = () => {
    if (newVariable.trim() && !formData.variables.includes(newVariable.trim())) {
      setFormData({
        ...formData,
        variables: [...formData.variables, newVariable.trim()],
      });
      setNewVariable('');
    }
  };

  const removeVariable = (varToRemove: string) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((v: string) => v !== varToRemove),
    });
  };

  const insertVariable = (variable: string) => {
    setFormData({
      ...formData,
      content: formData.content + `{{${variable}}}`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim() && formData.content.trim()) {
      if (template) {
        onUpdate(template.id, formData);
      } else {
        onCreate(formData);
      }
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">
            {template ? 'Edit Template' : 'Create Template'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Appointment Reminder"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {channels.map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Subject for Email */}
          {formData.channel === 'EMAIL' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email subject line..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          )}

          {/* Variables */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Variables</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newVariable}
                onChange={(e) => setNewVariable(e.target.value)}
                placeholder="e.g., patientName, appointmentDate"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVariable())}
              />
              <button
                type="button"
                onClick={addVariable}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.variables.map((variable: string) => (
                <span
                  key={variable}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm"
                >
                  <button
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="hover:text-purple-900"
                    title="Insert into content"
                  >
                    {`{{${variable}}}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeVariable(variable)}
                    className="text-purple-400 hover:text-purple-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {formData.variables.length === 0 && (
                <span className="text-sm text-gray-400">No variables added. Common: patientName, doctorName, appointmentDate, hospitalName</span>
              )}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder={`Example: Hello {{patientName}},\n\nThis is a reminder for your appointment on {{appointmentDate}}.\n\nBest regards,\n{{hospitalName}}`}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Use {`{{variableName}}`} to insert dynamic content
            </p>
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
              disabled={isLoading || !formData.name.trim() || !formData.content.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Template Preview Modal Component
function TemplatePreviewModal({
  template,
  onClose,
}: {
  template: any;
  onClose: () => void;
}) {
  const [variables, setVariables] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (template.variables || []).forEach((v: string) => {
      initial[v] = '';
    });
    return initial;
  });

  const getPreviewContent = () => {
    let content = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
    });
    return content;
  };

  const getPreviewSubject = () => {
    if (!template.subject) return '';
    let subject = template.subject;
    Object.entries(variables).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
    });
    return subject;
  };

  const channelLabels: Record<string, string> = {
    EMAIL: 'Email',
    SMS: 'SMS',
    WHATSAPP: 'WhatsApp',
  };

  const categoryLabels: Record<string, string> = {
    APPOINTMENT_REMINDER: 'Appointment Reminder',
    FOLLOW_UP: 'Follow Up',
    WELCOME: 'Welcome',
    FEEDBACK_REQUEST: 'Feedback Request',
    PROMOTION: 'Promotion',
    HEALTH_TIP: 'Health Tip',
    BIRTHDAY: 'Birthday',
    CUSTOM: 'Custom',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                {channelLabels[template.channel] || template.channel}
              </span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                {categoryLabels[template.category] || template.category}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Variable Inputs */}
          {template.variables && template.variables.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fill in variables to preview:
              </label>
              <div className="grid grid-cols-2 gap-3">
                {template.variables.map((variable: string) => (
                  <div key={variable}>
                    <label className="block text-xs text-gray-500 mb-1">{variable}</label>
                    <input
                      type="text"
                      value={variables[variable] || ''}
                      onChange={(e) => setVariables({ ...variables, [variable]: e.target.value })}
                      placeholder={`Enter ${variable}...`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preview:</label>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              {template.channel === 'EMAIL' && template.subject && (
                <div className="mb-3 pb-3 border-b border-gray-200">
                  <p className="text-xs text-gray-500">Subject:</p>
                  <p className="font-medium text-gray-900">{getPreviewSubject()}</p>
                </div>
              )}
              <div className="whitespace-pre-wrap text-gray-800">
                {getPreviewContent()}
              </div>
            </div>
          </div>

          {/* Template Info */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{template.usageCount || 0}</p>
              <p className="text-xs text-gray-500">Times Used</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{template.variables?.length || 0}</p>
              <p className="text-xs text-gray-500">Variables</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {template.isActive ? '✓' : '✗'}
              </p>
              <p className="text-xs text-gray-500">{template.isActive ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t border-gray-100">
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

// Campaign Detail Modal Component
function CampaignDetailModal({
  campaign,
  onClose,
  onLaunch,
  onPause,
  isLaunching,
  isPausing,
}: {
  campaign: any;
  onClose: () => void;
  onLaunch: () => void;
  onPause: () => void;
  isLaunching: boolean;
  isPausing: boolean;
}) {
  const progressPercent = campaign.totalRecipients > 0
    ? Math.round((campaign.sentCount || 0) / campaign.totalRecipients * 100)
    : 0;

  const deliveryRate = campaign.sentCount > 0
    ? Math.round((campaign.deliveredCount || 0) / campaign.sentCount * 100)
    : 0;

  const openRate = campaign.deliveredCount > 0
    ? Math.round((campaign.openedCount || 0) / campaign.deliveredCount * 100)
    : 0;

  const clickRate = campaign.openedCount > 0
    ? Math.round((campaign.clickedCount || 0) / campaign.openedCount * 100)
    : 0;

  const conversionRate = campaign.sentCount > 0
    ? Math.round((campaign.convertedCount || 0) / campaign.sentCount * 100)
    : 0;

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    RUNNING: 'bg-green-100 text-green-700',
    PAUSED: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-purple-100 text-purple-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  const channelLabels: Record<string, string> = {
    EMAIL: 'Email',
    SMS: 'SMS',
    WHATSAPP: 'WhatsApp',
    PHONE_CALL: 'Phone Call',
  };

  const typeLabels: Record<string, string> = {
    HEALTH_CAMP: 'Health Camp',
    PROMOTION: 'Promotion',
    AWARENESS: 'Awareness',
    SEASONAL: 'Seasonal',
    FOLLOW_UP: 'Follow-up',
    RE_ENGAGEMENT: 'Re-engagement',
    BIRTHDAY: 'Birthday',
    FEEDBACK: 'Feedback',
    CUSTOM: 'Custom',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                {campaign.status}
              </span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                {channelLabels[campaign.channel] || campaign.channel}
              </span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                {typeLabels[campaign.campaignType] || campaign.campaignType}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          {campaign.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{campaign.description}</p>
            </div>
          )}

          {/* Progress */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Campaign Progress</h4>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Messages Sent</span>
                <span className="font-semibold text-gray-900">
                  {campaign.sentCount || 0} / {campaign.totalRecipients || 0}
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    campaign.status === 'COMPLETED' ? 'bg-green-500' :
                    campaign.status === 'RUNNING' ? 'bg-blue-500' :
                    'bg-purple-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{progressPercent}% complete</p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Performance Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{campaign.deliveredCount || 0}</p>
                <p className="text-xs text-blue-600">Delivered</p>
                <p className="text-xs text-blue-500 mt-1">{deliveryRate}% rate</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{campaign.openedCount || 0}</p>
                <p className="text-xs text-green-600">Opened</p>
                <p className="text-xs text-green-500 mt-1">{openRate}% rate</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-purple-700">{campaign.clickedCount || 0}</p>
                <p className="text-xs text-purple-600">Clicked</p>
                <p className="text-xs text-purple-500 mt-1">{clickRate}% rate</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">{campaign.convertedCount || 0}</p>
                <p className="text-xs text-amber-600">Converted</p>
                <p className="text-xs text-amber-500 mt-1">{conversionRate}% rate</p>
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Responded</p>
              <p className="text-xl font-bold text-gray-900">{campaign.respondedCount || 0}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-xl font-bold text-red-600">{campaign.failedCount || 0}</p>
            </div>
            {campaign.budget && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm text-gray-500">Budget</p>
                <p className="text-xl font-bold text-gray-900">
                  ${Number(campaign.actualCost || 0).toFixed(2)} / ${Number(campaign.budget).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Timeline</h4>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">{format(new Date(campaign.createdAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
              {campaign.scheduledAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Scheduled</span>
                  <span className="text-gray-900">{format(new Date(campaign.scheduledAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
              )}
              {campaign.startedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Started</span>
                  <span className="text-gray-900">{format(new Date(campaign.startedAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
              )}
              {campaign.completedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Completed</span>
                  <span className="text-gray-900">{format(new Date(campaign.completedAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Target Audience */}
          {campaign.targetAudience && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Target Audience</h4>
              <div className="bg-gray-50 rounded-xl p-4">
                <pre className="text-xs text-gray-600 overflow-auto">
                  {JSON.stringify(campaign.targetAudience, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-6 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            Created by {campaign.createdBy?.firstName || 'Unknown'} {campaign.createdBy?.lastName || ''}
          </div>
          <div className="flex items-center gap-3">
            {campaign.status === 'DRAFT' && (
              <button
                onClick={onLaunch}
                disabled={isLaunching}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50"
              >
                <PlayIcon className="h-4 w-4" />
                {isLaunching ? 'Launching...' : 'Launch Campaign'}
              </button>
            )}
            {campaign.status === 'RUNNING' && (
              <button
                onClick={onPause}
                disabled={isPausing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50"
              >
                <PauseIcon className="h-4 w-4" />
                {isPausing ? 'Pausing...' : 'Pause Campaign'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Survey Detail Modal Component
function SurveyDetailModal({
  survey,
  responses,
  isLoading,
  onClose,
}: {
  survey: any;
  responses: any[];
  isLoading: boolean;
  onClose: () => void;
}) {
  const [activeView, setActiveView] = useState<'responses' | 'analytics'>('responses');

  const surveyTypeLabels: Record<string, string> = {
    POST_VISIT: 'Post Visit',
    POST_DISCHARGE: 'Post Discharge',
    NPS: 'Net Promoter Score',
    CSAT: 'Customer Satisfaction',
    SERVICE_QUALITY: 'Service Quality',
    DOCTOR_FEEDBACK: 'Doctor Feedback',
    CUSTOM: 'Custom',
  };

  // Calculate analytics
  const totalResponses = responses.length;
  const avgRating = totalResponses > 0
    ? responses.filter(r => r.overallRating).reduce((sum, r) => sum + r.overallRating, 0) /
      responses.filter(r => r.overallRating).length
    : 0;

  const npsResponses = responses.filter(r => r.npsScore !== null && r.npsScore !== undefined);
  const promoters = npsResponses.filter(r => r.npsScore >= 9).length;
  const passives = npsResponses.filter(r => r.npsScore >= 7 && r.npsScore <= 8).length;
  const detractors = npsResponses.filter(r => r.npsScore <= 6).length;
  const npsScore = npsResponses.length > 0
    ? Math.round(((promoters - detractors) / npsResponses.length) * 100)
    : 0;

  // Sentiment breakdown
  const sentimentCounts = responses.reduce((acc: Record<string, number>, r) => {
    if (r.sentiment) {
      acc[r.sentiment] = (acc[r.sentiment] || 0) + 1;
    }
    return acc;
  }, {});

  // Follow-up required count
  const followUpRequired = responses.filter(r => r.requiresFollowUp).length;

  // Rating distribution
  const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
    rating,
    count: responses.filter(r => r.overallRating === rating).length,
  }));
  const maxRatingCount = Math.max(...ratingDistribution.map(r => r.count), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{survey.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                survey.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {survey.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                {surveyTypeLabels[survey.surveyType] || survey.surveyType}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setActiveView('responses')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'responses'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Responses ({totalResponses})
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'analytics'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : activeView === 'responses' ? (
            <div className="space-y-4">
              {responses.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>No responses yet</p>
                </div>
              ) : (
                responses.map((response, index) => (
                  <div
                    key={response.id || index}
                    className="bg-gray-50 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {response.patient
                            ? `${response.patient.firstName} ${response.patient.lastName}`
                            : survey.isAnonymous
                            ? 'Anonymous'
                            : `Response #${index + 1}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(response.submittedAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {response.overallRating && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-lg">
                            <span className="text-amber-600">★</span>
                            <span className="text-sm font-medium text-amber-700">
                              {response.overallRating}/5
                            </span>
                          </div>
                        )}
                        {response.npsScore !== null && response.npsScore !== undefined && (
                          <div className={`px-2 py-1 rounded-lg text-sm font-medium ${
                            response.npsScore >= 9
                              ? 'bg-green-100 text-green-700'
                              : response.npsScore >= 7
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            NPS: {response.npsScore}
                          </div>
                        )}
                        {response.sentiment && (
                          <span className={`px-2 py-1 text-xs rounded-lg ${
                            response.sentiment === 'positive'
                              ? 'bg-green-100 text-green-700'
                              : response.sentiment === 'negative'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {response.sentiment}
                          </span>
                        )}
                        {response.requiresFollowUp && (
                          <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-lg">
                            Follow-up Required
                          </span>
                        )}
                      </div>
                    </div>

                    {response.feedback && (
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-600 italic">"{response.feedback}"</p>
                      </div>
                    )}

                    {response.answers && Object.keys(response.answers).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase">Answers</p>
                        <div className="bg-white rounded-lg p-3 space-y-2">
                          {Object.entries(response.answers).map(([question, answer]: [string, any]) => (
                            <div key={question} className="text-sm">
                              <p className="text-gray-500">{question}</p>
                              <p className="text-gray-900 font-medium">
                                {typeof answer === 'object' ? JSON.stringify(answer) : String(answer)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            // Analytics View
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-purple-700">{totalResponses}</p>
                  <p className="text-sm text-purple-600">Total Responses</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-amber-700">
                    {avgRating ? avgRating.toFixed(1) : '-'}
                  </p>
                  <p className="text-sm text-amber-600">Avg Rating</p>
                </div>
                <div className={`rounded-xl p-4 text-center ${
                  npsScore >= 50 ? 'bg-gradient-to-br from-green-50 to-green-100' :
                  npsScore >= 0 ? 'bg-gradient-to-br from-blue-50 to-blue-100' :
                  'bg-gradient-to-br from-red-50 to-red-100'
                }`}>
                  <p className={`text-3xl font-bold ${
                    npsScore >= 50 ? 'text-green-700' :
                    npsScore >= 0 ? 'text-blue-700' : 'text-red-700'
                  }`}>
                    {npsResponses.length > 0 ? npsScore : '-'}
                  </p>
                  <p className={`text-sm ${
                    npsScore >= 50 ? 'text-green-600' :
                    npsScore >= 0 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    NPS Score
                  </p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-red-700">{followUpRequired}</p>
                  <p className="text-sm text-red-600">Need Follow-up</p>
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Rating Distribution</h4>
                <div className="space-y-2">
                  {ratingDistribution.reverse().map(({ rating, count }) => (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-16">
                        <span className="text-amber-500">★</span>
                        <span className="text-sm text-gray-600">{rating}</span>
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                          style={{ width: `${(count / maxRatingCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* NPS Breakdown */}
              {npsResponses.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">NPS Breakdown</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-green-700">{promoters}</p>
                      <p className="text-sm text-green-600">Promoters (9-10)</p>
                      <p className="text-xs text-green-500 mt-1">
                        {npsResponses.length > 0 ? Math.round((promoters / npsResponses.length) * 100) : 0}%
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-gray-700">{passives}</p>
                      <p className="text-sm text-gray-600">Passives (7-8)</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {npsResponses.length > 0 ? Math.round((passives / npsResponses.length) * 100) : 0}%
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-red-700">{detractors}</p>
                      <p className="text-sm text-red-600">Detractors (0-6)</p>
                      <p className="text-xs text-red-500 mt-1">
                        {npsResponses.length > 0 ? Math.round((detractors / npsResponses.length) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sentiment Analysis */}
              {Object.keys(sentimentCounts).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Sentiment Analysis</h4>
                  <div className="flex gap-4">
                    {['positive', 'neutral', 'negative'].map((sentiment) => {
                      const count = sentimentCounts[sentiment] || 0;
                      const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
                      const colors = {
                        positive: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
                        neutral: { bg: 'bg-gray-100', text: 'text-gray-700', bar: 'bg-gray-500' },
                        negative: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' },
                      };
                      const c = colors[sentiment as keyof typeof colors];
                      return (
                        <div key={sentiment} className="flex-1">
                          <div className={`${c.bg} rounded-lg p-3 text-center`}>
                            <p className={`text-xl font-bold ${c.text}`}>{count}</p>
                            <p className={`text-xs ${c.text} capitalize`}>{sentiment}</p>
                          </div>
                          <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${c.bar} rounded-full`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 text-center mt-1">{percentage}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-6 border-t border-gray-100">
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
