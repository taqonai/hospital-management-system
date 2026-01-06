import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExclamationTriangleIcon,
  FunnelIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  DocumentMagnifyingGlassIcon,
  SparklesIcon,
  UserIcon,
  MapPinIcon,
  CalendarIcon,
  DocumentTextIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
  ChartBarIcon,
  LightBulbIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { qualityApi, departmentApi } from '../../../services/api';

// Types
interface Incident {
  id: string;
  incidentNumber: string;
  dateTime: string;
  type: IncidentType;
  severity: IncidentSeverity;
  location: string;
  department: string;
  departmentName?: string;
  description: string;
  status: IncidentStatus;
  involvedParties: string[];
  patientId?: string;
  patientName?: string;
  witnesses: string[];
  immediateActions: string;
  reportedBy: string;
  reportedAt: string;
  investigation?: Investigation;
  resolution?: Resolution;
  statusHistory: StatusChange[];
}

interface Investigation {
  investigator: string;
  investigatedAt: string;
  rootCause: string;
  contributingFactors: string[];
  findings: string;
  recommendations: string[];
}

interface Resolution {
  resolvedBy: string;
  resolvedAt: string;
  summary: string;
  correctiveActions: string[];
  preventiveActions: string[];
  lessonsLearned: string;
}

interface StatusChange {
  status: IncidentStatus;
  changedAt: string;
  changedBy: string;
  notes?: string;
}

type IncidentStatus = 'REPORTED' | 'UNDER_INVESTIGATION' | 'INVESTIGATED' | 'CLOSED';
type IncidentType = 'MEDICATION_ERROR' | 'FALL' | 'INFECTION' | 'SURGICAL' | 'DIAGNOSTIC_ERROR' | 'OTHER';
type IncidentSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'SENTINEL';

interface IncidentFormData {
  dateTime: string;
  location: string;
  department: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  involvedParties: string;
  patientId?: string;
  witnesses: string;
  immediateActions: string;
}

interface InvestigationFormData {
  rootCause: string;
  contributingFactors: string;
  findings: string;
  recommendations: string;
}

interface CloseFormData {
  summary: string;
  correctiveActions: string;
  preventiveActions: string;
  lessonsLearned: string;
}

interface FilterState {
  status: string;
  type: string;
  severity: string;
  department: string;
  startDate: string;
  endDate: string;
}

// Constants
const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'REPORTED', label: 'Reported' },
  { value: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
  { value: 'INVESTIGATED', label: 'Investigated' },
  { value: 'CLOSED', label: 'Closed' },
];

const typeOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'MEDICATION_ERROR', label: 'Medication Error' },
  { value: 'FALL', label: 'Fall' },
  { value: 'INFECTION', label: 'Infection' },
  { value: 'SURGICAL', label: 'Surgical' },
  { value: 'DIAGNOSTIC_ERROR', label: 'Diagnostic Error' },
  { value: 'OTHER', label: 'Other' },
];

const severityOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Severities' },
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'SEVERE', label: 'Severe' },
  { value: 'SENTINEL', label: 'Sentinel' },
];

