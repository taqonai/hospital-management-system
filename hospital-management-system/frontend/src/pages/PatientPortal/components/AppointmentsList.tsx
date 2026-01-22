import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { Dialog, Transition } from '@headlessui/react';
import {
  CalendarDaysIcon,
  PlusIcon,
  XMarkIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { isSlotPastInUAE } from '../../../utils/timezone';

interface Appointment {
  id: string;
  doctorId: string;
  doctor?: {
    id: string;
    specialization: string;
    user?: {
      firstName: string;
      lastName: string;
    };
  };
  department?: {
    id: string;
    name: string;
  };
  appointmentDate: string;
  scheduledAt?: string;
  startTime: string;
  endTime: string;
  status: string;
  type: string;
  reason?: string;
  notes?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  specialization: string;
  departmentId?: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  SCHEDULED: { bg: 'bg-blue-100/80', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Scheduled' },
  CONFIRMED: { bg: 'bg-indigo-100/80', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Confirmed' },
  CHECKED_IN: { bg: 'bg-amber-100/80', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Checked In' },
  IN_PROGRESS: { bg: 'bg-purple-100/80', text: 'text-purple-700', dot: 'bg-purple-500 animate-pulse', label: 'In Progress' },
  COMPLETED: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-500', label: 'Completed' },
  CANCELLED: { bg: 'bg-red-100/80', text: 'text-red-700', dot: 'bg-red-500', label: 'Cancelled' },
  NO_SHOW: { bg: 'bg-gray-100/80', text: 'text-gray-700', dot: 'bg-gray-400', label: 'No Show' },
};

const DEFAULT_TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30',
];

export default function AppointmentsList() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showBookModal, setShowBookModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const queryClient = useQueryClient();

  // Book modal state
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentReason, setAppointmentReason] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  // Fetch appointments
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ['patient-appointments', activeTab, statusFilter, dateRange],
    queryFn: async () => {
      const response = await patientPortalApi.getAppointments({
        type: activeTab,
        status: statusFilter || undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      return response.data?.data || response.data || [];
    },
  });

  // Fetch departments for booking
  const { data: departments } = useQuery({
    queryKey: ['patient-portal-departments'],
    queryFn: async () => {
      const response = await patientPortalApi.getDepartments();
      return response.data?.data || response.data || [];
    },
    enabled: showBookModal,
  });

  // Fetch doctors for selected department
  const { data: doctors } = useQuery({
    queryKey: ['patient-portal-doctors', selectedDepartment],
    queryFn: async () => {
      const response = await patientPortalApi.getDoctors({
        departmentId: selectedDepartment || undefined,
      });
      return response.data?.data || response.data || [];
    },
    enabled: showBookModal && bookingStep >= 2,
  });

  // Fetch available slots for selected doctor and date
  const { data: availableSlots, isLoading: loadingSlots } = useQuery({
    queryKey: ['patient-portal-slots', selectedDoctor, selectedDate],
    queryFn: async () => {
      if (!selectedDoctor || !selectedDate) return DEFAULT_TIME_SLOTS.map(t => ({ time: t, available: true }));
      const response = await patientPortalApi.getAvailableSlots(selectedDoctor, selectedDate);
      return response.data?.data || response.data || DEFAULT_TIME_SLOTS.map(t => ({ time: t, available: true }));
    },
    enabled: showBookModal && bookingStep >= 3 && !!selectedDoctor && !!selectedDate,
  });

  // Book appointment mutation
  const bookMutation = useMutation({
    mutationFn: (data: {
      doctorId: string;
      appointmentDate: string;
      startTime: string;
      reason?: string;
      notes?: string;
    }) => patientPortalApi.bookAppointment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      toast.success('Appointment booked successfully!');
      resetBookingForm();
      setShowBookModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to book appointment');
    },
  });

  // Cancel appointment mutation
  const cancelMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      patientPortalApi.cancelAppointment(appointmentId, cancelReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      toast.success('Appointment cancelled successfully');
      setShowCancelModal(false);
      setSelectedAppointment(null);
      setCancelReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel appointment');
    },
  });

  const resetBookingForm = () => {
    setBookingStep(1);
    setSelectedDepartment('');
    setSelectedDoctor('');
    setSelectedDate('');
    setSelectedTime('');
    setAppointmentReason('');
    setAppointmentNotes('');
  };

  const handleOpenCancelModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = () => {
    if (selectedAppointment) {
      cancelMutation.mutate(selectedAppointment.id);
    }
  };

  const handleBookAppointment = () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      toast.error('Please complete all required fields');
      return;
    }

    bookMutation.mutate({
      doctorId: selectedDoctor,
      appointmentDate: `${selectedDate}T${selectedTime}:00`,
      startTime: selectedTime,
      reason: appointmentReason,
      notes: appointmentNotes,
    });
  };

  const getAppointmentDate = (appointment: Appointment) => {
    const dateStr = appointment.scheduledAt || appointment.appointmentDate;
    try {
      return parseISO(dateStr);
    } catch {
      return new Date(dateStr);
    }
  };

  const canCancel = (appointment: Appointment) => {
    return ['SCHEDULED', 'CONFIRMED'].includes(appointment.status);
  };

  // Filter appointments based on active tab
  const filteredAppointments = (appointments || []).filter((apt: Appointment) => {
    const aptDate = getAppointmentDate(apt);
    const today = startOfDay(new Date());
    if (activeTab === 'upcoming') {
      return isAfter(aptDate, today) || format(aptDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
    } else {
      return isBefore(aptDate, today) && format(aptDate, 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd');
    }
  });

  const renderAppointmentCard = (appointment: Appointment) => {
    const status = statusConfig[appointment.status] || statusConfig.SCHEDULED;
    const appointmentDate = getAppointmentDate(appointment);
    const doctorName = appointment.doctor?.user
      ? `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`
      : 'Doctor';

    return (
      <div
        key={appointment.id}
        className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Date Block */}
            <div className="flex-shrink-0 text-center min-w-[80px] p-4 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <div className="text-2xl font-bold">{format(appointmentDate, 'd')}</div>
              <div className="text-sm opacity-90">{format(appointmentDate, 'MMM')}</div>
              <div className="text-xs opacity-75 mt-1">{format(appointmentDate, 'yyyy')}</div>
            </div>

            {/* Appointment Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h3 className="font-semibold text-gray-900">{doctorName}</h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span>
                    {appointment.startTime} - {appointment.endTime}
                  </span>
                </div>

                {appointment.doctor?.specialization && (
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    <span>{appointment.doctor.specialization}</span>
                  </div>
                )}

                {appointment.department?.name && (
                  <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                    <span>{appointment.department.name}</span>
                  </div>
                )}

                {appointment.reason && (
                  <p className="text-gray-500 mt-2 line-clamp-2">
                    <span className="font-medium text-gray-700">Reason:</span> {appointment.reason}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {canCancel(appointment) && (
            <div className="flex items-center gap-2 lg:flex-shrink-0">
              <button
                onClick={() => handleOpenCancelModal(appointment)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <XCircleIcon className="h-4 w-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Appointments</h2>
            <p className="text-gray-500 mt-1">View and manage your appointments</p>
          </div>
          <button
            onClick={() => setShowBookModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            <PlusIcon className="h-5 w-5" />
            Book Appointment
          </button>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'past'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Past
            </button>
          </div>

          <div className="flex-1" />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Start Date"
            />

            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="End Date"
            />

            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              <p className="mt-4 text-gray-500">Loading appointments...</p>
            </div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
            <div className="text-center">
              <CalendarDaysIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No {activeTab} appointments
              </h3>
              <p className="text-gray-500 mb-6">
                {activeTab === 'upcoming'
                  ? "You don't have any upcoming appointments scheduled."
                  : "You don't have any past appointment history."}
              </p>
              {activeTab === 'upcoming' && (
                <button
                  onClick={() => setShowBookModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  <PlusIcon className="h-5 w-5" />
                  Book Your First Appointment
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredAppointments.map((appointment: Appointment) => renderAppointmentCard(appointment))
        )}
      </div>

      {/* Book Appointment Modal */}
      <Transition appear show={showBookModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowBookModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                  <Dialog.Title className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Book Appointment</h3>
                      <p className="text-sm text-gray-500 mt-1">Step {bookingStep} of 4</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowBookModal(false);
                        resetBookingForm();
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6 text-gray-500" />
                    </button>
                  </Dialog.Title>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
                        style={{ width: `${(bookingStep / 4) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Step 1: Select Department */}
                  {bookingStep === 1 && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Select Department</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                        {(departments || []).map((dept: Department) => (
                          <button
                            key={dept.id}
                            onClick={() => {
                              setSelectedDepartment(dept.id);
                              setBookingStep(2);
                            }}
                            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                              selectedDepartment === dept.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <BuildingOfficeIcon className="h-8 w-8 text-blue-600 mb-2" />
                            <p className="font-medium text-gray-900">{dept.name}</p>
                          </button>
                        ))}
                        {(!departments || departments.length === 0) && (
                          <div className="col-span-full text-center py-8 text-gray-500">
                            No departments available
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Select Doctor */}
                  {bookingStep === 2 && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Select Doctor</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                        {(doctors || []).map((doctor: Doctor) => (
                          <button
                            key={doctor.id}
                            onClick={() => {
                              setSelectedDoctor(doctor.id);
                              setBookingStep(3);
                            }}
                            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                              selectedDoctor === doctor.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                {(doctor.user?.firstName || 'D')[0]}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                                </p>
                                <p className="text-sm text-gray-500">{doctor.specialization}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                        {(!doctors || doctors.length === 0) && (
                          <div className="col-span-full text-center py-8 text-gray-500">
                            No doctors available in this department
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Select Date & Time */}
                  {bookingStep === 3 && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Select Date</h4>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          min={format(new Date(), 'yyyy-MM-dd')}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {selectedDate && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Select Time</h4>
                          {loadingSlots ? (
                            <div className="flex justify-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[200px] overflow-y-auto">
                              {(availableSlots || DEFAULT_TIME_SLOTS.map(t => ({ time: t, available: true })))
                                .filter((slot: TimeSlot | string) => {
                                  // Filter out past slots for today (UAE timezone)
                                  const time = typeof slot === 'string' ? slot : slot.time;
                                  return !isSlotPastInUAE(time, selectedDate, 15);
                                })
                                .map(
                                (slot: TimeSlot | string) => {
                                  const time = typeof slot === 'string' ? slot : slot.time;
                                  const isAvailable = typeof slot === 'string' ? true : slot.available;
                                  return (
                                    <button
                                      key={time}
                                      onClick={() => isAvailable && setSelectedTime(time)}
                                      disabled={!isAvailable}
                                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                        selectedTime === time
                                          ? 'bg-blue-600 text-white'
                                          : isAvailable
                                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                      }`}
                                    >
                                      {time}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {selectedTime && (
                        <button
                          onClick={() => setBookingStep(4)}
                          className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                        >
                          Continue
                        </button>
                      )}
                    </div>
                  )}

                  {/* Step 4: Reason & Confirm */}
                  {bookingStep === 4 && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Reason for Visit</h4>
                        <input
                          type="text"
                          value={appointmentReason}
                          onChange={(e) => setAppointmentReason(e.target.value)}
                          placeholder="Brief reason for the appointment"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Additional Notes (Optional)</h4>
                        <textarea
                          value={appointmentNotes}
                          onChange={(e) => setAppointmentNotes(e.target.value)}
                          placeholder="Any additional information..."
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Summary */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Appointment Summary</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Date:</span>
                            <span className="font-medium text-gray-900">
                              {selectedDate && format(new Date(selectedDate), 'MMMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Time:</span>
                            <span className="font-medium text-gray-900">{selectedTime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Doctor:</span>
                            <span className="font-medium text-gray-900">
                              {doctors?.find((d: Doctor) => d.id === selectedDoctor)?.user?.firstName
                                ? `Dr. ${doctors.find((d: Doctor) => d.id === selectedDoctor)?.user?.firstName} ${
                                    doctors.find((d: Doctor) => d.id === selectedDoctor)?.user?.lastName
                                  }`
                                : 'Selected Doctor'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleBookAppointment}
                        disabled={bookMutation.isPending}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {bookMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                            Booking...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-5 w-5" />
                            Confirm Booking
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Back Button */}
                  {bookingStep > 1 && (
                    <button
                      onClick={() => setBookingStep(bookingStep - 1)}
                      className="mt-4 w-full py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                    >
                      Go Back
                    </button>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Cancel Confirmation Modal */}
      <Transition appear show={showCancelModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCancelModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-red-100 rounded-full">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-bold text-gray-900">
                        Cancel Appointment
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">This action cannot be undone</p>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-4">
                    Are you sure you want to cancel this appointment? Please provide a reason for
                    cancellation.
                  </p>

                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation (optional)"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-6"
                  />

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowCancelModal(false);
                        setCancelReason('');
                      }}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                      Keep Appointment
                    </button>
                    <button
                      onClick={handleConfirmCancel}
                      disabled={cancelMutation.isPending}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {cancelMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Cancelling...
                        </>
                      ) : (
                        'Cancel Appointment'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
