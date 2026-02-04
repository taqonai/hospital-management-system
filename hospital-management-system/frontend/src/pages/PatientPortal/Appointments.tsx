import { useState, Fragment, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';
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
  MapPinIcon,
  PhoneIcon,
  VideoCameraIcon,
  EyeIcon,
  PencilSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import { CurrencyDisplay } from '../../components/common';
import toast from 'react-hot-toast';
import { isSlotPastInUAE, getTodayInUAE } from '../../utils/timezone';

interface Appointment {
  id: string;
  doctorId?: string;
  doctor?: {
    id: string;
    specialization: string;
    consultationFee?: number;
    user?: {
      firstName: string;
      lastName: string;
      phone?: string;
    };
    department?: {
      id: string;
      name: string;
    };
  };
  department?: {
    id: string;
    name: string;
  };
  // API returns 'date', direct queries return 'appointmentDate'
  appointmentDate?: string;
  date?: string;
  scheduledAt?: string;
  // API returns 'time', direct queries return 'startTime'
  startTime?: string;
  time?: string;
  endTime?: string;
  status: string;
  type?: string;
  reason?: string;
  notes?: string;
  location?: string;
  tokenNumber?: number;
  // API returns flat strings instead of nested objects
  doctorName?: string;
  doctorSpecialty?: string;
  departmentId?: string;
  departmentName?: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface Doctor {
  id: string;
  specialization: string;
  departmentId?: string;
  consultationFee?: number;
  user?: {
    firstName: string;
    lastName: string;
    phone?: string;
  };
  department?: {
    id: string;
    name: string;
  };
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string; icon: typeof CheckCircleIcon }> = {
  SCHEDULED: { bg: 'bg-blue-100/80', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Scheduled', icon: ClockIcon },
  CONFIRMED: { bg: 'bg-indigo-100/80', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Confirmed', icon: CheckCircleIcon },
  CHECKED_IN: { bg: 'bg-amber-100/80', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Checked In', icon: CheckCircleIcon },
  IN_PROGRESS: { bg: 'bg-purple-100/80', text: 'text-purple-700', dot: 'bg-purple-500 animate-pulse', label: 'In Progress', icon: ClockIcon },
  COMPLETED: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-500', label: 'Completed', icon: CheckCircleIcon },
  CANCELLED: { bg: 'bg-red-100/80', text: 'text-red-700', dot: 'bg-red-500', label: 'Cancelled', icon: XCircleIcon },
  NO_SHOW: { bg: 'bg-gray-100/80', text: 'text-gray-700', dot: 'bg-gray-400', label: 'No Show', icon: XCircleIcon },
};

const appointmentTypeConfig: Record<string, { icon: typeof UserIcon; label: string; color: string }> = {
  CONSULTATION: { icon: UserIcon, label: 'Consultation', color: 'text-blue-600' },
  FOLLOW_UP: { icon: ArrowPathIcon, label: 'Follow Up', color: 'text-purple-600' },
  TELEMEDICINE: { icon: VideoCameraIcon, label: 'Telemedicine', color: 'text-green-600' },
  PROCEDURE: { icon: BuildingOfficeIcon, label: 'Procedure', color: 'text-orange-600' },
  EMERGENCY: { icon: ExclamationTriangleIcon, label: 'Emergency', color: 'text-red-600' },
};

const DEFAULT_TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30',
];

export default function Appointments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showBookModal, setShowBookModal] = useState(false);
  const [showBookingChoice, setShowBookingChoice] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();

  // AI-assisted booking state
  const [aiRecommendedDepartment, setAiRecommendedDepartment] = useState('');
  const [aiSymptomsSummary, setAiSymptomsSummary] = useState('');
  const [isAiGuidedBooking, setIsAiGuidedBooking] = useState(false);

  // Booking mode: 'emergency' | 'quick' | 'standard'
  const [bookingMode, setBookingMode] = useState<'emergency' | 'quick' | 'standard'>('standard');

  // Book modal state
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('CONSULTATION');
  const [appointmentReason, setAppointmentReason] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  // Handle URL params from symptom checker
  useEffect(() => {
    const shouldBook = searchParams.get('book');
    const department = searchParams.get('department');
    const symptoms = searchParams.get('symptoms');
    const urgency = searchParams.get('urgency');

    if (shouldBook === 'true') {
      setShowBookModal(true);
      setIsAiGuidedBooking(true);

      if (department) {
        setAiRecommendedDepartment(department);
        setAppointmentReason(`AI-recommended consultation for: ${department}`);
      }
      if (symptoms) {
        setAiSymptomsSummary(symptoms);
        setAppointmentNotes(`Symptoms: ${symptoms}`);
      }
      if (urgency) {
        setAppointmentNotes(prev => prev + `\nUrgency level: ${urgency}`);
      }

      // Clear the URL params
      setSearchParams({});
    }

  }, [searchParams, setSearchParams]);

  // Reschedule state
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Per-doctor slots for Emergency and Quick booking modes
  const [doctorSlotsMap, setDoctorSlotsMap] = useState<Record<string, { slots: TimeSlot[]; loading: boolean }>>({});

  // Fetch appointments
  const { data: appointmentsData, isLoading, refetch } = useQuery({
    queryKey: ['patient-appointments-page', activeTab, statusFilter, dateRange, currentPage],
    queryFn: async () => {
      const response = await patientPortalApi.getAppointments({
        type: activeTab,
        status: statusFilter || undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        page: currentPage,
        limit: itemsPerPage,
      });
      // API returns: {"success":true,"data":{"data":[...appointments...],"pagination":{...}}}
      // response.data = {"success":true,"data":{"data":[...],"pagination":{...}}}
      // response.data.data = {"data":[...],"pagination":{...}}
      // response.data.data.data = [...appointments...]
      return response.data?.data?.data || response.data?.data || response.data || [];
    },
  });

  const appointments = Array.isArray(appointmentsData) ? appointmentsData : [];

  // Fetch departments for booking
  const { data: departments } = useQuery({
    queryKey: ['patient-portal-departments'],
    queryFn: async () => {
      const response = await patientPortalApi.getDepartments();
      return response.data?.data || response.data || [];
    },
    enabled: showBookModal,
  });

  // Fetch doctors for selected department - always filter by department
  const { data: doctors, refetch: refetchDoctors } = useQuery({
    queryKey: ['patient-portal-doctors', selectedDepartment],
    queryFn: async () => {
      // Only fetch if we have a department selected (except for emergency mode which may not have one)
      const deptId = selectedDepartment || undefined;
      const response = await patientPortalApi.getDoctors({
        departmentId: deptId,
      });
      const doctorsList = response.data?.data || response.data || [];
      // Client-side fallback filter: ensure only doctors from selected department are shown
      // This handles cases where the API might not filter correctly or returns cached data
      if (selectedDepartment) {
        return doctorsList.filter((d: Doctor) =>
          d.department?.id === selectedDepartment || d.departmentId === selectedDepartment
        );
      }
      return doctorsList;
    },
    enabled: showBookModal && (bookingStep >= 2 || bookingMode === 'emergency'),
    // Ensure fresh data when department changes - don't use stale cached data
    staleTime: 0,
  });

  // Fetch slots for a specific doctor (used in Emergency and Quick modes)
  const fetchDoctorSlots = async (doctorId: string, date: string) => {
    if (!doctorId || !date) return;

    // Mark as loading
    setDoctorSlotsMap(prev => ({
      ...prev,
      [doctorId]: { slots: [], loading: true }
    }));

    try {
      const response = await patientPortalApi.getAvailableSlots(doctorId, date);
      const slots = response.data?.data || response.data || [];
      setDoctorSlotsMap(prev => ({
        ...prev,
        [doctorId]: { slots, loading: false }
      }));
    } catch (error) {
      console.error('Failed to fetch slots for doctor:', doctorId, error);
      setDoctorSlotsMap(prev => ({
        ...prev,
        [doctorId]: { slots: [], loading: false }
      }));
    }
  };

  // Fetch slots for all visible doctors when in Emergency/Quick mode
  // Combined reset + fetch into a single effect to avoid race condition where
  // the reset effect clears doctorSlotsMap but the fetch effect reads stale closure data.
  useEffect(() => {
    if (!showBookModal) return;
    if (bookingMode !== 'emergency' && bookingMode !== 'quick') return;
    if (!doctors || doctors.length === 0) return;

    const dateToUse = bookingMode === 'emergency' ? getTodayInUAE() : selectedDate;
    if (!dateToUse) return;

    // Clear previous slots and fetch fresh for all doctors
    setDoctorSlotsMap({});
    doctors.forEach((doctor: Doctor) => {
      fetchDoctorSlots(doctor.id, dateToUse);
    });
  }, [showBookModal, bookingMode, doctors, selectedDate]);

  // Fetch available slots for selected doctor and date (handles both booking and rescheduling)
  const slotsDoctorId = showRescheduleModal ? selectedAppointment?.doctorId : selectedDoctor;
  const slotsDate = showRescheduleModal ? rescheduleDate : selectedDate;

  const { data: availableSlots, isLoading: loadingSlots } = useQuery({
    queryKey: ['patient-portal-slots', slotsDoctorId, slotsDate],
    queryFn: async () => {
      if (!slotsDoctorId || !slotsDate) return [];
      const response = await patientPortalApi.getAvailableSlots(slotsDoctorId, slotsDate);
      return response.data?.data || response.data || [];
    },
    enabled: (showBookModal && bookingStep >= 3 && !!selectedDoctor && !!selectedDate) ||
             (showRescheduleModal && !!selectedAppointment?.doctorId && !!rescheduleDate),
  });

  // Success state for showing booking confirmation
  const [bookingSuccess, setBookingSuccess] = useState<{
    show: boolean;
    appointment?: any;
  }>({ show: false });

  // Book appointment mutation
  const bookMutation = useMutation({
    mutationFn: (data: {
      doctorId: string;
      appointmentDate: string;
      appointmentTime: string;
      type?: string;
      reason?: string;
      notes?: string;
    }) => patientPortalApi.bookAppointment(data),
    onSuccess: async (response) => {
      // Force immediate refetch of appointments - use exact: false to match all queries starting with this key
      await queryClient.invalidateQueries({
        queryKey: ['patient-appointments-page'],
        exact: false,
        refetchType: 'all'
      });
      await queryClient.invalidateQueries({
        queryKey: ['patient-portal-summary'],
        exact: false,
        refetchType: 'all'
      });

      // Get appointment data from response
      const appointmentData = response.data?.data || response.data;

      // Show success with appointment details
      setShowBookModal(false);
      setBookingSuccess({
        show: true,
        appointment: appointmentData,
      });

      toast.success('Appointment booked successfully!');
      resetBookingForm();
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
      queryClient.invalidateQueries({ queryKey: ['patient-appointments-page'] });
      queryClient.invalidateQueries({ queryKey: ['patient-portal-summary'] });
      toast.success('Appointment cancelled successfully');
      setShowCancelModal(false);
      setSelectedAppointment(null);
      setCancelReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel appointment');
    },
  });

  // Reschedule appointment mutation
  const rescheduleMutation = useMutation({
    mutationFn: ({ appointmentId, data }: { appointmentId: string; data: { appointmentDate: string; startTime: string } }) =>
      patientPortalApi.rescheduleAppointment(appointmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-appointments-page'] });
      queryClient.invalidateQueries({ queryKey: ['patient-portal-summary'] });
      toast.success('Appointment rescheduled successfully');
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      setRescheduleDate('');
      setRescheduleTime('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reschedule appointment');
    },
  });

  const resetBookingForm = () => {
    setBookingStep(1);
    setSelectedDepartment('');
    setSelectedDoctor('');
    setSelectedDate('');
    setSelectedTime('');
    setAppointmentType('CONSULTATION');
    setAppointmentReason('');
    setAppointmentNotes('');
    setIsAiGuidedBooking(false);
    setAiRecommendedDepartment('');
    setAiSymptomsSummary('');
    setBookingMode('standard');
  };

  // EMERGENCY BOOKING - Auto-select Emergency dept, today's date, show available slots immediately
  const handleStartEmergencyBooking = () => {
    setShowBookingChoice(false);
    resetBookingForm();
    setBookingMode('emergency');
    setAppointmentType('EMERGENCY');
    setAppointmentReason('Emergency consultation');
    setSelectedDate(getTodayInUAE());
    // Find Emergency department
    const emergencyDept = (departments || []).find((d: Department) =>
      d.name.toLowerCase().includes('emergency')
    );
    if (emergencyDept) {
      setSelectedDepartment(emergencyDept.id);
    }
    setShowBookModal(true);
  };

  // QUICK BOOKING - Streamlined flow
  const handleStartQuickBooking = () => {
    setShowBookingChoice(false);
    resetBookingForm();
    setBookingMode('quick');
    setSelectedDate(getTodayInUAE());
    setShowBookModal(true);
  };

  const handleStartDirectBooking = () => {
    setShowBookingChoice(false);
    resetBookingForm();
    setBookingMode('standard');
    setShowBookModal(true);
    setIsAiGuidedBooking(false);
  };

  const handleStartAiGuidedBooking = () => {
    setShowBookingChoice(false);
    // Navigate to symptom checker with autoStart to immediately begin the session
    window.location.href = '/patient-portal/symptom-checker?autoStart=true';
  };

  // Handle booking type from dashboard navigation (?booking=emergency|quick|standard)
  useEffect(() => {
    const bookingType = searchParams.get('booking');
    if (bookingType) {
      setSearchParams({});
      if (bookingType === 'emergency') {
        handleStartEmergencyBooking();
      } else if (bookingType === 'quick') {
        handleStartQuickBooking();
      } else if (bookingType === 'standard') {
        handleStartDirectBooking();
      }
    }
  }, []); // Run once on mount

  const handleOpenCancelModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancelModal(true);
  };

  const handleOpenRescheduleModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleDate('');
    setRescheduleTime('');
    setShowRescheduleModal(true);
  };

  const handleOpenDetailModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailModal(true);
  };

  const handleConfirmCancel = () => {
    if (selectedAppointment) {
      cancelMutation.mutate(selectedAppointment.id);
    }
  };

  const handleConfirmReschedule = () => {
    if (selectedAppointment && rescheduleDate && rescheduleTime) {
      rescheduleMutation.mutate({
        appointmentId: selectedAppointment.id,
        data: {
          appointmentDate: `${rescheduleDate}T${rescheduleTime}:00`,
          startTime: rescheduleTime,
        },
      });
    }
  };

  const handleBookAppointment = () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      toast.error('Please complete all required fields');
      return;
    }

    bookMutation.mutate({
      doctorId: selectedDoctor,
      appointmentDate: selectedDate,
      appointmentTime: selectedTime,
      type: appointmentType || 'CONSULTATION',
      reason: appointmentReason || `${bookingMode === 'emergency' ? 'Emergency' : 'Regular'} consultation`,
      notes: appointmentNotes,
    });
  };

  const getAppointmentDate = (appointment: Appointment) => {
    // Handle both API format (date) and direct format (appointmentDate)
    const dateStr = appointment.scheduledAt || appointment.appointmentDate || appointment.date;
    if (!dateStr) return new Date();
    try {
      return parseISO(dateStr);
    } catch {
      return new Date(dateStr);
    }
  };

  // Helper to get doctor name from either format
  const getDoctorName = (appointment: Appointment) => {
    if (appointment.doctorName) {
      return appointment.doctorName;
    }
    if (appointment.doctor?.user) {
      return `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
    }
    return 'Doctor';
  };

  // Helper to get appointment time from either format
  const getAppointmentTime = (appointment: Appointment) => {
    return appointment.startTime || appointment.time || '';
  };

  // Helper to get doctor specialty from either format
  const getDoctorSpecialty = (appointment: Appointment) => {
    return appointment.doctorSpecialty || appointment.doctor?.specialization || '';
  };

  // Helper to get department name from either format
  const getDepartmentName = (appointment: Appointment) => {
    return appointment.departmentName || appointment.department?.name || appointment.doctor?.department?.name || '';
  };

  const canCancel = (appointment: Appointment) => {
    return ['SCHEDULED', 'CONFIRMED'].includes(appointment.status);
  };

  const canReschedule = (appointment: Appointment) => {
    return ['SCHEDULED', 'CONFIRMED'].includes(appointment.status);
  };

  // Filter appointments based on search (API already filters by type/tab)
  const filteredAppointments = appointments.filter((apt: Appointment) => {
    // Note: The API already filters by type (upcoming/past), so we don't need
    // to do client-side tab filtering. This allows today's past appointments
    // to show correctly in the past tab.

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      // Handle both API format (doctorName, departmentName) and direct format
      const doctorNameStr = getDoctorName(apt).toLowerCase();
      const deptName = getDepartmentName(apt).toLowerCase();
      const specialty = getDoctorSpecialty(apt).toLowerCase();
      const reason = apt.reason?.toLowerCase() || '';

      if (!doctorNameStr.includes(searchLower) &&
          !deptName.includes(searchLower) &&
          !specialty.includes(searchLower) &&
          !reason.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderAppointmentCard = (appointment: Appointment) => {
    const status = statusConfig[appointment.status] || statusConfig.SCHEDULED;
    const typeConfig = appointmentTypeConfig[appointment.type || 'CONSULTATION'] || appointmentTypeConfig.CONSULTATION;
    const appointmentDate = getAppointmentDate(appointment);
    const doctorName = getDoctorName(appointment);
    const appointmentTime = getAppointmentTime(appointment);
    const doctorSpecialty = getDoctorSpecialty(appointment);
    const TypeIcon = typeConfig.icon;
    const StatusIcon = status.icon;

    return (
      <div
        key={appointment.id}
        className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
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
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${typeConfig.color}`}>
                  <TypeIcon className="h-3.5 w-3.5" />
                  {typeConfig.label}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span>{appointmentTime}{appointment.endTime ? ` - ${appointment.endTime}` : ''}</span>
                </div>

                {doctorSpecialty && (
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    <span>{doctorSpecialty}</span>
                  </div>
                )}

                {getDepartmentName(appointment) && (
                  <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                    <span>{getDepartmentName(appointment)}</span>
                  </div>
                )}

                {appointment.location && (
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 text-gray-400" />
                    <span>{appointment.location}</span>
                  </div>
                )}

                {appointment.tokenNumber && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      Token #{appointment.tokenNumber}
                    </span>
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
          <div className="flex items-center gap-2 lg:flex-shrink-0 flex-wrap">
            <button
              onClick={() => handleOpenDetailModal(appointment)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <EyeIcon className="h-4 w-4" />
              Details
            </button>

            {canReschedule(appointment) && (
              <button
                onClick={() => handleOpenRescheduleModal(appointment)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <PencilSquareIcon className="h-4 w-4" />
                Reschedule
              </button>
            )}

            {canCancel(appointment) && (
              <button
                onClick={() => handleOpenCancelModal(appointment)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <XCircleIcon className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
              <p className="text-gray-500 mt-1">View, book, and manage your appointments</p>
            </div>
            {/* Only show Book Appointment button if user has upcoming appointments */}
            {!isLoading && paginatedAppointments.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowBookingChoice(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <PlusIcon className="h-5 w-5" />
                  Book Appointment
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search, Tabs and Filters */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by doctor name, department, or reason..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Tabs */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => { setActiveTab('upcoming'); setCurrentPage(1); }}
                  className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'upcoming'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => { setActiveTab('past'); setCurrentPage(1); }}
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
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
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
                  onChange={(e) => { setDateRange({ ...dateRange, startDate: e.target.value }); setCurrentPage(1); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />

                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => { setDateRange({ ...dateRange, endDate: e.target.value }); setCurrentPage(1); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
          ) : paginatedAppointments.length === 0 ? (
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
                    onClick={() => setShowBookingChoice(true)}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Book Your First Appointment
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {paginatedAppointments.map((appointment: Appointment) => renderAppointmentCard(appointment))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Booking Choice Modal */}
        <Transition appear show={showBookingChoice} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowBookingChoice(false)}>
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
                  <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                    <Dialog.Title className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Book Appointment</h3>
                        <p className="text-sm text-gray-500 mt-1">Choose how you'd like to proceed</p>
                      </div>
                      <button
                        onClick={() => setShowBookingChoice(false)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <XMarkIcon className="h-6 w-6 text-gray-500" />
                      </button>
                    </Dialog.Title>

                    <div className="space-y-3">
                      {/* Emergency Booking - ONE CLICK */}
                      <button
                        onClick={handleStartEmergencyBooking}
                        className="w-full p-5 rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 hover:shadow-xl transition-all text-left group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 backdrop-blur rounded-xl text-white">
                            <ExclamationTriangleIcon className="h-8 w-8" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-lg">Emergency</h4>
                              <span className="px-2 py-0.5 text-xs font-bold bg-white text-red-600 rounded-full animate-pulse">INSTANT</span>
                            </div>
                            <p className="text-sm text-red-100 mt-1">
                              One-click booking for urgent care today
                            </p>
                          </div>
                          <ChevronRightIcon className="h-6 w-6 text-white/80" />
                        </div>
                      </button>

                      {/* Quick Booking - 2 STEPS */}
                      <button
                        onClick={handleStartQuickBooking}
                        className="w-full p-5 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 hover:shadow-xl transition-all text-left group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 backdrop-blur rounded-xl text-white">
                            <ClockIcon className="h-8 w-8" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-lg">Quick Book</h4>
                              <span className="px-2 py-0.5 text-xs font-bold bg-white text-blue-600 rounded-full">2 STEPS</span>
                            </div>
                            <p className="text-sm text-blue-100 mt-1">
                              Select department → Pick doctor & time
                            </p>
                          </div>
                          <ChevronRightIcon className="h-6 w-6 text-white/80" />
                        </div>
                      </button>

                      {/* AI-Guided Option */}
                      <button
                        onClick={handleStartAiGuidedBooking}
                        className="w-full p-4 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 hover:border-purple-400 hover:shadow-lg transition-all text-left group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white shadow-lg group-hover:scale-110 transition-transform">
                            <SparklesIcon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">AI-Guided</h4>
                              <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Smart</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Unsure which doctor? AI recommends based on symptoms
                            </p>
                          </div>
                          <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-purple-500" />
                        </div>
                      </button>

                      {/* Standard Booking - Full Steps */}
                      <button
                        onClick={handleStartDirectBooking}
                        className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all text-left"
                      >
                        <div className="flex items-center justify-center gap-2 text-gray-600">
                          <CalendarDaysIcon className="h-5 w-5" />
                          <span className="text-sm font-medium">Standard Booking (4 steps)</span>
                        </div>
                      </button>
                    </div>

                    {/* Info Banner */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-start gap-3">
                        <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-700">
                          <p className="font-medium">Not sure which option to choose?</p>
                          <p className="mt-1">The AI-Guided Booking helps identify the best specialist for your needs based on your symptoms.</p>
                        </div>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

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
                  <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                    {/* Mode-specific Header */}
                    {bookingMode === 'emergency' && (
                      <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="h-8 w-8 text-white" />
                            <div>
                              <h3 className="text-xl font-bold text-white">Emergency Booking</h3>
                              <p className="text-sm text-red-100">Select available doctor & time slot</p>
                            </div>
                          </div>
                          <button
                            onClick={() => { setShowBookModal(false); resetBookingForm(); }}
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            <XMarkIcon className="h-6 w-6 text-white" />
                          </button>
                        </div>
                      </div>
                    )}
                    {bookingMode === 'quick' && (
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ClockIcon className="h-8 w-8 text-white" />
                            <div>
                              <h3 className="text-xl font-bold text-white">Quick Booking</h3>
                              <p className="text-sm text-blue-100">Step {bookingStep === 1 ? '1: Select Department' : '2: Pick Doctor & Time'}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => { setShowBookModal(false); resetBookingForm(); }}
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            <XMarkIcon className="h-6 w-6 text-white" />
                          </button>
                        </div>
                      </div>
                    )}
                    {bookingMode === 'standard' && (
                      <div className="px-6 pt-6">
                        <Dialog.Title className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">Book Appointment</h3>
                            <p className="text-sm text-gray-500 mt-1">Step {bookingStep} of 4</p>
                          </div>
                          <button
                            onClick={() => { setShowBookModal(false); resetBookingForm(); }}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <XMarkIcon className="h-6 w-6 text-gray-500" />
                          </button>
                        </Dialog.Title>
                        {/* Progress Bar for standard mode */}
                        <div className="mb-2">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
                              style={{ width: `${(bookingStep / 4) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-6">

                    {/* EMERGENCY MODE - All in one view */}
                    {bookingMode === 'emergency' && (
                      <div className="space-y-4">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 text-red-700">
                            <CalendarDaysIcon className="h-5 w-5" />
                            <span className="font-medium">Today: {format(new Date(), 'MMMM d, yyyy')}</span>
                          </div>
                        </div>

                        <h4 className="font-semibold text-gray-900">Select Doctor & Time</h4>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {(doctors || []).map((doctor: Doctor) => (
                            <div
                              key={doctor.id}
                              className={`p-4 rounded-xl border-2 transition-all ${
                                selectedDoctor === doctor.id
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
                                  {(doctor.user?.firstName || 'D')[0]}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500">{doctor.specialization}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {doctorSlotsMap[doctor.id]?.loading ? (
                                  <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                                    Loading slots...
                                  </div>
                                ) : (doctorSlotsMap[doctor.id]?.slots || [])
                                  .filter((slot: TimeSlot) => slot.available && !isSlotPastInUAE(slot.time, getTodayInUAE(), 15))
                                  .slice(0, 8)
                                  .map((slot: TimeSlot) => (
                                  <button
                                    key={`${doctor.id}-${slot.time}`}
                                    onClick={() => {
                                      setSelectedDoctor(doctor.id);
                                      setSelectedTime(slot.time);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                      selectedDoctor === doctor.id && selectedTime === slot.time
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'
                                    }`}
                                  >
                                    {slot.time}
                                  </button>
                                ))}
                                {!doctorSlotsMap[doctor.id]?.loading && (doctorSlotsMap[doctor.id]?.slots || []).filter((s: TimeSlot) => s.available).length === 0 && (
                                  <span className="text-gray-400 text-sm py-2">No slots available today</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {(!doctors || doctors.length === 0) && (
                            <div className="text-center py-8">
                              <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-amber-400 mb-3" />
                              <p className="text-gray-700 font-medium">No doctors available for emergency</p>
                              <p className="text-gray-500 text-sm mt-1">Please try Quick Booking or select a different department</p>
                            </div>
                          )}
                        </div>

                        {/* Reason field for Emergency */}
                        {selectedDoctor && selectedTime && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason for Emergency Visit *
                              </label>
                              <textarea
                                value={appointmentReason}
                                onChange={(e) => setAppointmentReason(e.target.value)}
                                placeholder="Describe your emergency symptoms or reason..."
                                rows={2}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all text-sm"
                              />
                            </div>
                            <button
                              onClick={handleBookAppointment}
                              disabled={bookMutation.isPending}
                              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold text-lg hover:from-red-700 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                            >
                              {bookMutation.isPending ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                  Booking...
                                </>
                              ) : (
                                <>
                                  <CheckCircleIcon className="h-6 w-6" />
                                  Book Emergency Appointment
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* QUICK MODE - Step 2: Doctor + Time combined */}
                    {bookingMode === 'quick' && bookingStep === 2 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => { setBookingStep(1); setSelectedDoctor(''); setSelectedTime(''); }}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <ChevronLeftIcon className="h-4 w-4" />
                            Change Department
                          </button>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              min={getTodayInUAE()}
                              max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-3 max-h-[350px] overflow-y-auto">
                          {(doctors || []).map((doctor: Doctor) => (
                            <div
                              key={doctor.id}
                              className={`p-4 rounded-xl border-2 transition-all ${
                                selectedDoctor === doctor.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                                  {(doctor.user?.firstName || 'D')[0]}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                                  </p>
                                  <p className="text-xs text-gray-500">{doctor.specialization} • <CurrencyDisplay amount={doctor.consultationFee} /></p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {!selectedDate ? (
                                  <span className="text-gray-400 text-xs py-1">Select a date to see available slots</span>
                                ) : doctorSlotsMap[doctor.id]?.loading ? (
                                  <div className="flex items-center gap-2 text-gray-500 text-xs py-1">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                                    Loading...
                                  </div>
                                ) : (doctorSlotsMap[doctor.id]?.slots || [])
                                  .filter((slot: TimeSlot) => slot.available && !isSlotPastInUAE(slot.time, selectedDate, 15))
                                  .map((slot: TimeSlot) => (
                                  <button
                                    key={`${doctor.id}-${slot.time}`}
                                    onClick={() => {
                                      setSelectedDoctor(doctor.id);
                                      setSelectedTime(slot.time);
                                    }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                      selectedDoctor === doctor.id && selectedTime === slot.time
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                                    }`}
                                  >
                                    {slot.time}
                                  </button>
                                ))}
                                {selectedDate && !doctorSlotsMap[doctor.id]?.loading && (doctorSlotsMap[doctor.id]?.slots || []).filter((s: TimeSlot) => s.available).length === 0 && (
                                  <span className="text-gray-400 text-xs py-1">No slots available</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {(!doctors || doctors.length === 0) && (
                            <div className="text-center py-8">
                              <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-amber-400 mb-3" />
                              <p className="text-gray-700 font-medium">No doctors available</p>
                              <p className="text-gray-500 text-sm mt-1">No doctors found for this department. Please select a different department or try another date.</p>
                            </div>
                          )}
                        </div>

                        {/* Reason field for Quick Booking */}
                        {selectedDoctor && selectedTime && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason for Visit (Optional)
                              </label>
                              <textarea
                                value={appointmentReason}
                                onChange={(e) => setAppointmentReason(e.target.value)}
                                placeholder="Describe your reason for the appointment..."
                                rows={2}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm"
                              />
                            </div>
                            <button
                              onClick={handleBookAppointment}
                              disabled={bookMutation.isPending}
                              className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-lg hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                            >
                              {bookMutation.isPending ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                  Booking...
                                </>
                              ) : (
                                <>
                                  <CheckCircleIcon className="h-6 w-6" />
                                  Confirm Booking
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 1: Select Department (for Quick and Standard modes) */}
                    {bookingStep === 1 && bookingMode !== 'emergency' && (
                      <div className="space-y-4">
                        {/* AI Recommendation Banner */}
                        {isAiGuidedBooking && aiRecommendedDepartment && (
                          <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <SparklesIcon className="h-5 w-5 text-purple-600" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-purple-900">AI Recommendation</p>
                                <p className="text-sm text-purple-700 mt-1">
                                  Based on your symptoms, we recommend: <strong>{aiRecommendedDepartment}</strong>
                                </p>
                                {aiSymptomsSummary && (
                                  <p className="text-xs text-purple-600 mt-2">
                                    Symptoms: {aiSymptomsSummary}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <h4 className="font-semibold text-gray-900">Select Department</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                          {(departments || []).map((dept: Department) => {
                            const isRecommended = aiRecommendedDepartment &&
                              dept.name.toLowerCase().includes(aiRecommendedDepartment.toLowerCase());
                            return (
                              <button
                                key={dept.id}
                                onClick={() => { setSelectedDepartment(dept.id); setSelectedDoctor(''); setBookingStep(2); }}
                                className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md relative ${
                                  selectedDepartment === dept.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : isRecommended
                                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {isRecommended && (
                                  <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-purple-600 text-white text-xs font-medium rounded-full">
                                    AI Pick
                                  </span>
                                )}
                                <BuildingOfficeIcon className={`h-8 w-8 mb-2 ${isRecommended ? 'text-purple-600' : 'text-blue-600'}`} />
                                <p className="font-medium text-gray-900">{dept.name}</p>
                                {dept.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{dept.description}</p>
                                )}
                              </button>
                            );
                          })}
                          {(!departments || departments.length === 0) && (
                            <div className="col-span-full text-center py-8 text-gray-500">
                              No departments available
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Step 2: Select Doctor (Standard mode only) */}
                    {bookingStep === 2 && bookingMode === 'standard' && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900">Select Doctor</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                          {(doctors || []).map((doctor: Doctor) => (
                            <button
                              key={doctor.id}
                              onClick={() => { setSelectedDoctor(doctor.id); setBookingStep(3); }}
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
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500">{doctor.specialization}</p>
                                  {doctor.consultationFee && (
                                    <p className="text-sm text-green-600 font-medium">
                                      Fee: <CurrencyDisplay amount={doctor.consultationFee} />
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                          {(!doctors || doctors.length === 0) && (
                            <div className="col-span-full text-center py-8">
                              <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-amber-400 mb-3" />
                              <p className="text-gray-700 font-medium">No doctors available</p>
                              <p className="text-gray-500 text-sm mt-1">No doctors found for this department. Please select a different department.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Step 3: Select Date & Time (Standard mode only) */}
                    {bookingStep === 3 && bookingMode === 'standard' && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Select Date</h4>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={getTodayInUAE()}
                            max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
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
                            ) : (availableSlots || []).length === 0 ? (
                              <div className="text-center py-6">
                                <ClockIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                                <p className="text-gray-500 text-sm">No available slots for this date</p>
                                <p className="text-gray-400 text-xs mt-1">Doctor may be on leave or fully booked. Try another date.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[200px] overflow-y-auto">
                                {(availableSlots || [])
                                  .filter((slot: TimeSlot) => !isSlotPastInUAE(slot.time, selectedDate, 15))
                                  .map((slot: TimeSlot) => (
                                      <button
                                        key={slot.time}
                                        onClick={() => slot.available && setSelectedTime(slot.time)}
                                        disabled={!slot.available}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                          selectedTime === slot.time
                                            ? 'bg-blue-600 text-white'
                                            : slot.available
                                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            : 'bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                                        }`}
                                      >
                                        {slot.time}
                                      </button>
                                    )
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

                    {/* Step 4: Appointment Type, Reason & Confirm (Standard mode only) */}
                    {bookingStep === 4 && bookingMode === 'standard' && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Appointment Type</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(appointmentTypeConfig).map(([type, config]) => {
                              const TypeIcon = config.icon;
                              return (
                                <button
                                  key={type}
                                  onClick={() => setAppointmentType(type)}
                                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                    appointmentType === type
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <TypeIcon className={`h-5 w-5 ${config.color}`} />
                                  <span className="text-sm font-medium text-gray-900">{config.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

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
                            placeholder="Any additional information for the doctor..."
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
                            <div className="flex justify-between">
                              <span className="text-gray-500">Type:</span>
                              <span className="font-medium text-gray-900">
                                {appointmentTypeConfig[appointmentType]?.label}
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

                    {/* Back Button (Standard mode only) */}
                    {bookingStep > 1 && bookingMode === 'standard' && (
                      <button
                        onClick={() => setBookingStep(bookingStep - 1)}
                        className="mt-4 w-full py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                      >
                        Go Back
                      </button>
                    )}
                    </div>
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
                      Are you sure you want to cancel this appointment? Please provide a reason for cancellation.
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
                        onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
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

        {/* Reschedule Modal */}
        <Transition appear show={showRescheduleModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowRescheduleModal(false)}>
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
                    <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">
                      Reschedule Appointment
                    </Dialog.Title>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Date</label>
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          min={getTodayInUAE()}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {rescheduleDate && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">New Time</label>
                          {loadingSlots ? (
                            <div className="flex justify-center py-6">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                            </div>
                          ) : (availableSlots || []).length === 0 ? (
                            <div className="text-center py-4">
                              <p className="text-gray-500 text-sm">No slots available for this date</p>
                              <p className="text-gray-400 text-xs mt-1">Try selecting a different date</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 gap-2 max-h-[150px] overflow-y-auto">
                              {(availableSlots || [])
                                .filter((slot: TimeSlot) => slot.available && !isSlotPastInUAE(slot.time, rescheduleDate, 15))
                                .map((slot: TimeSlot) => (
                                <button
                                  key={slot.time}
                                  onClick={() => setRescheduleTime(slot.time)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                    rescheduleTime === slot.time
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {slot.time}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => { setShowRescheduleModal(false); setRescheduleDate(''); setRescheduleTime(''); }}
                        className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmReschedule}
                        disabled={!rescheduleDate || !rescheduleTime || rescheduleMutation.isPending}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {rescheduleMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            Rescheduling...
                          </>
                        ) : (
                          'Confirm Reschedule'
                        )}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Appointment Details Modal */}
        <Transition appear show={showDetailModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowDetailModal(false)}>
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
                  <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                    {selectedAppointment && (
                      <>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-white">Appointment Details</h3>
                              <p className="text-blue-100 text-sm mt-1">
                                {format(getAppointmentDate(selectedAppointment), 'EEEE, MMMM d, yyyy')}
                              </p>
                            </div>
                            <button
                              onClick={() => setShowDetailModal(false)}
                              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                            >
                              <XMarkIcon className="h-6 w-6 text-white" />
                            </button>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                          {/* Status */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Status</span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                              statusConfig[selectedAppointment.status]?.bg || 'bg-gray-100'
                            } ${statusConfig[selectedAppointment.status]?.text || 'text-gray-700'}`}>
                              <span className={`w-2 h-2 rounded-full ${
                                statusConfig[selectedAppointment.status]?.dot || 'bg-gray-400'
                              }`} />
                              {statusConfig[selectedAppointment.status]?.label || selectedAppointment.status}
                            </span>
                          </div>

                          {/* Doctor Info */}
                          <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                                {getDoctorName(selectedAppointment).charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {getDoctorName(selectedAppointment)}
                                </p>
                                <p className="text-gray-600">{getDoctorSpecialty(selectedAppointment)}</p>
                                {selectedAppointment.doctor?.user?.phone && (
                                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                    <PhoneIcon className="h-3.5 w-3.5" />
                                    {selectedAppointment.doctor.user.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wider">Time</p>
                              <p className="font-medium text-gray-900 flex items-center gap-1.5 mt-1">
                                <ClockIcon className="h-4 w-4 text-gray-400" />
                                {getAppointmentTime(selectedAppointment)}{selectedAppointment.endTime ? ` - ${selectedAppointment.endTime}` : ''}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wider">Department</p>
                              <p className="font-medium text-gray-900 flex items-center gap-1.5 mt-1">
                                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                                {getDepartmentName(selectedAppointment) || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wider">Type</p>
                              <p className="font-medium text-gray-900 mt-1">
                                {appointmentTypeConfig[selectedAppointment.type]?.label || selectedAppointment.type}
                              </p>
                            </div>
                            {selectedAppointment.tokenNumber && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Token Number</p>
                                <p className="font-medium text-gray-900 mt-1">#{selectedAppointment.tokenNumber}</p>
                              </div>
                            )}
                          </div>

                          {/* Reason */}
                          {selectedAppointment.reason && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Reason for Visit</p>
                              <div className="bg-blue-50 rounded-xl p-4">
                                <p className="text-gray-700">{selectedAppointment.reason}</p>
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {selectedAppointment.notes && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Notes</p>
                              <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-gray-600 text-sm">{selectedAppointment.notes}</p>
                              </div>
                            </div>
                          )}

                          {/* Location */}
                          {selectedAppointment.location && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPinIcon className="h-5 w-5 text-gray-400" />
                              <span>{selectedAppointment.location}</span>
                            </div>
                          )}

                          {/* Info box for telemedicine */}
                          {selectedAppointment.type === 'TELEMEDICINE' && (
                            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                              <InformationCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium text-green-800">Telemedicine Appointment</p>
                                <p className="text-sm text-green-700 mt-1">
                                  You will receive a video call link before your appointment.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                          <button
                            onClick={() => setShowDetailModal(false)}
                            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                          >
                            Close
                          </button>
                          {canReschedule(selectedAppointment) && (
                            <button
                              onClick={() => { setShowDetailModal(false); handleOpenRescheduleModal(selectedAppointment); }}
                              className="px-4 py-2 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
                            >
                              Reschedule
                            </button>
                          )}
                          {canCancel(selectedAppointment) && (
                            <button
                              onClick={() => { setShowDetailModal(false); handleOpenCancelModal(selectedAppointment); }}
                              className="px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Booking Success Modal */}
        <Transition appear show={bookingSuccess.show} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setBookingSuccess({ show: false })}>
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
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                    {/* Success Header */}
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-8 text-center">
                      <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-lg mb-4">
                        <CheckCircleIcon className="h-12 w-12 text-green-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">Booking Confirmed!</h3>
                      <p className="text-green-100 mt-2">Your appointment has been scheduled successfully</p>
                    </div>

                    {/* Appointment Details */}
                    {bookingSuccess.appointment && (
                      <div className="px-6 py-6 space-y-4">
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Date</span>
                            <span className="font-semibold text-gray-900">
                              {(bookingSuccess.appointment.appointmentDate || bookingSuccess.appointment.date) &&
                                format(parseISO(bookingSuccess.appointment.appointmentDate || bookingSuccess.appointment.date), 'EEEE, MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Time</span>
                            <span className="font-semibold text-gray-900">
                              {bookingSuccess.appointment.startTime || bookingSuccess.appointment.time}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Doctor</span>
                            <span className="font-semibold text-gray-900">
                              {bookingSuccess.appointment.doctorName ||
                                (bookingSuccess.appointment.doctor?.user ?
                                  `Dr. ${bookingSuccess.appointment.doctor.user.firstName} ${bookingSuccess.appointment.doctor.user.lastName}` :
                                  'Doctor')}
                            </span>
                          </div>
                          {bookingSuccess.appointment.tokenNumber && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Token Number</span>
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">
                                #{bookingSuccess.appointment.tokenNumber}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-blue-700">
                            Please arrive 15 minutes before your scheduled time. Bring your ID and any relevant medical records.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-6 py-4 bg-gray-50 flex gap-3">
                      <button
                        onClick={() => {
                          setBookingSuccess({ show: false });
                          refetch();
                        }}
                        className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => {
                          setBookingSuccess({ show: false });
                          setActiveTab('upcoming');
                          refetch();
                        }}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                      >
                        View My Appointments
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
}
