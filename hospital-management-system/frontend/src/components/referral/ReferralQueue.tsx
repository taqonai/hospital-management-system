import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  CalendarIcon,
  UserIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { referralApi, departmentApi, api } from '../../services/api';
import toast from 'react-hot-toast';

interface Referral {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    phone: string;
  };
  referringDoctor: {
    user: { firstName: string; lastName: string };
    department: { name: string };
  };
  targetDepartment: { id: string; name: string };
  targetDoctor?: {
    user: { firstName: string; lastName: string };
  };
  reason: string;
  urgency: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
  status: string;
  createdAt: string;
  priorityBooking?: boolean;
  priorityExpiresAt?: string;
}

interface ScheduleModalProps {
  referral: Referral;
  onClose: () => void;
  onSchedule: (data: { appointmentDate: string; startTime: string; endTime: string; notes?: string }) => void;
  isLoading: boolean;
}

function ScheduleModal({ referral, onClose, onSchedule, isLoading }: ScheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [notes, setNotes] = useState('');

  // Fetch available slots for the target doctor
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['referral-schedule-slots', referral.id, selectedDate],
    queryFn: async () => {
      const response = await referralApi.getSlots(referral.id, selectedDate || undefined);
      return response.data.data;
    },
    enabled: !!referral.targetDoctor,
  });

  // Fetch doctors in department if no target doctor specified
  const { data: doctorsData } = useQuery({
    queryKey: ['department-doctors', referral.targetDepartment.id],
    queryFn: async () => {
      const response = await api.get(`/doctors`, {
        params: { departmentId: referral.targetDepartment.id, limit: 100 },
      });
      return response.data.data?.doctors || response.data.data || [];
    },
    enabled: !referral.targetDoctor,
  });

  const availableDates = slotsData?.slotsByDate ? Object.keys(slotsData.slotsByDate).sort() : [];
  const slotsForDate = selectedDate && slotsData?.slotsByDate ? slotsData.slotsByDate[selectedDate] || [] : [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleSubmit = () => {
    if (selectedDate && selectedSlot) {
      onSchedule({
        appointmentDate: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        notes: notes || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full">
          <div className={clsx(
            'px-6 py-4 flex items-center justify-between',
            referral.urgency === 'EMERGENCY' ? 'bg-red-600' :
            referral.urgency === 'URGENT' ? 'bg-amber-600' : 'bg-indigo-600'
          )}>
            <div>
              <h2 className="text-lg font-semibold text-white">Schedule Referral Appointment</h2>
              <p className="text-white/80 text-sm">
                {referral.patient.firstName} {referral.patient.lastName} - {referral.targetDepartment.name}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Patient Info */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <h4 className="font-medium text-gray-900 mb-2">Referral Details</h4>
              <p className="text-sm text-gray-600">
                <span className="font-medium">From:</span> Dr. {referral.referringDoctor.user.firstName} {referral.referringDoctor.user.lastName} ({referral.referringDoctor.department.name})
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Reason:</span> {referral.reason}
              </p>
            </div>

            {/* Date Selection */}
            {referral.targetDoctor ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                  {slotsLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Loading available slots...
                    </div>
                  ) : availableDates.length === 0 ? (
                    <p className="text-gray-500">No available slots found</p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {availableDates.slice(0, 7).map((date) => (
                        <button
                          key={date}
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedSlot(null);
                          }}
                          className={clsx(
                            'px-3 py-2 rounded-lg border text-sm',
                            selectedDate === date
                              ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          )}
                        >
                          {formatDate(date)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Time Selection */}
                {selectedDate && slotsForDate.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
                    <div className="grid grid-cols-4 gap-2">
                      {slotsForDate.map((slot: any) => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot({ startTime: slot.startTime, endTime: slot.endTime })}
                          className={clsx(
                            'px-3 py-2 rounded-lg border text-sm',
                            selectedSlot?.startTime === slot.startTime
                              ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          )}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800">
                  No specific consultant was assigned. Please select a doctor and their available slots manually.
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm"
                placeholder="Any additional notes for the appointment..."
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedDate || !selectedSlot || isLoading}
              className={clsx(
                'px-4 py-2 rounded-lg text-white font-medium',
                !selectedDate || !selectedSlot || isLoading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              )}
            >
              {isLoading ? 'Scheduling...' : 'Schedule Appointment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReferralQueue() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    urgency: '' as '' | 'EMERGENCY' | 'URGENT' | 'ROUTINE',
    departmentId: '',
    status: 'PENDING' as 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);

  // Fetch referral queue
  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['referral-queue', filters, page],
    queryFn: async () => {
      const response = await referralApi.getQueue({
        ...filters,
        urgency: filters.urgency || undefined,
        departmentId: filters.departmentId || undefined,
        page,
        limit: 20,
      });
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch departments for filter
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await departmentApi.getAll();
      return response.data.data || response.data;
    },
  });

  // Schedule appointment mutation
  const scheduleMutation = useMutation({
    mutationFn: async ({ referralId, data }: { referralId: string; data: any }) => {
      const response = await referralApi.schedule(referralId, data);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('Appointment scheduled successfully');
      setSelectedReferral(null);
      queryClient.invalidateQueries({ queryKey: ['referral-queue'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to schedule appointment');
    },
  });

  const referrals: Referral[] = queueData?.referrals || [];
  const totalPages = queueData?.totalPages || 1;

  const filteredReferrals = referrals.filter((r) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.patient.firstName.toLowerCase().includes(search) ||
      r.patient.lastName.toLowerCase().includes(search) ||
      r.patient.mrn.toLowerCase().includes(search)
    );
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'EMERGENCY':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Emergency</span>;
      case 'URGENT':
        return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Urgent</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Routine</span>;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <UserIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Referral Queue</h2>
              <p className="text-sm text-gray-500">
                {queueData?.total || 0} pending referrals
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patient..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={filters.urgency}
            onChange={(e) => setFilters({ ...filters, urgency: e.target.value as any })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Urgencies</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="URGENT">Urgent</option>
            <option value="ROUTINE">Routine</option>
          </select>
          <select
            value={filters.departmentId}
            onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Departments</option>
            {departments?.map((dept: any) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Queue List */}
      <div className="divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-12 text-center">
            <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto" />
            <p className="text-gray-500 mt-2">Loading referrals...</p>
          </div>
        ) : filteredReferrals.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto" />
            <p className="text-gray-600 mt-2">No pending referrals</p>
          </div>
        ) : (
          filteredReferrals.map((referral) => (
            <div
              key={referral.id}
              className={clsx(
                'p-4 hover:bg-gray-50 transition-colors',
                referral.urgency === 'EMERGENCY' && 'bg-red-50/50',
                referral.urgency === 'URGENT' && 'bg-amber-50/50'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getUrgencyBadge(referral.urgency)}
                    <span className="text-gray-400">|</span>
                    <span className="text-sm text-gray-500">
                      <ClockIcon className="h-4 w-4 inline mr-1" />
                      {formatTimeAgo(referral.createdAt)}
                    </span>
                  </div>

                  <h3 className="font-medium text-gray-900">
                    {referral.patient.firstName} {referral.patient.lastName}
                    <span className="text-gray-500 font-normal ml-2">({referral.patient.mrn})</span>
                  </h3>

                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium">To:</span>{' '}
                      {referral.targetDepartment.name}
                      {referral.targetDoctor && (
                        <> - Dr. {referral.targetDoctor.user.firstName} {referral.targetDoctor.user.lastName}</>
                      )}
                    </p>
                    <p>
                      <span className="font-medium">From:</span>{' '}
                      Dr. {referral.referringDoctor.user.firstName} {referral.referringDoctor.user.lastName}
                      <span className="text-gray-400"> ({referral.referringDoctor.department.name})</span>
                    </p>
                    <p className="text-gray-500 truncate">
                      <span className="font-medium">Reason:</span> {referral.reason}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedReferral(referral)}
                  className={clsx(
                    'px-4 py-2 rounded-lg font-medium text-sm text-white',
                    referral.urgency === 'EMERGENCY' ? 'bg-red-600 hover:bg-red-700' :
                    referral.urgency === 'URGENT' ? 'bg-amber-600 hover:bg-amber-700' :
                    'bg-indigo-600 hover:bg-indigo-700'
                  )}
                >
                  Schedule
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Schedule Modal */}
      {selectedReferral && (
        <ScheduleModal
          referral={selectedReferral}
          onClose={() => setSelectedReferral(null)}
          onSchedule={(data) => scheduleMutation.mutate({ referralId: selectedReferral.id, data })}
          isLoading={scheduleMutation.isPending}
        />
      )}
    </div>
  );
}
