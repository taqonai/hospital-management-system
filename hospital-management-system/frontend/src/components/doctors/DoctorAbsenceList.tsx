import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { doctorApi } from '../../services/api';
import { format, isAfter, isBefore, startOfDay } from 'date-fns';
import DoctorAbsenceForm from './DoctorAbsenceForm';
import LoadingSpinner from '../common/LoadingSpinner';

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  ANNUAL_LEAVE: 'Annual Leave',
  SICK_LEAVE: 'Sick Leave',
  CONFERENCE: 'Conference',
  TRAINING: 'Training',
  PERSONAL: 'Personal',
  EMERGENCY: 'Emergency',
  OTHER: 'Other',
};

interface DoctorAbsenceListProps {
  doctorId: string;
}

type FilterType = 'all' | 'upcoming' | 'past';

export default function DoctorAbsenceList({ doctorId }: DoctorAbsenceListProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<any>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: absences, isLoading } = useQuery({
    queryKey: ['doctor-absences', doctorId, filter],
    queryFn: async () => {
      const params: any = {};
      if (filter === 'upcoming') {
        params.upcoming = true;
      }
      const response = await doctorApi.getAbsences(doctorId, params);
      return response.data.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['doctor-absence-summary', doctorId],
    queryFn: async () => {
      const response = await doctorApi.getAbsenceSummary(doctorId);
      return response.data.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (absenceId: string) => doctorApi.cancelAbsence(doctorId, absenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-absences', doctorId] });
      queryClient.invalidateQueries({ queryKey: ['doctor-absence-summary', doctorId] });
      setCancellingId(null);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to cancel absence');
      setCancellingId(null);
    },
  });

  const handleCancel = (absenceId: string) => {
    if (window.confirm('Are you sure you want to cancel this absence? This will unblock the slots and allow appointments to be booked again.')) {
      setCancellingId(absenceId);
      cancelMutation.mutate(absenceId);
    }
  };

  const handleEdit = (absence: any) => {
    setEditingAbsence(absence);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingAbsence(null);
  };

  const today = startOfDay(new Date());

  // Filter absences based on selected filter
  const filteredAbsences = (absences || []).filter((absence: any) => {
    const endDate = new Date(absence.endDate);

    if (filter === 'upcoming') {
      return !isBefore(endDate, today);
    } else if (filter === 'past') {
      return isBefore(endDate, today);
    }
    return true;
  });

  const getStatusBadge = (absence: any) => {
    if (absence.status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          Cancelled
        </span>
      );
    }

    const startDate = new Date(absence.startDate);
    const endDate = new Date(absence.endDate);

    if (isBefore(endDate, today)) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          Past
        </span>
      );
    }

    if (isBefore(startDate, today) || format(startDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
          Active
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
        Scheduled
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      {summary && (summary.upcomingAbsences > 0 || summary.totalDaysBlocked > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {summary.upcomingAbsences} upcoming absence{summary.upcomingAbsences !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-600">
                {summary.totalDaysBlocked} day{summary.totalDaysBlocked !== 1 ? 's' : ''} blocked
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header with Filter and Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Absence
        </button>
      </div>

      {/* Absence List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : filteredAbsences.length === 0 ? (
        <div className="text-center py-8">
          <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {filter === 'upcoming'
              ? 'No upcoming absences scheduled'
              : filter === 'past'
              ? 'No past absences'
              : 'No absences found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAbsences.map((absence: any) => (
            <div
              key={absence.id}
              className={`p-4 rounded-lg border ${
                absence.status === 'CANCELLED'
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {format(new Date(absence.startDate), 'MMM d, yyyy')}
                      {format(new Date(absence.startDate), 'yyyy-MM-dd') !==
                        format(new Date(absence.endDate), 'yyyy-MM-dd') && (
                        <> - {format(new Date(absence.endDate), 'MMM d, yyyy')}</>
                      )}
                    </span>
                    {getStatusBadge(absence)}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="font-medium text-emerald-600">
                      {ABSENCE_TYPE_LABELS[absence.absenceType] || absence.absenceType}
                    </span>
                    {absence.reason && (
                      <span className="text-gray-500">- {absence.reason}</span>
                    )}
                    {!absence.isFullDay && absence.startTime && absence.endTime && (
                      <span className="text-gray-500">
                        ({absence.startTime} - {absence.endTime})
                      </span>
                    )}
                  </div>
                  {absence.notes && (
                    <p className="text-sm text-gray-500 mt-1">{absence.notes}</p>
                  )}
                </div>

                {/* Actions - only show for active absences */}
                {absence.status === 'ACTIVE' && (
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => handleEdit(absence)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleCancel(absence.id)}
                      disabled={cancellingId === absence.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Cancel"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <DoctorAbsenceForm
        doctorId={doctorId}
        absence={editingAbsence}
        isOpen={isFormOpen}
        onClose={handleCloseForm}
      />
    </div>
  );
}
