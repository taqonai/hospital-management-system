import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { appointmentApi, patientApi, doctorApi, slotApi } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { isSlotPastInUAE, getTodayInUAE } from '../utils/timezone';

interface AppointmentFormData {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  type: string;
  reason: string;
  notes: string;
  priority: string;
}

const initialFormData: AppointmentFormData = {
  patientId: '',
  doctorId: '',
  appointmentDate: format(new Date(), 'yyyy-MM-dd'),
  appointmentTime: '',
  type: 'CONSULTATION',
  reason: '',
  notes: '',
  priority: 'NORMAL',
};

const appointmentTypes = [
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'CHECKUP', label: 'Check-up' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'LAB_TEST', label: 'Lab Test' },
  { value: 'IMAGING', label: 'Imaging' },
];

const priorities = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isBlocked: boolean;
  _unavailableReason?: string;
}

interface SlotsResponse {
  slots: Slot[];
  maxPatientsPerDay?: number;
  bookedCount?: number;
  remainingCapacity?: number;
  maxAdvanceBookingDays?: number;
  unavailableReason?: 'past_date' | 'too_far_ahead' | 'doctor_leave';
  message?: string;
  absenceType?: string;
}

export default function AppointmentForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState<AppointmentFormData>({
    ...initialFormData,
    patientId: searchParams.get('patientId') || '',
    doctorId: searchParams.get('doctorId') || '',
  });
  const [errors, setErrors] = useState<Partial<AppointmentFormData>>({});
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');

  // Fetch patients for selection
  const { data: patientsData } = useQuery({
    queryKey: ['patients', { search: patientSearch, limit: 10 }],
    queryFn: async () => {
      const response = await patientApi.getAll({ search: patientSearch, limit: 10 });
      return response.data;
    },
  });

  // Fetch doctors for selection
  const { data: doctorsData } = useQuery({
    queryKey: ['doctors', { search: doctorSearch, limit: 10 }],
    queryFn: async () => {
      const response = await doctorApi.getAll({ search: doctorSearch, limit: 10 });
      return response.data;
    },
  });

  // Fetch available slots for selected doctor and date
  const { data: slotsResponse, isLoading: loadingSlots, isError: slotsError } = useQuery<SlotsResponse>({
    queryKey: ['slots', formData.doctorId, formData.appointmentDate],
    queryFn: async () => {
      const response = await slotApi.getByDoctorAndDate(formData.doctorId, formData.appointmentDate);
      // Handle both old array format and new object format for backward compatibility
      const data = response.data.data;
      if (Array.isArray(data)) {
        return { slots: data };
      }
      return data || { slots: [] };
    },
    enabled: !!formData.doctorId && !!formData.appointmentDate,
  });

  // Helper to check if a time slot has passed (for today only, UAE timezone)
  const isSlotPast = (slotTime: string, selectedDate: string): boolean => {
    return isSlotPastInUAE(slotTime, selectedDate, 15);
  };

  // Extract slots from response and filter past slots for today
  // In edit mode, include the appointment's current time slot even if past
  const rawSlots = slotsResponse?.slots || [];
  const slotsData = isEditMode
    ? rawSlots.filter((slot: Slot) =>
        !isSlotPast(slot.startTime, formData.appointmentDate) || slot.startTime === formData.appointmentTime
      )
    : rawSlots.filter((slot: Slot) =>
        !isSlotPast(slot.startTime, formData.appointmentDate)
      );

  // Fetch appointment data if editing
  const { data: appointmentData, isLoading: loadingAppointment } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await appointmentApi.getById(id);
      return response.data.data;
    },
    enabled: isEditMode,
  });

  // Populate form when editing
  useEffect(() => {
    if (appointmentData) {
      const apptDate = new Date(appointmentData.scheduledAt || appointmentData.appointmentDate);
      // Use startTime field (HH:MM) if available, otherwise extract from date
      const timeValue = appointmentData.startTime || format(apptDate, 'HH:mm');
      setFormData({
        patientId: appointmentData.patientId || '',
        doctorId: appointmentData.doctorId || '',
        appointmentDate: format(apptDate, 'yyyy-MM-dd'),
        appointmentTime: timeValue,
        type: appointmentData.type || 'CONSULTATION',
        reason: appointmentData.reason || '',
        notes: appointmentData.notes || '',
        priority: appointmentData.priority || 'NORMAL',
      });
    }
  }, [appointmentData]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => appointmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment scheduled successfully!');
      navigate('/appointments');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create appointment');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => appointmentApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      toast.success('Appointment updated successfully!');
      navigate('/appointments');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update appointment');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof AppointmentFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<AppointmentFormData> = {};

    if (!formData.patientId) newErrors.patientId = 'Please select a patient';
    if (!formData.doctorId) newErrors.doctorId = 'Please select a doctor';
    if (!formData.appointmentDate) newErrors.appointmentDate = 'Date is required';
    if (!formData.appointmentTime) newErrors.appointmentTime = 'Time is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Get end time from the selected slot or calculate fallback
    const selectedSlot = slotsData.find((s: Slot) => s.startTime === formData.appointmentTime);
    let endTime: string;

    if (selectedSlot) {
      endTime = selectedSlot.endTime;
    } else {
      // Fallback: calculate end time (30 minutes after start)
      const [hours, minutes] = formData.appointmentTime.split(':').map(Number);
      const endHours = hours + Math.floor((minutes + 30) / 60);
      const endMinutes = (minutes + 30) % 60;
      endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    }

    // Format date as ISO datetime
    const appointmentDate = new Date(`${formData.appointmentDate}T${formData.appointmentTime}:00`);

    const submitData = {
      patientId: formData.patientId,
      doctorId: formData.doctorId,
      appointmentDate: appointmentDate.toISOString(),
      startTime: formData.appointmentTime,
      endTime: endTime,
      type: formData.type,
      reason: formData.reason,
      notes: formData.notes,
      priority: formData.priority,
    };

    if (isEditMode) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const rawPatients = patientsData?.data || [];
  const rawDoctors = doctorsData?.data || [];

  // In edit mode, ensure the appointment's patient and doctor are always in the list
  const patients = (() => {
    if (isEditMode && appointmentData?.patient && !rawPatients.find((p: any) => p.id === appointmentData.patientId)) {
      return [appointmentData.patient, ...rawPatients];
    }
    return rawPatients;
  })();

  const doctors = (() => {
    if (isEditMode && appointmentData?.doctor && !rawDoctors.find((d: any) => d.id === appointmentData.doctorId)) {
      return [appointmentData.doctor, ...rawDoctors];
    }
    return rawDoctors;
  })();

  if (isEditMode && loadingAppointment) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Appointment' : 'Schedule Appointment'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEditMode ? 'Update appointment details' : 'Book a new appointment for a patient'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserIcon className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Patient Information</h2>
          </div>

          <div>
            {isEditMode && appointmentData?.patient ? (
              /* Edit mode: show patient as read-only */
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Patient</label>
                <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-50">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                      {appointmentData.patient.firstName[0]}{appointmentData.patient.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-lg">{appointmentData.patient.firstName} {appointmentData.patient.lastName}</p>
                      <p className="text-sm text-gray-500">{appointmentData.patient.mrn}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Create mode: show patient selection */
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Patient <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search patients by name or MRN..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
                />
                {errors.patientId && <p className="mb-2 text-sm text-red-500">{errors.patientId}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                  {patients.map((patient: any) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, patientId: patient.id }))}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.patientId === patient.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{patient.firstName} {patient.lastName}</p>
                          <p className="text-sm text-gray-500">{patient.mrn}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Doctor Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserGroupIcon className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Doctor Selection</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Doctor <span className="text-red-500">*</span>
            </label>
            {/* Show selected doctor in edit mode */}
            {isEditMode && appointmentData?.doctor && formData.doctorId && (
              <div className="mb-4 p-4 rounded-lg border-2 border-green-500 bg-green-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center text-white font-medium">
                    {(appointmentData.doctor.user?.firstName || 'D')[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      Dr. {appointmentData.doctor.user?.firstName} {appointmentData.doctor.user?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{appointmentData.doctor.specialization}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Selected</span>
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder="Search doctors by name or specialization..."
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
            />
            {errors.doctorId && <p className="mb-2 text-sm text-red-500">{errors.doctorId}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
              {doctors.map((doctor: any) => (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, doctorId: doctor.id }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    formData.doctorId === doctor.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white font-medium">
                      {(doctor.user?.firstName || doctor.firstName || 'D')[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Dr. {doctor.user?.firstName || doctor.firstName} {doctor.user?.lastName || doctor.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{doctor.specialization}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date & Time */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  name="appointmentDate"
                  value={formData.appointmentDate}
                  onChange={handleChange}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  max={format(new Date(Date.now() + (slotsResponse?.maxAdvanceBookingDays || 30) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.appointmentDate ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              </div>
              {errors.appointmentDate && <p className="mt-1 text-sm text-red-500">{errors.appointmentDate}</p>}
              <p className="mt-1 text-xs text-gray-500">
                You can book up to {slotsResponse?.maxAdvanceBookingDays || 30} days in advance
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time <span className="text-red-500">*</span>
              </label>
              {!formData.doctorId ? (
                <div className="px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  Please select a doctor first
                </div>
              ) : loadingSlots ? (
                <div className="px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  Loading available slots...
                </div>
              ) : slotsError ? (
                <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm flex items-center gap-2">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  Failed to load slots
                </div>
              ) : slotsResponse?.unavailableReason === 'doctor_leave' ? (
                <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm flex items-center gap-2">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {slotsResponse.message || 'Doctor is on leave on this date'}
                </div>
              ) : slotsResponse?.unavailableReason === 'too_far_ahead' ? (
                <div className="px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm flex items-center gap-2">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {slotsResponse.message || 'Cannot book this far in advance'}
                </div>
              ) : slotsResponse?.unavailableReason === 'past_date' ? (
                <div className="px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm flex items-center gap-2">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {slotsResponse.message || 'Cannot book appointments in the past'}
                </div>
              ) : slotsData.length === 0 ? (
                <div className="px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm flex items-center gap-2">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  No slots available for this date
                </div>
              ) : (
                <div className="relative">
                  <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    name="appointmentTime"
                    value={formData.appointmentTime}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.appointmentTime ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  >
                    <option value="">Select a time slot</option>
                    {slotsData.map((slot: Slot) => {
                      const isUnavailable = !slot.isAvailable || slot.isBlocked;
                      let statusText = '';
                      if (!slot.isAvailable) statusText = ' (Booked)';
                      else if (slot.isBlocked) statusText = ' (Blocked)';
                      else if (slot._unavailableReason === 'doctor_leave') statusText = ' (Doctor on leave)';
                      else if (slot._unavailableReason === 'max_patients_reached') statusText = ' (Max capacity)';

                      return (
                        <option
                          key={slot.id || slot.startTime}
                          value={slot.startTime}
                          disabled={isUnavailable}
                        >
                          {slot.startTime} - {slot.endTime}{statusText}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              {errors.appointmentTime && <p className="mt-1 text-sm text-red-500">{errors.appointmentTime}</p>}
              {slotsData.length > 0 && (
                <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                  <p>
                    {slotsData.filter((s: Slot) => s.isAvailable && !s.isBlocked).length} slots available
                    {slotsResponse?.remainingCapacity !== undefined && slotsResponse.remainingCapacity > 0 && (
                      <span className="ml-2">({slotsResponse.remainingCapacity} remaining capacity)</span>
                    )}
                  </p>
                  {slotsResponse?.remainingCapacity === 0 && (
                    <p className="text-amber-600">Maximum daily appointments reached</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {appointmentTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {priorities.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DocumentTextIcon className="h-5 w-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Additional Details</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Visit
              </label>
              <input
                type="text"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief reason for the appointment"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any additional notes or instructions..."
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                {isEditMode ? 'Updating...' : 'Scheduling...'}
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                {isEditMode ? 'Update Appointment' : 'Schedule Appointment'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
