import { useState, useEffect, useCallback } from 'react';
import { opdApi } from '../../services/api';
import VitalsRecordingModal from '../../components/vitals/VitalsRecordingModal';
import type { VitalsAppointment } from '../../components/vitals/VitalsRecordingModal';
import {
  MagnifyingGlassIcon,
  UserIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface AppointmentCard {
  id: string;
  scheduledTime: string;
  status: string;
  checkedInAt?: string;
  vitalsRecordedAt?: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn?: string;
  };
  doctor?: {
    user: {
      firstName: string;
      lastName: string;
    };
    specialization?: string;
  };
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <div className="text-2xl font-bold text-gray-900">
        {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      </div>
      <div className="text-sm text-gray-500">
        {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}

function getStatusBadge(status: string, vitalsRecordedAt?: string) {
  if (vitalsRecordedAt) {
    return { label: 'VITALS DONE', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
  }
  switch (status) {
    case 'CHECKED_IN':
      return { label: 'CHECKED IN', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
    case 'CONFIRMED':
      return { label: 'CONFIRMED', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
    case 'IN_PROGRESS':
      return { label: 'IN PROGRESS', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
    case 'COMPLETED':
      return { label: 'COMPLETED', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    case 'NO_SHOW':
      return { label: 'NO SHOW', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
    default:
      return { label: status, bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  }
}

export default function NurseStation() {
  const [appointments, setAppointments] = useState<AppointmentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [vitalsModalAppointment, setVitalsModalAppointment] = useState<VitalsAppointment | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const response = await opdApi.getTodayAppointments();
      const data = response.data?.data || response.data || [];
      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 15000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  const filteredAppointments = appointments.filter((apt) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = `${apt.patient.firstName} ${apt.patient.lastName}`.toLowerCase();
    return name.includes(query) || (apt.patient.mrn?.toLowerCase().includes(query));
  });

  const handleCheckInAndVitals = async (appointment: AppointmentCard) => {
    // If vitals already recorded, do nothing
    if (appointment.vitalsRecordedAt) return;

    // If already checked in, go straight to vitals
    if (appointment.status === 'CHECKED_IN' || appointment.checkedInAt) {
      setVitalsModalAppointment(appointment);
      return;
    }

    // Check in first, then open vitals
    setCheckingIn(appointment.id);
    try {
      await opdApi.checkIn(appointment.id);
      toast.success(`${appointment.patient.firstName} ${appointment.patient.lastName} checked in`);
      await fetchAppointments();
      setVitalsModalAppointment(appointment);
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to check in patient';
      toast.error(msg);
    } finally {
      setCheckingIn(null);
    }
  };

  const getButtonState = (apt: AppointmentCard) => {
    if (apt.vitalsRecordedAt) {
      return { label: 'Vitals Recorded', disabled: true, style: 'bg-emerald-100 text-emerald-700 cursor-default' };
    }
    if (checkingIn === apt.id) {
      return { label: 'Checking in...', disabled: true, style: 'bg-purple-300 text-white cursor-wait' };
    }
    if (apt.status === 'CHECKED_IN' || apt.checkedInAt) {
      return { label: 'Record Vitals >', disabled: false, style: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700' };
    }
    return { label: 'Check-in & Vitals >', disabled: false, style: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nurse Station</h1>
          <p className="text-gray-600 mt-1">Patient check-in and vitals registration</p>
        </div>
        <LiveClock />
      </div>

      {/* Search + Today's Appointments pill */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient name or MRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-md">
          Today's Appointments ({filteredAppointments.length})
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <UserIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">
            {searchQuery ? 'No matching appointments' : 'No appointments today'}
          </h3>
          <p className="text-gray-400 mt-1">
            {searchQuery ? 'Try a different search term' : 'There are no confirmed appointments for today'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAppointments.map((apt) => {
            const badge = getStatusBadge(apt.status, apt.vitalsRecordedAt);
            const btn = getButtonState(apt);

            return (
              <div
                key={apt.id}
                className="bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow flex flex-col"
              >
                <div className="p-5 flex-1">
                  {/* Top row: icon + time + status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-purple-100 rounded-full p-2">
                        <UserIcon className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <ClockIcon className="h-4 w-4" />
                        <span className="font-medium">{formatTime(apt.scheduledTime)}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Patient name */}
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {apt.patient.firstName} {apt.patient.lastName}
                  </h3>
                  {apt.patient.mrn && (
                    <p className="text-xs text-gray-400 mb-3">MRN: {apt.patient.mrn}</p>
                  )}

                  {/* Doctor */}
                  {apt.doctor && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.772.13A18.142 18.142 0 0 1 12 21a18.142 18.142 0 0 1-7.363-1.557l-.772-.13c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                      </svg>
                      <span>Dr. {apt.doctor.user.firstName} {apt.doctor.user.lastName}</span>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <div className="px-5 pb-5">
                  <button
                    onClick={() => handleCheckInAndVitals(apt)}
                    disabled={btn.disabled}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${btn.style}`}
                  >
                    {btn.label}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vitals Recording Modal */}
      {vitalsModalAppointment && (
        <VitalsRecordingModal
          appointment={vitalsModalAppointment}
          onClose={() => setVitalsModalAppointment(null)}
          onSuccess={() => {
            setVitalsModalAppointment(null);
            fetchAppointments();
            toast.success('Vitals recorded successfully');
          }}
        />
      )}
    </div>
  );
}
