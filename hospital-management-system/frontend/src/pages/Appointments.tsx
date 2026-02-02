import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  FunnelIcon,
  CalendarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { appointmentApi } from '../services/api';
import { Appointment } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useBookingData } from '../hooks/useBookingData';
import { BookingTicket } from '../components/booking/BookingTicket';

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  SCHEDULED:   { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Pending' },
  CONFIRMED:   { bg: 'bg-green-100',  text: 'text-green-600',  label: 'Confirmed' },
  CHECKED_IN:  { bg: 'bg-amber-100',  text: 'text-amber-600',  label: 'Checked In' },
  IN_PROGRESS: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'In Progress' },
  COMPLETED:   { bg: 'bg-green-100',  text: 'text-green-600',  label: 'Completed' },
  CANCELLED:   { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Cancelled' },
  NO_SHOW:     { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'No Show' },
};

const filterTabs = [
  { label: 'All',       value: '' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Pending',   value: 'SCHEDULED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Completed', value: 'COMPLETED' },
];

function formatType(type: string) {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(time: string) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function Appointments() {
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('appointmentDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;
  const queryClient = useQueryClient();
  const { isDoctor, hasRole } = useAuth();

  const isReceptionistOrNurse = hasRole(['RECEPTIONIST', 'NURSE']) && !hasRole(['HOSPITAL_ADMIN', 'SUPER_ADMIN', 'DOCTOR']);

  const { data: bookingData, isLoading: bookingLoading, refetch: refetchBooking } = useBookingData(selectedBookingId);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['appointments', { status: statusFilter, page, sortBy, sortOrder }],
    queryFn: async () => {
      const response = await appointmentApi.getAll({
        status: statusFilter || undefined,
        page,
        limit,
        sortBy,
        sortOrder,
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
  const pagination = data?.pagination;

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleCancel = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'CANCELLED' });
  };

  const canShowEdit = (appointment: Appointment) => {
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)) return false;
    if (isReceptionistOrNurse && ['CHECKED_IN', 'IN_PROGRESS'].includes(appointment.status)) return false;
    return true;
  };

  const canShowCancel = (appointment: Appointment) => {
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW', 'IN_PROGRESS'].includes(appointment.status)) return false;
    if (isReceptionistOrNurse && ['CHECKED_IN'].includes(appointment.status)) return false;
    return true;
  };

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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <FunnelIcon className="h-5 w-5 text-gray-400" />
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === tab.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
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
              No appointments match the current filter.
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Patient</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Doctor</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Department</th>
                  {[
                    { label: 'Date', field: 'appointmentDate' },
                    { label: 'Time', field: 'startTime' },
                    { label: 'Type', field: 'type' },
                    { label: 'Status', field: 'status' },
                  ].map(col => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortBy === col.field ? (
                          sortOrder === 'asc' ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronUpDownIcon className="h-3.5 w-3.5 text-gray-300" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((appointment: Appointment) => {
                  const badge = statusBadge[appointment.status] || statusBadge.SCHEDULED;
                  return (
                    <tr
                      key={appointment.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {appointment.patient?.firstName} {appointment.patient?.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        Dr. {appointment.doctor?.user?.firstName} {appointment.doctor?.user?.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(appointment.doctor as any)?.department?.name || appointment.doctor?.specialization || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {appointment.appointmentDate
                          ? format(new Date(appointment.appointmentDate), 'yyyy-MM-dd')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatTime(appointment.startTime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatType(appointment.type)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {canShowEdit(appointment) && (
                            <Link
                              to={`/appointments/${appointment.id}/edit`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit
                            </Link>
                          )}
                          {canShowCancel(appointment) && (
                            <button
                              onClick={() => setCancelConfirm(appointment.id)}
                              className="text-sm text-red-600 hover:text-red-800 font-medium"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} appointments
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPrev}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-700">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNext}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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

      {/* View Booking Modal */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {bookingLoading ? (
              <div className="bg-white rounded-xl p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
              </div>
            ) : bookingData ? (
              <BookingTicket
                data={bookingData}
                isLoading={bookingLoading}
                onRefresh={() => refetchBooking()}
                onClose={() => setSelectedBookingId(null)}
              />
            ) : (
              <div className="bg-white rounded-xl p-8 text-center">
                <p className="text-gray-500 mb-4">Unable to load booking details</p>
                <button
                  onClick={() => setSelectedBookingId(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
