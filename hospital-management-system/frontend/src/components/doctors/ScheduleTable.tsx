import { useState } from 'react';
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';

export interface Schedule {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  isActive: boolean;
}

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
}

export default function ScheduleTable({ schedules, onChange }: ScheduleTableProps) {
  const [copyFromDay, setCopyFromDay] = useState<string | null>(null);

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
              return (
                <tr key={day.value} className={!schedule.isActive ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm font-medium ${schedule.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                      {day.label}
                    </span>
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
                    <input
                      type="time"
                      value={schedule.startTime}
                      onChange={(e) => handleScheduleChange(day.value, 'startTime', e.target.value)}
                      disabled={!schedule.isActive}
                      className="text-sm px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="time"
                      value={schedule.endTime}
                      onChange={(e) => handleScheduleChange(day.value, 'endTime', e.target.value)}
                      disabled={!schedule.isActive}
                      className="text-sm px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="time"
                      value={schedule.breakStart}
                      onChange={(e) => handleScheduleChange(day.value, 'breakStart', e.target.value)}
                      disabled={!schedule.isActive}
                      className="text-sm px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="time"
                      value={schedule.breakEnd}
                      onChange={(e) => handleScheduleChange(day.value, 'breakEnd', e.target.value)}
                      disabled={!schedule.isActive}
                      className="text-sm px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Configure which days the doctor is available for appointments. Break time slots will be excluded from booking.
      </p>
    </div>
  );
}