// Helper functions
const getSeverityColor = (severity: IncidentSeverity) => {
  switch (severity) {
    case 'MINOR':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'MODERATE':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'SEVERE':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'SENTINEL':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusColor = (status: IncidentStatus) => {
  switch (status) {
    case 'REPORTED':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'UNDER_INVESTIGATION':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'INVESTIGATED':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'CLOSED':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatStatus = (status: IncidentStatus) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatType = (type: IncidentType) => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatDateTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Mock data for demonstration
const generateMockIncidents = (): Incident[] => {
  const types: IncidentType[] = ['MEDICATION_ERROR', 'FALL', 'INFECTION', 'SURGICAL', 'DIAGNOSTIC_ERROR', 'OTHER'];
  const severities: IncidentSeverity[] = ['MINOR', 'MODERATE', 'SEVERE', 'SENTINEL'];
  const statuses: IncidentStatus[] = ['REPORTED', 'UNDER_INVESTIGATION', 'INVESTIGATED', 'CLOSED'];
  const locations = ['Ward A', 'Ward B', 'ICU', 'Emergency', 'OR 1', 'OR 2', 'Pharmacy', 'Radiology'];
  const departments = ['Internal Medicine', 'Surgery', 'Cardiology', 'Neurology', 'Pediatrics', 'Emergency'];

  return Array.from({ length: 20 }, (_, i) => {
    const status = statuses[i % statuses.length];
    const incident: Incident = {
      id: `INC-${1000 + i}`,
      incidentNumber: `INC-${String(1000 + i).padStart(6, '0')}`,
      dateTime: new Date(Date.now() - i * 86400000 * Math.random() * 10).toISOString(),
      type: types[i % types.length],
      severity: severities[i % severities.length],
      location: locations[i % locations.length],
      department: `dept-${(i % departments.length) + 1}`,
      departmentName: departments[i % departments.length],
      description: `Incident description for case ${1000 + i}. This is a detailed description of what happened during the incident.`,
      status,
      involvedParties: ['Dr. Smith', 'Nurse Johnson'].slice(0, (i % 2) + 1),
      patientId: i % 3 === 0 ? `PAT-${2000 + i}` : undefined,
      patientName: i % 3 === 0 ? `Patient ${i}` : undefined,
      witnesses: i % 2 === 0 ? ['Security Guard', 'Another Staff'] : [],
      immediateActions: 'Immediate safety measures were taken. Patient was stabilized.',
      reportedBy: 'Staff Member',
      reportedAt: new Date(Date.now() - i * 86400000).toISOString(),
      statusHistory: [
        {
          status: 'REPORTED',
          changedAt: new Date(Date.now() - i * 86400000).toISOString(),
          changedBy: 'Staff Member',
        },
      ],
    };

    if (status === 'UNDER_INVESTIGATION' || status === 'INVESTIGATED' || status === 'CLOSED') {
      incident.statusHistory.push({
        status: 'UNDER_INVESTIGATION',
        changedAt: new Date(Date.now() - (i - 1) * 86400000).toISOString(),
        changedBy: 'Quality Manager',
        notes: 'Investigation started',
      });
    }

    if (status === 'INVESTIGATED' || status === 'CLOSED') {
      incident.investigation = {
        investigator: 'Quality Manager',
        investigatedAt: new Date(Date.now() - (i - 2) * 86400000).toISOString(),
        rootCause: 'Root cause analysis identified the primary issue.',
        contributingFactors: ['Factor 1', 'Factor 2', 'Factor 3'],
        findings: 'Investigation findings summarized here.',
        recommendations: ['Recommendation 1', 'Recommendation 2'],
      };
      incident.statusHistory.push({
        status: 'INVESTIGATED',
        changedAt: new Date(Date.now() - (i - 2) * 86400000).toISOString(),
        changedBy: 'Quality Manager',
        notes: 'Investigation completed',
      });
    }

    if (status === 'CLOSED') {
      incident.resolution = {
        resolvedBy: 'Department Head',
        resolvedAt: new Date(Date.now() - (i - 3) * 86400000).toISOString(),
        summary: 'Incident has been resolved with appropriate measures.',
        correctiveActions: ['Corrective action 1', 'Corrective action 2'],
        preventiveActions: ['Preventive measure 1', 'Preventive measure 2'],
        lessonsLearned: 'Key lessons learned from this incident.',
      };
      incident.statusHistory.push({
        status: 'CLOSED',
        changedAt: new Date(Date.now() - (i - 3) * 86400000).toISOString(),
        changedBy: 'Department Head',
        notes: 'Incident closed',
      });
    }

    return incident;
  });
};

export default function IncidentReporting() {
  const queryClient = useQueryClient();

  // State
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    type: 'all',
    severity: 'all',
    department: 'all',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showInvestigateModal, setShowInvestigateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);

  // Forms
  const reportForm = useForm<IncidentFormData>({
    defaultValues: {
      dateTime: new Date().toISOString().slice(0, 16),
      location: '',
      department: '',
      type: 'OTHER',
      severity: 'MINOR',
      description: '',
      involvedParties: '',
      patientId: '',
      witnesses: '',
      immediateActions: '',
    },
  });

  const investigateForm = useForm<InvestigationFormData>({
    defaultValues: {
      rootCause: '',
      contributingFactors: '',
      findings: '',
      recommendations: '',
    },
  });

  const closeForm = useForm<CloseFormData>({
    defaultValues: {
      summary: '',
      correctiveActions: '',
      preventiveActions: '',
      lessonsLearned: '',
    },
  });

  // Queries
  const { data: incidentsData, isLoading: incidentsLoading, refetch: refetchIncidents } = useQuery({
    queryKey: ['incidents', filters],
    queryFn: async () => {
      try {
        const params: Record<string, any> = {};
        if (filters.status !== 'all') params.status = filters.status;
        if (filters.type !== 'all') params.type = filters.type;
        if (filters.severity !== 'all') params.severity = filters.severity;
        if (filters.department !== 'all') params.department = filters.department;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;

        const response = await qualityApi.getIncidents(params);
        return response.data?.data || response.data || [];
      } catch (error) {
        console.error('Error fetching incidents:', error);
        return generateMockIncidents();
      }
    },
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      try {
        const response = await departmentApi.getAll();
        return response.data?.data || response.data || [];
      } catch (error) {
        console.error('Error fetching departments:', error);
        return [
          { id: 'dept-1', name: 'Internal Medicine' },
          { id: 'dept-2', name: 'Surgery' },
          { id: 'dept-3', name: 'Cardiology' },
          { id: 'dept-4', name: 'Neurology' },
          { id: 'dept-5', name: 'Pediatrics' },
          { id: 'dept-6', name: 'Emergency' },
        ];
      }
    },
  });

  // Mutations
  const reportIncidentMutation = useMutation({
    mutationFn: async (data: IncidentFormData) => {
      const payload = {
        dateTime: data.dateTime,
        location: data.location,
        departmentId: data.department,
        type: data.type,
        severity: data.severity,
        description: data.description,
        involvedParties: data.involvedParties.split(',').map((p) => p.trim()).filter(Boolean),
        patientId: data.patientId || undefined,
        witnesses: data.witnesses.split(',').map((w) => w.trim()).filter(Boolean),
        immediateActions: data.immediateActions,
      };
      return await qualityApi.reportIncident(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setShowReportModal(false);
      reportForm.reset();
    },
  });

  const investigateMutation = useMutation({
    mutationFn: async (data: InvestigationFormData) => {
      if (!selectedIncident) throw new Error('No incident selected');
      const payload = {
        rootCause: data.rootCause,
        contributingFactors: data.contributingFactors.split(',').map((f) => f.trim()).filter(Boolean),
        findings: data.findings,
        recommendations: data.recommendations.split('\n').map((r) => r.trim()).filter(Boolean),
      };
      return await qualityApi.investigateIncident(selectedIncident.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setShowInvestigateModal(false);
      setSelectedIncident(null);
      investigateForm.reset();
    },
  });

  const closeIncidentMutation = useMutation({
    mutationFn: async (data: CloseFormData) => {
      if (!selectedIncident) throw new Error('No incident selected');
      const payload = {
        summary: data.summary,
        correctiveActions: data.correctiveActions.split('\n').map((a) => a.trim()).filter(Boolean),
        preventiveActions: data.preventiveActions.split('\n').map((a) => a.trim()).filter(Boolean),
        lessonsLearned: data.lessonsLearned,
      };
      return await qualityApi.closeIncident(selectedIncident.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setShowCloseModal(false);
      setSelectedIncident(null);
      closeForm.reset();
    },
  });

  // Get filtered incidents
  const incidents = incidentsData || [];
  const filteredIncidents = incidents.filter((incident: Incident) => {
    if (filters.status !== 'all' && incident.status !== filters.status) return false;
    if (filters.type !== 'all' && incident.type !== filters.type) return false;
    if (filters.severity !== 'all' && incident.severity !== filters.severity) return false;
    if (filters.department !== 'all' && incident.department !== filters.department) return false;
    if (filters.startDate && new Date(incident.dateTime) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(incident.dateTime) > new Date(filters.endDate)) return false;
    return true;
  });

  // AI Root Cause Analysis
  const handleAIAnalysis = async (incident: Incident) => {
    setAiAnalysisLoading(true);
    setAiAnalysisResult(null);

    try {
      const response = await qualityApi.rootCauseAnalysis({
        incidentType: incident.type,
        description: incident.description,
        severity: incident.severity,
        location: incident.location,
        involvedParties: incident.involvedParties,
      });
      setAiAnalysisResult(response.data?.data || response.data);
    } catch (error) {
      console.error('Error performing AI analysis:', error);
      // Mock AI result
      setAiAnalysisResult({
        possibleRootCauses: [
          'Process deviation from standard protocol',
          'Communication breakdown between staff',
          'Equipment malfunction or unavailability',
          'Staffing or workload issues',
        ],
        contributingFactors: [
          'High patient volume during incident',
          'Recent staff turnover',
          'Incomplete documentation',
        ],
        recommendedActions: [
          'Review and update standard operating procedures',
          'Implement additional staff training',
          'Install redundant safety checks',
          'Improve communication protocols',
        ],
        similarIncidents: 3,
        riskLevel: 'Medium-High',
        confidenceScore: 0.85,
      });
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  // Handle opening investigation modal
  const handleOpenInvestigate = (incident: Incident) => {
    setSelectedIncident(incident);
    setShowInvestigateModal(true);
    setAiAnalysisResult(null);
  };

  // Handle opening close modal
  const handleOpenClose = (incident: Incident) => {
    setSelectedIncident(incident);
    setShowCloseModal(true);
  };

  // Stats calculation
  const stats = {
    total: incidents.length,
    reported: incidents.filter((i: Incident) => i.status === 'REPORTED').length,
    underInvestigation: incidents.filter((i: Incident) => i.status === 'UNDER_INVESTIGATION').length,
    investigated: incidents.filter((i: Incident) => i.status === 'INVESTIGATED').length,
    closed: incidents.filter((i: Incident) => i.status === 'CLOSED').length,
    sentinel: incidents.filter((i: Incident) => i.severity === 'SENTINEL').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />
            Incident Reporting & Management
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Report, track, and resolve safety incidents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchIncidents()}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Report Incident
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-gray-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gray-100">
              <ChartBarIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-blue-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100">
              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.reported}</p>
              <p className="text-xs text-gray-500">Reported</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-yellow-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-yellow-100">
              <DocumentMagnifyingGlassIcon className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.underInvestigation}</p>
              <p className="text-xs text-gray-500">Investigating</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-purple-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100">
              <BeakerIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{stats.investigated}</p>
              <p className="text-xs text-gray-500">Investigated</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-green-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-100">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.closed}</p>
              <p className="text-xs text-gray-500">Closed</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-red-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100">
              <ShieldExclamationIcon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.sentinel}</p>
              <p className="text-xs text-gray-500">Sentinel</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-gray-200 shadow-lg overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-gray-700">Filters</span>
          </div>
          {showFilters ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {showFilters && (
          <div className="p-6 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                >
                  {severityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                >
                  <option value="all">All Departments</option>
                  {(departmentsData || []).map((dept: any) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                />
              </div>
            </div>

            {/* Clear Filters */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() =>
                  setFilters({
                    status: 'all',
                    type: 'all',
                    severity: 'all',
                    department: 'all',
                    startDate: '',
                    endDate: '',
                  })
                }
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Incidents Table */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <h3 className="font-semibold text-gray-900">
            Incidents ({filteredIncidents.length})
          </h3>
        </div>

        {incidentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No incidents found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Incident #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIncidents.map((incident: Incident) => (
                  <>
                    <tr
                      key={incident.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        setExpandedIncidentId(
                          expandedIncidentId === incident.id ? null : incident.id
                        )
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {expandedIncidentId === incident.id ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium text-gray-900">
                            {incident.incidentNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDateTime(incident.dateTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatType(incident.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(
                            incident.severity
                          )}`}
                        >
                          {incident.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {incident.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                            incident.status
                          )}`}
                        >
                          {formatStatus(incident.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {incident.status === 'REPORTED' && (
                            <button
                              onClick={() => handleOpenInvestigate(incident)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                            >
                              Investigate
                            </button>
                          )}
                          {incident.status === 'UNDER_INVESTIGATION' && (
                            <button
                              onClick={() => handleOpenInvestigate(incident)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                            >
                              Complete Investigation
                            </button>
                          )}
                          {incident.status === 'INVESTIGATED' && (
                            <button
                              onClick={() => handleOpenClose(incident)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail Panel */}
                    {expandedIncidentId === incident.id && (
                      <tr key={`${incident.id}-expanded`}>
                        <td colSpan={7} className="px-6 py-6 bg-gray-50">
                          <div className="space-y-6">
                            {/* Incident Details */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Left Column - Basic Info */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                                  Incident Details
                                </h4>

                                <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-500">Description</p>
                                    <p className="text-sm text-gray-900 mt-1">{incident.description}</p>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-medium text-gray-500">Location</p>
                                      <p className="text-sm text-gray-900 mt-1 flex items-center gap-1">
                                        <MapPinIcon className="h-4 w-4 text-gray-400" />
                                        {incident.location}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-500">Department</p>
                                      <p className="text-sm text-gray-900 mt-1">
                                        {incident.departmentName || incident.department}
                                      </p>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-sm font-medium text-gray-500">Involved Parties</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {incident.involvedParties.map((party, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs flex items-center gap-1"
                                        >
                                          <UserIcon className="h-3 w-3" />
                                          {party}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  {incident.patientId && (
                                    <div>
                                      <p className="text-sm font-medium text-gray-500">Patient</p>
                                      <p className="text-sm text-gray-900 mt-1">
                                        {incident.patientName || incident.patientId}
                                      </p>
                                    </div>
                                  )}

                                  {incident.witnesses.length > 0 && (
                                    <div>
                                      <p className="text-sm font-medium text-gray-500">Witnesses</p>
                                      <p className="text-sm text-gray-900 mt-1">
                                        {incident.witnesses.join(', ')}
                                      </p>
                                    </div>
                                  )}

                                  <div>
                                    <p className="text-sm font-medium text-gray-500">Immediate Actions Taken</p>
                                    <p className="text-sm text-gray-900 mt-1">{incident.immediateActions}</p>
                                  </div>

                                  <div className="pt-3 border-t border-gray-200">
                                    <p className="text-xs text-gray-500">
                                      Reported by {incident.reportedBy} on{' '}
                                      {formatDateTime(incident.reportedAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column - Timeline & Investigation */}
                              <div className="space-y-4">
                                {/* Status Timeline */}
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <ClockIcon className="h-5 w-5 text-gray-500" />
                                  Status Timeline
                                </h4>

                                <div className="rounded-xl bg-white border border-gray-200 p-4">
                                  <div className="space-y-4">
                                    {incident.statusHistory.map((change, idx) => (
                                      <div key={idx} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                          <div
                                            className={`w-3 h-3 rounded-full ${
                                              idx === incident.statusHistory.length - 1
                                                ? 'bg-amber-500'
                                                : 'bg-gray-300'
                                            }`}
                                          />
                                          {idx < incident.statusHistory.length - 1 && (
                                            <div className="w-0.5 h-full bg-gray-200 mt-1" />
                                          )}
                                        </div>
                                        <div className="flex-1 pb-4">
                                          <p className="text-sm font-medium text-gray-900">
                                            {formatStatus(change.status)}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {formatDateTime(change.changedAt)} by {change.changedBy}
                                          </p>
                                          {change.notes && (
                                            <p className="text-xs text-gray-600 mt-1">{change.notes}</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Investigation Section */}
                                {incident.investigation && (
                                  <>
                                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                      <DocumentMagnifyingGlassIcon className="h-5 w-5 text-gray-500" />
                                      Investigation
                                    </h4>

                                    <div className="rounded-xl bg-white border border-purple-200 p-4 space-y-3">
                                      <div>
                                        <p className="text-sm font-medium text-gray-500">Root Cause</p>
                                        <p className="text-sm text-gray-900 mt-1">
                                          {incident.investigation.rootCause}
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-gray-500">Contributing Factors</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                          {incident.investigation.contributingFactors.map((factor, idx) => (
                                            <span
                                              key={idx}
                                              className="px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-xs"
                                            >
                                              {factor}
                                            </span>
                                          ))}
                                        </div>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-gray-500">Findings</p>
                                        <p className="text-sm text-gray-900 mt-1">
                                          {incident.investigation.findings}
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-gray-500">Recommendations</p>
                                        <ul className="list-disc list-inside text-sm text-gray-900 mt-1 space-y-1">
                                          {incident.investigation.recommendations.map((rec, idx) => (
                                            <li key={idx}>{rec}</li>
                                          ))}
                                        </ul>
                                      </div>

                                      <div className="pt-3 border-t border-purple-100">
                                        <p className="text-xs text-gray-500">
                                          Investigated by {incident.investigation.investigator} on{' '}
                                          {formatDateTime(incident.investigation.investigatedAt)}
                                        </p>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Resolution Section */}
                                {incident.resolution && (
                                  <>
                                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                      <CheckCircleIcon className="h-5 w-5 text-gray-500" />
                                      Resolution
                                    </h4>

                                    <div className="rounded-xl bg-white border border-green-200 p-4 space-y-3">
                                      <div>
                                        <p className="text-sm font-medium text-gray-500">Summary</p>
                                        <p className="text-sm text-gray-900 mt-1">
                                          {incident.resolution.summary}
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-gray-500">Corrective Actions</p>
                                        <ul className="list-disc list-inside text-sm text-gray-900 mt-1 space-y-1">
                                          {incident.resolution.correctiveActions.map((action, idx) => (
                                            <li key={idx}>{action}</li>
                                          ))}
                                        </ul>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-gray-500">Preventive Actions</p>
                                        <ul className="list-disc list-inside text-sm text-gray-900 mt-1 space-y-1">
                                          {incident.resolution.preventiveActions.map((action, idx) => (
                                            <li key={idx}>{action}</li>
                                          ))}
                                        </ul>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-gray-500">Lessons Learned</p>
                                        <p className="text-sm text-gray-900 mt-1">
                                          {incident.resolution.lessonsLearned}
                                        </p>
                                      </div>

                                      <div className="pt-3 border-t border-green-100">
                                        <p className="text-xs text-gray-500">
                                          Resolved by {incident.resolution.resolvedBy} on{' '}
                                          {formatDateTime(incident.resolution.resolvedAt)}
                                        </p>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* AI Analysis Button */}
                                {!incident.resolution && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAIAnalysis(incident);
                                    }}
                                    disabled={aiAnalysisLoading}
                                    className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                                  >
                                    {aiAnalysisLoading ? (
                                      <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                        <span>Analyzing...</span>
                                      </>
                                    ) : (
                                      <>
                                        <SparklesIcon className="h-5 w-5" />
                                        <span>AI Root Cause Analysis</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* AI Analysis Result */}
                            {aiAnalysisResult && expandedIncidentId === incident.id && (
                              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <SparklesIcon className="h-5 w-5 text-indigo-500" />
                                    AI Root Cause Analysis
                                  </h4>
                                  <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                                    Confidence: {Math.round(aiAnalysisResult.confidenceScore * 100)}%
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="rounded-lg bg-white/70 p-4 space-y-2">
                                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                                      Possible Root Causes
                                    </p>
                                    <ul className="space-y-1">
                                      {aiAnalysisResult.possibleRootCauses.map((cause: string, idx: number) => (
                                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                          <span className="text-indigo-500 font-medium">{idx + 1}.</span>
                                          {cause}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="rounded-lg bg-white/70 p-4 space-y-2">
                                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                      <ChartBarIcon className="h-4 w-4 text-purple-500" />
                                      Contributing Factors
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {aiAnalysisResult.contributingFactors.map((factor: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs"
                                        >
                                          {factor}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-lg bg-white/70 p-4 space-y-2">
                                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <LightBulbIcon className="h-4 w-4 text-green-500" />
                                    Recommended Actions
                                  </p>
                                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {aiAnalysisResult.recommendedActions.map((action: string, idx: number) => (
                                      <li
                                        key={idx}
                                        className="text-sm text-gray-600 flex items-start gap-2 bg-green-50 p-2 rounded-lg"
                                      >
                                        <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                        {action}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="flex items-center justify-between text-sm text-gray-500">
                                  <span>
                                    Similar incidents found: {aiAnalysisResult.similarIncidents}
                                  </span>
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      aiAnalysisResult.riskLevel === 'High' || aiAnalysisResult.riskLevel === 'Medium-High'
                                        ? 'bg-red-100 text-red-700'
                                        : aiAnalysisResult.riskLevel === 'Medium'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}
                                  >
                                    Risk Level: {aiAnalysisResult.riskLevel}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Incident Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />
                Report New Incident
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={reportForm.handleSubmit((data) => reportIncidentMutation.mutate(data))}
              className="p-6 space-y-6"
            >
              {/* Date/Time and Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Incident Date/Time *
                  </label>
                  <Controller
                    name="dateTime"
                    control={reportForm.control}
                    rules={{ required: 'Date and time is required' }}
                    render={({ field }) => (
                      <input
                        type="datetime-local"
                        {...field}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location *
                  </label>
                  <Controller
                    name="location"
                    control={reportForm.control}
                    rules={{ required: 'Location is required' }}
                    render={({ field }) => (
                      <input
                        type="text"
                        {...field}
                        placeholder="e.g., Ward A, Room 101"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    )}
                  />
                </div>
              </div>

              {/* Department and Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department *
                  </label>
                  <Controller
                    name="department"
                    control={reportForm.control}
                    rules={{ required: 'Department is required' }}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                      >
                        <option value="">Select Department</option>
                        {(departmentsData || []).map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Incident Type *
                  </label>
                  <Controller
                    name="type"
                    control={reportForm.control}
                    rules={{ required: 'Type is required' }}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                      >
                        {typeOptions.slice(1).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Severity *
                </label>
                <Controller
                  name="severity"
                  control={reportForm.control}
                  rules={{ required: 'Severity is required' }}
                  render={({ field }) => (
                    <div className="grid grid-cols-4 gap-3">
                      {severityOptions.slice(1).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => field.onChange(option.value)}
                          className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                            field.value === option.value
                              ? getSeverityColor(option.value as IncidentSeverity).replace('bg-', 'bg-').replace('100', '200') + ' border-current'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <Controller
                  name="description"
                  control={reportForm.control}
                  rules={{ required: 'Description is required' }}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={4}
                      placeholder="Provide a detailed description of the incident..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                    />
                  )}
                />
              </div>

              {/* Involved Parties */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Involved Parties
                </label>
                <Controller
                  name="involvedParties"
                  control={reportForm.control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      placeholder="Enter names separated by commas"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  )}
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple names with commas</p>
              </div>

              {/* Patient ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient ID (Optional)
                </label>
                <Controller
                  name="patientId"
                  control={reportForm.control}
                  render={({ field }) => (
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        {...field}
                        placeholder="Search by patient ID or name"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  )}
                />
              </div>

              {/* Witnesses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Witnesses
                </label>
                <Controller
                  name="witnesses"
                  control={reportForm.control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      placeholder="Enter witness names separated by commas"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  )}
                />
              </div>

              {/* Immediate Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Immediate Actions Taken *
                </label>
                <Controller
                  name="immediateActions"
                  control={reportForm.control}
                  rules={{ required: 'Immediate actions are required' }}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Describe any immediate actions taken..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                    />
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportIncidentMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50 flex items-center gap-2"
                >
                  {reportIncidentMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Report'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Investigation Modal */}
      {showInvestigateModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DocumentMagnifyingGlassIcon className="h-6 w-6 text-purple-500" />
                Investigation - {selectedIncident.incidentNumber}
              </h3>
              <button
                onClick={() => {
                  setShowInvestigateModal(false);
                  setSelectedIncident(null);
                  setAiAnalysisResult(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* AI Analysis Button in Modal */}
              <button
                onClick={() => handleAIAnalysis(selectedIncident)}
                disabled={aiAnalysisLoading}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                {aiAnalysisLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5" />
                    <span>Get AI Root Cause Analysis</span>
                  </>
                )}
              </button>

              {/* AI Analysis Result in Modal */}
              {aiAnalysisResult && (
                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-indigo-700">AI Suggestions</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <strong>Possible Root Causes:</strong>{' '}
                      {aiAnalysisResult.possibleRootCauses.join('; ')}
                    </p>
                    <p>
                      <strong>Contributing Factors:</strong>{' '}
                      {aiAnalysisResult.contributingFactors.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              <form
                onSubmit={investigateForm.handleSubmit((data) => investigateMutation.mutate(data))}
                className="space-y-6"
              >
                {/* Root Cause */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Root Cause *
                  </label>
                  <Controller
                    name="rootCause"
                    control={investigateForm.control}
                    rules={{ required: 'Root cause is required' }}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Describe the root cause of the incident..."
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    )}
                  />
                </div>

                {/* Contributing Factors */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contributing Factors
                  </label>
                  <Controller
                    name="contributingFactors"
                    control={investigateForm.control}
                    render={({ field }) => (
                      <input
                        type="text"
                        {...field}
                        placeholder="Enter factors separated by commas"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate multiple factors with commas</p>
                </div>

                {/* Findings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Findings *
                  </label>
                  <Controller
                    name="findings"
                    control={investigateForm.control}
                    rules={{ required: 'Findings are required' }}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={4}
                        placeholder="Summarize the investigation findings..."
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    )}
                  />
                </div>

                {/* Recommendations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recommendations
                  </label>
                  <Controller
                    name="recommendations"
                    control={investigateForm.control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Enter recommendations (one per line)"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter each recommendation on a new line</p>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInvestigateModal(false);
                      setSelectedIncident(null);
                      setAiAnalysisResult(null);
                    }}
                    className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={investigateMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center gap-2"
                  >
                    {investigateMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Saving...
                      </>
                    ) : (
                      'Complete Investigation'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Close Incident Modal */}
      {showCloseModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
                Close Incident - {selectedIncident.incidentNumber}
              </h3>
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  setSelectedIncident(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={closeForm.handleSubmit((data) => closeIncidentMutation.mutate(data))}
              className="p-6 space-y-6"
            >
              {/* Resolution Summary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Summary *
                </label>
                <Controller
                  name="summary"
                  control={closeForm.control}
                  rules={{ required: 'Summary is required' }}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Summarize how the incident was resolved..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    />
                  )}
                />
              </div>

              {/* Corrective Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corrective Actions *
                </label>
                <Controller
                  name="correctiveActions"
                  control={closeForm.control}
                  rules={{ required: 'Corrective actions are required' }}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="List corrective actions taken (one per line)"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    />
                  )}
                />
                <p className="text-xs text-gray-500 mt-1">Enter each action on a new line</p>
              </div>

              {/* Preventive Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preventive Actions *
                </label>
                <Controller
                  name="preventiveActions"
                  control={closeForm.control}
                  rules={{ required: 'Preventive actions are required' }}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="List preventive measures to avoid recurrence (one per line)"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    />
                  )}
                />
                <p className="text-xs text-gray-500 mt-1">Enter each measure on a new line</p>
              </div>

              {/* Lessons Learned */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lessons Learned
                </label>
                <Controller
                  name="lessonsLearned"
                  control={closeForm.control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Document key lessons learned from this incident..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    />
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCloseModal(false);
                    setSelectedIncident(null);
                  }}
                  className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closeIncidentMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50 flex items-center gap-2"
                >
                  {closeIncidentMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Closing...
                    </>
                  ) : (
                    'Close Incident'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
