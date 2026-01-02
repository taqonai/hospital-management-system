import { useState, useEffect } from 'react';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BellAlertIcon,
  ChevronRightIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface Medication {
  id: string;
  prescriptionId: string;
  name: string;
  genericName?: string;
  dose: string;
  unit: string;
  route: string;
  frequency: string;
  scheduledTime: string;
  status: 'OVERDUE' | 'DUE_NOW' | 'UPCOMING' | 'SCHEDULED' | 'PRN_AVAILABLE';
  isPRN: boolean;
  isHighAlert: boolean;
  instructions?: string;
  prescribedBy: string;
  overdueMinutes?: number;
  minutesFromNow?: number;
}

interface MedScheduleProps {
  medications: Medication[];
  onSelectMedication: (medication: Medication) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export default function MedSchedule({
  medications,
  onSelectMedication,
  onRefresh,
  loading = false,
}: MedScheduleProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filter, setFilter] = useState<'all' | 'due' | 'prn'>('all');

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const overdueMeds = medications.filter(m => m.status === 'OVERDUE');
  const dueNowMeds = medications.filter(m => m.status === 'DUE_NOW');
  const upcomingMeds = medications.filter(m => m.status === 'UPCOMING' || m.status === 'SCHEDULED');
  const prnMeds = medications.filter(m => m.status === 'PRN_AVAILABLE');

  const getFilteredMeds = () => {
    switch (filter) {
      case 'due':
        return [...overdueMeds, ...dueNowMeds];
      case 'prn':
        return prnMeds;
      default:
        return medications.filter(m => m.status !== 'PRN_AVAILABLE');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntil = (dateString: string) => {
    const scheduled = new Date(dateString);
    const diff = scheduled.getTime() - currentTime.getTime();
    const minutes = Math.round(diff / 60000);

    if (minutes < 0) {
      return `${Math.abs(minutes)} min overdue`;
    } else if (minutes === 0) {
      return 'Now';
    } else if (minutes < 60) {
      return `in ${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `in ${hours}h ${minutes % 60}m`;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'OVERDUE':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          badge: 'bg-red-100 text-red-700',
          icon: <BellAlertIcon className="h-5 w-5 text-red-500 animate-pulse" />,
        };
      case 'DUE_NOW':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          badge: 'bg-amber-100 text-amber-700',
          icon: <ClockIcon className="h-5 w-5 text-amber-500" />,
        };
      case 'UPCOMING':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          badge: 'bg-blue-100 text-blue-700',
          icon: <ClockIcon className="h-5 w-5 text-blue-500" />,
        };
      case 'PRN_AVAILABLE':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          badge: 'bg-purple-100 text-purple-700',
          icon: <CheckCircleIcon className="h-5 w-5 text-purple-500" />,
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          badge: 'bg-gray-100 text-gray-700',
          icon: <ClockIcon className="h-5 w-5 text-gray-500" />,
        };
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Medication Schedule</h3>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          {overdueMeds.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-100 text-red-700">
              <BellAlertIcon className="h-4 w-4" />
              <span>{overdueMeds.length} Overdue</span>
            </div>
          )}
          {dueNowMeds.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              <ClockIcon className="h-4 w-4" />
              <span>{dueNowMeds.length} Due Now</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-100 text-purple-700">
            <span>{prnMeds.length} PRN</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-3">
          {(['all', 'due', 'prn'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All' : f === 'due' ? 'Due/Overdue' : 'PRN'}
            </button>
          ))}
        </div>
      </div>

      {/* Medication List */}
      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto" />
            <p className="mt-2 text-gray-500">Loading medications...</p>
          </div>
        ) : getFilteredMeds().length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto" />
            <p className="mt-2 text-gray-600 font-medium">No medications due</p>
            <p className="text-sm text-gray-500">All scheduled medications have been administered</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {getFilteredMeds().map((med) => {
              const styles = getStatusStyles(med.status);
              return (
                <button
                  key={`${med.id}-${med.scheduledTime}`}
                  onClick={() => onSelectMedication(med)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${styles.bg}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{styles.icon}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{med.name}</span>
                        {med.isHighAlert && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                            <ShieldExclamationIcon className="h-3 w-3" />
                            High Alert
                          </span>
                        )}
                        {med.isPRN && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                            PRN
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-gray-600">
                        <span className="font-medium">{med.dose}</span>
                        <span className="mx-1">-</span>
                        <span>{med.route}</span>
                        <span className="mx-1">-</span>
                        <span>{med.frequency}</span>
                      </div>

                      {med.instructions && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                          {med.instructions}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-xs">
                        {!med.isPRN && (
                          <>
                            <span className={`px-2 py-1 rounded-full ${styles.badge}`}>
                              {med.status === 'OVERDUE' && `${med.overdueMinutes} min overdue`}
                              {med.status === 'DUE_NOW' && 'Due Now'}
                              {(med.status === 'UPCOMING' || med.status === 'SCHEDULED') && getTimeUntil(med.scheduledTime)}
                            </span>
                            <span className="text-gray-500">
                              Scheduled: {formatTime(med.scheduledTime)}
                            </span>
                          </>
                        )}
                        <span className="text-gray-400">
                          by {med.prescribedBy}
                        </span>
                      </div>
                    </div>

                    <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with current time */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
        <p className="text-sm text-gray-500">
          Current time: {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
