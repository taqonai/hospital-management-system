import { useState, useEffect, useCallback } from 'react';
import { DocumentDuplicateIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

export interface Schedule {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  isActive: boolean;
}

export interface ScheduleValidationError {
  dayOfWeek: string;
  field: string;
  message: string;
}

// Convert time string (HH:mm) to minutes for comparison
const timeToMinutes = (time: string): number => {
  if (!time) return -1;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Validate a single schedule
export const validateSchedule = (schedule: Schedule): ScheduleValidationError[] => {
  const errors: ScheduleValidationError[] = [];

  if (!schedule.isActive) return errors;

  const startMinutes = timeToMinutes(schedule.startTime);
  const endMinutes = timeToMinutes(schedule.endTime);
  const breakStartMinutes = timeToMinutes(schedule.breakStart);
  const breakEndMinutes = timeToMinutes(schedule.breakEnd);

  // Start Time must be < End Time
  if (startMinutes >= endMinutes) {
    errors.push({
      dayOfWeek: schedule.dayOfWeek,
      field: 'endTime',
      message: 'End time must be after start time',
    });
  }

  // Break time validations (only if at least one break field is filled)
  const hasBreakStart = schedule.breakStart && schedule.breakStart !== '';
  const hasBreakEnd = schedule.breakEnd && schedule.breakEnd !== '';

  if (hasBreakStart || hasBreakEnd) {
    // Both break times required if one is filled
    if (hasBreakStart && !hasBreakEnd) {
      errors.push({
        dayOfWeek: schedule.dayOfWeek,
        field: 'breakEnd',
        message: 'Break end time is required when break start is set',
      });
    }
    if (hasBreakEnd && !hasBreakStart) {
      errors.push({
        dayOfWeek: schedule.dayOfWeek,
        field: 'breakStart',
        message: 'Break start time is required when break end is set',
      });
    }

    if (hasBreakStart && hasBreakEnd) {
      // Break Start must be < Break End
      if (breakStartMinutes >= breakEndMinutes) {
        errors.push({
          dayOfWeek: schedule.dayOfWeek,
          field: 'breakEnd',
          message: 'Break end must be after break start',
        });
      }

      // Break Start must be > Start Time
      if (breakStartMinutes <= startMinutes) {
        errors.push({
          dayOfWeek: schedule.dayOfWeek,
          field: 'breakStart',
          message: 'Break must start after work begins',
        });
      }

      // Break End must be < End Time
      if (breakEndMinutes >= endMinutes) {
        errors.push({
          dayOfWeek: schedule.dayOfWeek,
          field: 'breakEnd',
          message: 'Break must end before work ends',
        });
      }

      // Break duration check (max 2 hours = 120 minutes)
      const breakDuration = breakEndMinutes - breakStartMinutes;
      if (breakDuration > 120) {
        errors.push({
          dayOfWeek: schedule.dayOfWeek,
          field: 'breakEnd',
          message: 'Break duration cannot exceed 2 hours',
        });
      }
    }
  }

  return errors;
};

// Validate all schedules
export const validateAllSchedules = (schedules: Schedule[]): ScheduleValidationError[] => {
  return schedules.flatMap(schedule => validateSchedule(schedule));
};

const DAYS_OF_WEEK = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

const DEFAULT_SCHEDULE: Schedule = {
  dayOfWeek: '',
  startTime: '09:00',
  endTime: '17:00',
  breakStart: '12:00',
  breakEnd: '13:00',
  isActive: true,
};

interface ScheduleTableProps {
  schedules: Schedule[];
  onChange: (schedules: Schedule[]) => void;
  onValidationChange?: (errors: ScheduleValidationError[]) => void;
}

export default function ScheduleTable({ schedules, onChange, onValidationChange }: ScheduleTableProps) {
  const [copyFromDay, setCopyFromDay] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ScheduleValidationError[]>([]);

  // Validate schedules whenever they change
  const runValidation = useCallback(() => {
    const allSchedules = DAYS_OF_WEEK.map(day =>
      schedules.find(s => s.dayOfWeek === day.value) || {
        ...DEFAULT_SCHEDULE,
        dayOfWeek: day.value,
        isActive: false,
      }
    );
    const errors = validateAllSchedules(allSchedules);
    setValidationErrors(errors);
    onValidationChange?.(errors);
  }, [schedules, onValidationChange]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  // Check if a specific field has an error
  const getFieldError = (dayOfWeek: string, field: string): string | undefined => {
    const error = validationErrors.find(e => e.dayOfWeek === dayOfWeek && e.field === field);
    return error?.message;
  };

  // Check if any field for a day has errors
  const dayHasErrors = (dayOfWeek: string): boolean => {
    return validationErrors.some(e => e.dayOfWeek === dayOfWeek);
  };

  // Initialize schedules for all days if not provided
  const getScheduleForDay = (day: string): Schedule => {
    return schedules.find(s => s.dayOfWeek === day) || {
      ...DEFAULT_SCHEDULE,
      dayOfWeek: day,
      isActive: false,
    };
  };

  const handleScheduleChange = (dayOfWeek: string, field: keyof Schedule, value: string | boolean) => {
    const existingIndex = schedules.findIndex(s => s.dayOfWeek === dayOfWeek);
    const updatedSchedules = [...schedules];

    if (existingIndex >= 0) {
      updatedSchedules[existingIndex] = {
        ...updatedSchedules[existingIndex],
        [field]: value,
      };
    } else {
      updatedSchedules.push({
        ...DEFAULT_SCHEDULE,
        dayOfWeek,
        [field]: value,
      });
    }

    onChange(updatedSchedules);
  };

  const handleCopyToAll = () => {
    if (!copyFromDay) return;

    const sourceSchedule = getScheduleForDay(copyFromDay);
    const newSchedules: Schedule[] = DAYS_OF_WEEK.map(day => ({
      ...sourceSchedule,
      dayOfWeek: day.value,
      isActive: day.value === copyFromDay ? sourceSchedule.isActive : sourceSchedule.isActive,
    }));

    onChange(newSchedules);
    setCopyFromDay(null);
  };

  const applyWeekdayDefaults = () => {
    const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const newSchedules: Schedule[] = DAYS_OF_WEEK.map(day => ({
      ...DEFAULT_SCHEDULE,
      dayOfWeek: day.value,
      isActive: weekdays.includes(day.value),
    }));
    onChange(newSchedules);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Weekly Working Schedule</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyWeekdayDefaults}
            className="text-xs px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            Apply Weekday Defaults
          </button>
          <div className="flex items-center gap-2">
            <select
              value={copyFromDay || ''}
              onChange={(e) => setCopyFromDay(e.target.value || null)}
              className="text-xs px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select day to copy</option>
              {DAYS_OF_WEEK.map(day => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCopyToAll}
              disabled={!copyFromDay}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <DocumentDuplicateIcon className="h-3.5 w-3.5" />
              Copy to all
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Day
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                End Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Break Start
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Break End
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {DAYS_OF_WEEK.map((day) => {
              const schedule = getScheduleForDay(day.value);
              const hasErrors = dayHasErrors(day.value);
              const startTimeError = getFieldError(day.value, 'startTime');
              const endTimeError = getFieldError(day.value, 'endTime');
              const breakStartError = getFieldError(day.value, 'breakStart');
              const breakEndError = getFieldError(day.value, 'breakEnd');

              return (
                <tr key={day.value} className={`${!schedule.isActive ? 'bg-gray-50' : ''} ${hasErrors ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {hasErrors && <ExclamationCircleIcon className="h-4 w-4 text-red-500" />}
                      <span className={`text-sm font-medium ${schedule.isActive ? (hasErrors ? 'text-red-700' : 'text-gray-900') : 'text-gray-400'}`}>
                        {day.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={schedule.isActive}
                      onChange={(e) => handleScheduleChange(day.value, 'isActive', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="relative">
                      <input
                        type="time"
                        value={schedule.startTime}
                        onChange={(e) => handleScheduleChange(day.value, 'startTime', e.target.value)}
                        disabled={!schedule.isActive}
                        className={`text-sm px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 ${
                          startTimeError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        title={startTimeError}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="relative">
                      <input
                        type="time"
                        value={schedule.endTime}
                        onChange={(e) => handleScheduleChange(day.value, 'endTime', e.target.value)}
                        disabled={!schedule.isActive}
                        className={`text-sm px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 ${
                          endTimeError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        title={endTimeError}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="relative">
                      <input
                        type="time"
                        value={schedule.breakStart}
                        onChange={(e) => handleScheduleChange(day.value, 'breakStart', e.target.value)}
                        disabled={!schedule.isActive}
                        className={`text-sm px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 ${
                          breakStartError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        title={breakStartError}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="relative">
                      <input
                        type="time"
                        value={schedule.breakEnd}
                        onChange={(e) => handleScheduleChange(day.value, 'breakEnd', e.target.value)}
                        disabled={!schedule.isActive}
                        className={`text-sm px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 ${
                          breakEndError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        title={breakEndError}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Validation Errors Summary */}
      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Please fix the following errors:</p>
              <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>
                    <span className="font-medium">{DAYS_OF_WEEK.find(d => d.value === error.dayOfWeek)?.label}:</span> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Configure which days the doctor is available for appointments. Break time slots will be excluded from booking.
      </p>
    </div>
  );
}
