import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { doctorApi } from '../../services/api';
import { format } from 'date-fns';

interface DoctorAbsenceFormProps {
  doctorId: string;
  absence?: any; // For editing
  isOpen: boolean;
  onClose: () => void;
}

const ABSENCE_REASONS = [
  'Annual Leave',
  'Sick Leave',
  'Conference',
  'Training',
  'Personal',
  'Other',
];

export default function DoctorAbsenceForm({
  doctorId,
  absence,
  isOpen,
  onClose,
}: DoctorAbsenceFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!absence;

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: 'Annual Leave',
    notes: '',
    isFullDay: true,
    startTime: '09:00',
    endTime: '17:00',
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (absence) {
      setFormData({
        startDate: format(new Date(absence.startDate), 'yyyy-MM-dd'),
        endDate: format(new Date(absence.endDate), 'yyyy-MM-dd'),
        reason: absence.reason,
        notes: absence.notes || '',
        isFullDay: absence.isFullDay,
        startTime: absence.startTime || '09:00',
        endTime: absence.endTime || '17:00',
      });
    } else {
      // Reset form for new absence
      const today = format(new Date(), 'yyyy-MM-dd');
      setFormData({
        startDate: today,
        endDate: today,
        reason: 'Annual Leave',
        notes: '',
        isFullDay: true,
        startTime: '09:00',
        endTime: '17:00',
      });
    }
    setError(null);
  }, [absence, isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => doctorApi.createAbsence(doctorId, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['doctor-absences', doctorId] });
      queryClient.invalidateQueries({ queryKey: ['doctor-absence-summary', doctorId] });
      const data = response.data?.data;
      if (data?.existingAppointments > 0) {
        alert(`Warning: There are ${data.existingAppointments} existing appointments during this absence period. Please reschedule them manually.`);
      }
      onClose();
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Failed to create absence');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { reason?: string; notes?: string }) =>
      doctorApi.updateAbsence(doctorId, absence?.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-absences', doctorId] });
      onClose();
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Failed to update absence');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isEditing) {
      updateMutation.mutate({
        reason: formData.reason,
        notes: formData.notes,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!isOpen) return null;

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Absence' : 'Add Absence'}
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date Range - only shown when creating */}
            {!isEditing && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    min={formData.startDate || format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason
              </label>
              <select
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {ABSENCE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {/* Full Day Toggle - only shown when creating */}
            {!isEditing && (
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFullDay}
                    onChange={(e) =>
                      setFormData({ ...formData, isFullDay: e.target.checked })
                    }
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Full day</span>
                </label>
              </div>
            )}

            {/* Time Range - only shown when not full day and creating */}
            {!isEditing && !formData.isFullDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                placeholder="Additional details..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Create Absence'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
