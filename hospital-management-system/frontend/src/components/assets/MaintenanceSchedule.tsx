import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import {
  WrenchScrewdriverIcon,
  CalendarDaysIcon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
  XMarkIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  CogIcon,
  BeakerIcon,
  EyeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { assetApi } from '../../services/api';
import { GlassCard, GlassCardHeader, GlassCardTitle } from '../ui/GlassCard';
import LoadingSpinner from '../common/LoadingSpinner';
import type { RootState } from '../../store';
import { CurrencyDisplay } from '../common';

// Types
type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'CALIBRATION' | 'INSPECTION' | 'EMERGENCY' | 'AMC_SERVICE';
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

interface MaintenanceRecord {
  id: string;
  maintenanceNumber: string;
  assetId: string;
  maintenanceType: MaintenanceType;
  priority: Priority;
  scheduledDate: string | null;
  startDate: string | null;
  completionDate: string | null;
  description: string;
  findings: string | null;
  actionTaken: string | null;
  partsReplaced: string[];
  laborCost: number | string | null;
  partsCost: number | string | null;
  totalCost: number | string | null;
  performedBy: string | null;
  vendorName: string | null;
  vendorContact: string | null;
  nextMaintenanceDate: string | null;
  status: MaintenanceStatus;
  createdAt: string;
  updatedAt: string;
  asset?: {
    id: string;
    name: string;
    assetTag: string;
    serialNumber?: string;
    location?: string;
    category?: string;
  };
}

interface CompletionFormData {
  findings: string;
  actionTaken: string;
  partsReplaced: string;
  laborCost: number;
  partsCost: number;
  nextMaintenanceDate: string;
}

// Status badge styling
const statusConfig: Record<MaintenanceStatus, { label: string; bgColor: string; textColor: string; icon: typeof CheckCircleIcon }> = {
  SCHEDULED: {
    label: 'Scheduled',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    icon: CalendarDaysIcon,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
    icon: ClockIcon,
  },
  COMPLETED: {
    label: 'Completed',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircleIcon,
  },
  CANCELLED: {
    label: 'Cancelled',
    bgColor: 'bg-slate-500/10 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
    icon: XMarkIcon,
  },
};

// Type badge styling
const typeConfig: Record<MaintenanceType, { label: string; bgColor: string; textColor: string; icon: typeof WrenchScrewdriverIcon }> = {
  PREVENTIVE: {
    label: 'Preventive',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    icon: CogIcon,
  },
  CORRECTIVE: {
    label: 'Corrective',
    bgColor: 'bg-red-500/10 dark:bg-red-500/20',
    textColor: 'text-red-600 dark:text-red-400',
    icon: WrenchScrewdriverIcon,
  },
  CALIBRATION: {
    label: 'Calibration',
    bgColor: 'bg-purple-500/10 dark:bg-purple-500/20',
    textColor: 'text-purple-600 dark:text-purple-400',
    icon: BeakerIcon,
  },
  INSPECTION: {
    label: 'Inspection',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    icon: EyeIcon,
  },
  EMERGENCY: {
    label: 'Emergency',
    bgColor: 'bg-orange-500/10 dark:bg-orange-500/20',
    textColor: 'text-orange-600 dark:text-orange-400',
    icon: ExclamationTriangleIcon,
  },
  AMC_SERVICE: {
    label: 'AMC Service',
    bgColor: 'bg-teal-500/10 dark:bg-teal-500/20',
    textColor: 'text-teal-600 dark:text-teal-400',
    icon: DocumentTextIcon,
  },
};

// Priority badge styling
const priorityConfig: Record<Priority, { label: string; bgColor: string; textColor: string }> = {
  LOW: { label: 'Low', bgColor: 'bg-slate-500/10', textColor: 'text-slate-600 dark:text-slate-400' },
  NORMAL: { label: 'Normal', bgColor: 'bg-blue-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
  HIGH: { label: 'High', bgColor: 'bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
  URGENT: { label: 'Urgent', bgColor: 'bg-red-500/10', textColor: 'text-red-600 dark:text-red-400' },
};

export default function MaintenanceSchedule() {
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<MaintenanceType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modal states
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);

  // Form for completion
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompletionFormData>({
    defaultValues: {
      findings: '',
      actionTaken: '',
      partsReplaced: '',
      laborCost: 0,
      partsCost: 0,
      nextMaintenanceDate: '',
    },
  });

  // Fetch maintenance records
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['maintenance-records', page, limit, statusFilter, typeFilter],
    queryFn: async () => {
      const params: Record<string, any> = { page, limit };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (typeFilter !== 'ALL') params.type = typeFilter;
      const response = await assetApi.getMaintenanceRecords(params);
      return response.data;
    },
  });

  // Start maintenance mutation
  const startMaintenanceMutation = useMutation({
    mutationFn: async ({ id, technicianId }: { id: string; technicianId: string }) => {
      const response = await assetApi.startMaintenance(id, technicianId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      setShowStartModal(false);
      setSelectedRecord(null);
    },
  });

  // Complete maintenance mutation
  const completeMaintenanceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await assetApi.completeMaintenance(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      setShowCompletionModal(false);
      setSelectedRecord(null);
      reset();
    },
  });

  // Filter records locally by search
  const filteredRecords = useMemo(() => {
    if (!data?.data) return [];
    if (!searchQuery) return data.data;

    const query = searchQuery.toLowerCase();
    return data.data.filter((record: MaintenanceRecord) =>
      record.maintenanceNumber.toLowerCase().includes(query) ||
      record.description.toLowerCase().includes(query) ||
      record.asset?.name?.toLowerCase().includes(query) ||
      record.asset?.assetTag?.toLowerCase().includes(query)
    );
  }, [data?.data, searchQuery]);

  // Handle start maintenance
  const handleStartMaintenance = () => {
    if (!selectedRecord || !user?.id) return;
    startMaintenanceMutation.mutate({
      id: selectedRecord.id,
      technicianId: user.id,
    });
  };

  // Handle complete maintenance
  const onCompletionSubmit = (formData: CompletionFormData) => {
    if (!selectedRecord) return;

    const completionData = {
      findings: formData.findings,
      actionTaken: formData.actionTaken,
      partsReplaced: formData.partsReplaced.split(',').map(p => p.trim()).filter(Boolean),
      laborCost: Number(formData.laborCost),
      partsCost: Number(formData.partsCost),
      nextMaintenanceDate: formData.nextMaintenanceDate || undefined,
    };

    completeMaintenanceMutation.mutate({
      id: selectedRecord.id,
      data: completionData,
    });
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };


  // Get upcoming maintenance for calendar view
  const upcomingMaintenance = useMemo(() => {
    if (!filteredRecords) return [];
    return filteredRecords
      .filter((r: MaintenanceRecord) => r.status === 'SCHEDULED' && r.scheduledDate)
      .sort((a: MaintenanceRecord, b: MaintenanceRecord) =>
        new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime()
      );
  }, [filteredRecords]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Error Loading Maintenance Records
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {(error as Error).message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Retry
          </button>
        </div>
      </GlassCard>
    );
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <WrenchScrewdriverIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Maintenance Schedule
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Track and manage asset maintenance activities
              </p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Calendar View
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by maintenance number, asset name, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as MaintenanceStatus | 'ALL');
                setPage(1);
              }}
              className="px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-white transition-all"
            >
              <option value="ALL">All Status</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as MaintenanceType | 'ALL');
              setPage(1);
            }}
            className="px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-white transition-all"
          >
            <option value="ALL">All Types</option>
            <option value="PREVENTIVE">Preventive</option>
            <option value="CORRECTIVE">Corrective</option>
            <option value="CALIBRATION">Calibration</option>
            <option value="INSPECTION">Inspection</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="AMC_SERVICE">AMC Service</option>
          </select>
        </div>
      </GlassCard>

      {/* Content */}
      {viewMode === 'calendar' ? (
        /* Calendar View - Upcoming Maintenance */
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>
              <CalendarDaysIcon className="h-6 w-6 inline mr-2" />
              Upcoming Maintenance
            </GlassCardTitle>
          </GlassCardHeader>

          {upcomingMaintenance.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDaysIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                No upcoming maintenance scheduled
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMaintenance.map((record: MaintenanceRecord) => {
                const typeInfo = typeConfig[record.maintenanceType];
                const StatusIcon = statusConfig[record.status].icon;
                const TypeIcon = typeInfo.icon;

                return (
                  <div
                    key={record.id}
                    className="p-4 bg-gradient-to-r from-white/50 to-white/30 dark:from-slate-800/50 dark:to-slate-800/30 border border-slate-200/50 dark:border-slate-700/50 rounded-xl hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${typeInfo.bgColor}`}>
                          <TypeIcon className={`h-6 w-6 ${typeInfo.textColor}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                              {record.asset?.name || 'Unknown Asset'}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeInfo.bgColor} ${typeInfo.textColor}`}>
                              {typeInfo.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {record.maintenanceNumber} - {record.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {formatDate(record.scheduledDate)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Scheduled Date
                          </p>
                        </div>
                        {record.status === 'SCHEDULED' && (
                          <button
                            onClick={() => {
                              setSelectedRecord(record);
                              setShowStartModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <PlayIcon className="h-4 w-4" />
                            Start
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      ) : (
        /* List View */
        <GlassCard padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Maintenance
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <WrenchScrewdriverIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 dark:text-slate-400">
                        No maintenance records found
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record: MaintenanceRecord) => {
                    const statusInfo = statusConfig[record.status];
                    const typeInfo = typeConfig[record.maintenanceType];
                    const priorityInfo = priorityConfig[record.priority];
                    const StatusIcon = statusInfo.icon;
                    const TypeIcon = typeInfo.icon;

                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {record.maintenanceNumber}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                              {record.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {record.asset?.name || 'Unknown'}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {record.asset?.assetTag || '-'}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.bgColor} ${typeInfo.textColor}`}>
                            <TypeIcon className="h-3.5 w-3.5" />
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-900 dark:text-white">
                            {formatDate(record.scheduledDate)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityInfo.bgColor} ${priorityInfo.textColor}`}>
                            {priorityInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {record.status === 'SCHEDULED' && (
                              <button
                                onClick={() => {
                                  setSelectedRecord(record);
                                  setShowStartModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium"
                              >
                                <PlayIcon className="h-4 w-4" />
                                Start
                              </button>
                            )}
                            {record.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => {
                                  setSelectedRecord(record);
                                  reset({
                                    findings: record.findings || '',
                                    actionTaken: record.actionTaken || '',
                                    partsReplaced: record.partsReplaced?.join(', ') || '',
                                    laborCost: Number(record.laborCost) || 0,
                                    partsCost: Number(record.partsCost) || 0,
                                    nextMaintenanceDate: record.nextMaintenanceDate
                                      ? new Date(record.nextMaintenanceDate).toISOString().split('T')[0]
                                      : '',
                                  });
                                  setShowCompletionModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm font-medium"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                                Complete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of{' '}
                {pagination.total} records
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </button>
                <span className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-white">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRightIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Start Maintenance Modal */}
      {showStartModal && selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => {
                setShowStartModal(false);
                setSelectedRecord(null);
              }}
            />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <PlayIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">Start Maintenance</h3>
                      <p className="text-sm text-blue-100">{selectedRecord.maintenanceNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowStartModal(false);
                      setSelectedRecord(null);
                    }}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Asset</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedRecord.asset?.name || 'Unknown Asset'}
                    </p>
                    <p className="text-sm text-slate-500">{selectedRecord.asset?.assetTag}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Description</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedRecord.description}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Are you sure you want to start this maintenance task? You will be assigned as the technician.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowStartModal(false);
                      setSelectedRecord(null);
                    }}
                    className="flex-1 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartMaintenance}
                    disabled={startMaintenanceMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50"
                  >
                    {startMaintenanceMutation.isPending ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <PlayIcon className="h-5 w-5" />
                        Start Maintenance
                      </>
                    )}
                  </button>
                </div>

                {startMaintenanceMutation.isError && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm">
                    {(startMaintenanceMutation.error as Error).message || 'Failed to start maintenance'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Maintenance Modal */}
      {showCompletionModal && selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => {
                setShowCompletionModal(false);
                setSelectedRecord(null);
                reset();
              }}
            />
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <CheckCircleIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">Complete Maintenance</h3>
                      <p className="text-sm text-emerald-100">
                        {selectedRecord.maintenanceNumber} - {selectedRecord.asset?.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowCompletionModal(false);
                      setSelectedRecord(null);
                      reset();
                    }}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(onCompletionSubmit)}>
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                  {/* Findings */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Findings <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      {...register('findings', { required: 'Findings are required' })}
                      rows={3}
                      placeholder="Describe what was found during maintenance..."
                      className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all resize-none"
                    />
                    {errors.findings && (
                      <p className="mt-1 text-sm text-red-500">{errors.findings.message}</p>
                    )}
                  </div>

                  {/* Action Taken */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Action Taken <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      {...register('actionTaken', { required: 'Action taken is required' })}
                      rows={3}
                      placeholder="Describe the actions performed..."
                      className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all resize-none"
                    />
                    {errors.actionTaken && (
                      <p className="mt-1 text-sm text-red-500">{errors.actionTaken.message}</p>
                    )}
                  </div>

                  {/* Parts Replaced */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Parts Replaced
                    </label>
                    <input
                      {...register('partsReplaced')}
                      type="text"
                      placeholder="Enter parts separated by commas (e.g., Filter, Belt, Gasket)"
                      className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Separate multiple parts with commas
                    </p>
                  </div>

                  {/* Cost Section */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <CurrencyDollarIcon className="h-4 w-4 inline mr-1" />
                        Labor Cost
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          {...register('laborCost', { min: 0 })}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <CurrencyDollarIcon className="h-4 w-4 inline mr-1" />
                        Parts Cost
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          {...register('partsCost', { min: 0 })}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Next Maintenance Date */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <CalendarDaysIcon className="h-4 w-4 inline mr-1" />
                      Next Maintenance Date
                    </label>
                    <input
                      {...register('nextMaintenanceDate')}
                      type="date"
                      className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 dark:text-white transition-all"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Optional: Schedule the next maintenance
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompletionModal(false);
                      setSelectedRecord(null);
                      reset();
                    }}
                    className="px-6 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={completeMaintenanceMutation.isPending}
                    className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                  >
                    {completeMaintenanceMutation.isPending ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Complete Maintenance
                      </>
                    )}
                  </button>
                </div>

                {completeMaintenanceMutation.isError && (
                  <div className="mx-6 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm">
                    {(completeMaintenanceMutation.error as Error).message || 'Failed to complete maintenance'}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
