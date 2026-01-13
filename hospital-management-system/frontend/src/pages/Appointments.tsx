import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarIcon,
  PlusIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserGroupIcon,
  CheckBadgeIcon,
  XMarkIcon,
  PlayIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { appointmentApi } from '../services/api';
import { Appointment } from '../types';
import { format, addDays, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  CONFIRMED: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  CHECKED_IN: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  IN_PROGRESS: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500 animate-pulse' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  NO_SHOW: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
};

export default function Appointments() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { isDoctor, hasRole } = useAuth();

  // Check if user can perform check-in actions (nurses, receptionists, admins - not doctors)
  const canCheckIn = hasRole(['NURSE', 'RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);

  // Only doctors and admins can start consultations
  const canStartConsultation = hasRole(['DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['appointments', { date: selectedDate, status: statusFilter }],
    queryFn: async () => {
      const response = await appointmentApi.getAll({
        date: selectedDate,
        status: statusFilter || undefined,
        limit: 50,
      });
      return response.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Status updated successfully');
      setCancelConfirm(null);
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const appointments = data?.data || [];

  const handleStatusUpdate = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleCancel = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'CANCELLED' });
  };

  const goToPrevDay = () => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'));
  const goToNextDay = () => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'));
  const goToToday = () => setSelectedDate(format(new Date(), 'yyyy-MM-dd'));

  const stats = [
    { label: 'Total', value: appointments.length, icon: CalendarIcon, color: 'bg-blue-500' },
    { label: 'Completed', value: appointments.filter((a: Appointment) => a.status === 'COMPLETED').length, icon: CheckBadgeIcon, color: 'bg-green-500' },
    { label: 'In Progress', value: appointments.filter((a: Appointment) => ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.status)).length, icon: ClockIcon, color: 'bg-amber-500' },
    { label: 'Cancelled', value: appointments.filter((a: Appointment) => a.status === 'CANCELLED').length, icon: XMarkIcon, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isDoctor() ? 'My Appointments' : 'Appointments'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isDoctor()
              ? 'View and manage your scheduled appointments'
              : 'Manage patient appointments and schedules'}
          </p>
        </div>
        <Link
          to="/appointments/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          New Appointment
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevDay}
              className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>

            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-700"
              />
            </div>

            <button
              onClick={goToNextDay}
              className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>

            <button
              onClick={goToToday}
              className="px-4 py-2.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex-1" />

          {/* Status Filter */}
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-700 cursor-pointer min-w-[160px]"
            >
              <option value="">All Status</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 px-4">
            <CalendarIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
            <p className="text-gray-500 mb-6">
              No appointments scheduled for {format(new Date(selectedDate), 'MMMM d, yyyy')}.
            </p>
            <Link
              to="/appointments/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
            >
              <PlusIcon className="h-5 w-5" />
              Schedule Appointment
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {appointments.map((appointment: Appointment) => {
              const status = statusConfig[appointment.status] || statusConfig.SCHEDULED;
              return (
                <div
                  key={appointment.id}
                  className="p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-5">
                      {/* Time Block */}
                      <div className="text-center min-w-[90px] p-3 rounded-xl bg-purple-50 border border-purple-100">
                        <div className="text-xl font-bold text-purple-600">
                          {appointment.startTime}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          to {appointment.endTime}
                        </div>
                        {appointment.tokenNumber && (
                          <div className="mt-2 text-xs font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-700">
                            Token #{appointment.tokenNumber}
                          </div>
                        )}
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
                              <span className="text-sm font-bold text-white">
                                {appointment.patient?.firstName?.[0] || 'P'}{appointment.patient?.lastName?.[0] || ''}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-900">
                              {appointment.patient?.firstName} {appointment.patient?.lastName}
                            </h3>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {appointment.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100">
                            MRN: {appointment.patient?.mrn || 'N/A'}
                          </span>
                          <span>{appointment.patient?.phone}</span>
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <UserGroupIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-700">
                            Dr. {appointment.doctor?.user?.firstName} {appointment.doctor?.user?.lastName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                            {appointment.doctor?.specialization}
                          </span>
                        </div>

                        {appointment.reason && (
                          <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="font-medium text-gray-700">Reason:</span> {appointment.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 lg:flex-shrink-0">
                      {appointment.status === 'SCHEDULED' && (
                        <>
                          {/* Check In button - only for nurses, receptionists, admins (not doctors) */}
                          {canCheckIn && (
                            <button
                              onClick={() => handleStatusUpdate(appointment.id, 'CHECKED_IN')}
                              disabled={updateStatusMutation.isPending}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              Check In
                            </button>
                          )}
                          <button
                            onClick={() => setCancelConfirm(appointment.id)}
                            disabled={updateStatusMutation.isPending}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Cancel"
                          >
                            <XCircleIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {appointment.status === 'CHECKED_IN' && canStartConsultation && (
                        <Link
                          to={`/consultation/${appointment.id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                        >
                          <PlayIcon className="h-4 w-4" />
                          Start Consultation
                        </Link>
                      )}
                      {appointment.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleStatusUpdate(appointment.id, 'COMPLETED')}
                          disabled={updateStatusMutation.isPending}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckBadgeIcon className="h-4 w-4" />
                          Complete
                        </button>
                      )}

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-200">
                        <Link
                          to={`/appointments/${appointment.id}`}
                          className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </Link>
                        <Link
                          to={`/appointments/${appointment.id}/edit`}
                          className="p-2 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </Link>
                        {!['COMPLETED', 'CANCELLED'].includes(appointment.status) && (
                          <button
                            onClick={() => setCancelConfirm(appointment.id)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Cancel"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Appointment</h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to cancel this appointment? The patient will be notified.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancelConfirm(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Keep Appointment
              </button>
              <button
                onClick={() => handleCancel(cancelConfirm)}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? 'Cancelling...' : 'Cancel Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
