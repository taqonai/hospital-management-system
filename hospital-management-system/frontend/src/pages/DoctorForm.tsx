import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { doctorApi, departmentApi } from '../services/api';
import toast from 'react-hot-toast';
import ScheduleTable, { Schedule, ScheduleValidationError } from '../components/doctors/ScheduleTable';

interface Specialization {
  id: string;
  name: string;
  code: string;
  description?: string;
}

interface DoctorFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  specialization: string;
  specializationId: string;
  qualification: string;
  experience: number;
  licenseNumber: string;
  departmentId: string;
  consultationFee: number;
  bio: string;
  slotDuration: number;
  maxPatientsPerDay: number;
  schedules: Schedule[];
}

const initialFormData: DoctorFormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  specialization: '',
  specializationId: '',
  qualification: '',
  experience: 0,
  licenseNumber: '',
  departmentId: '',
  consultationFee: 0,
  bio: '',
  slotDuration: 30,
  maxPatientsPerDay: 30,
  schedules: [],
};

// Fallback specializations for backward compatibility
const fallbackSpecializations = [
  'General Medicine',
  'Cardiology',
  'Orthopedics',
  'Pediatrics',
  'Gynecology',
  'Dermatology',
  'Ophthalmology',
  'ENT',
  'Neurology',
  'Psychiatry',
  'Urology',
  'Oncology',
  'Gastroenterology',
  'Pulmonology',
  'Nephrology',
  'Endocrinology',
  'Rheumatology',
  'Emergency Medicine',
  'Anesthesiology',
  'Radiology',
  'Pathology',
  'General Surgery',
];

export default function DoctorForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState<DoctorFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<DoctorFormData>>({});
  const [scheduleErrors, setScheduleErrors] = useState<ScheduleValidationError[]>([]);

  // Fetch departments
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await departmentApi.getAll();
      return response.data.data || [];
    },
  });

  // Fetch specializations for selected department
  const { data: specializationsData } = useQuery({
    queryKey: ['department-specializations', formData.departmentId],
    queryFn: async () => {
      if (!formData.departmentId) return [];
      const response = await departmentApi.getSpecializations(formData.departmentId);
      return response.data.data || [];
    },
    enabled: !!formData.departmentId,
  });

  // Fetch doctor data if editing
  const { data: doctorData, isLoading: loadingDoctor } = useQuery({
    queryKey: ['doctor', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await doctorApi.getById(id);
      return response.data.data;
    },
    enabled: isEditMode,
  });

  // Populate form when editing
  useEffect(() => {
    if (doctorData) {
      // Transform schedules from API format if present
      const schedules: Schedule[] = (doctorData.schedules || []).map((s: any) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime || '09:00',
        endTime: s.endTime || '17:00',
        breakStart: s.breakStart || '12:00',
        breakEnd: s.breakEnd || '13:00',
        isActive: s.isActive !== false,
      }));

      setFormData({
        firstName: doctorData.user?.firstName || doctorData.firstName || '',
        lastName: doctorData.user?.lastName || doctorData.lastName || '',
        email: doctorData.user?.email || doctorData.email || '',
        phone: doctorData.user?.phone || doctorData.phone || '',
        password: '', // Don't populate password on edit
        specialization: doctorData.specialization || '',
        specializationId: doctorData.specializationId || '',
        qualification: doctorData.qualification || '',
        experience: doctorData.experience || 0,
        licenseNumber: doctorData.licenseNumber || '',
        departmentId: doctorData.departmentId || doctorData.department?.id || '',
        consultationFee: doctorData.consultationFee || 0,
        bio: doctorData.bio || '',
        slotDuration: doctorData.slotDuration || 30,
        maxPatientsPerDay: doctorData.maxPatientsPerDay || 30,
        schedules,
      });
    }
  }, [doctorData]);

  // Reset specialization when department changes
  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeptId = e.target.value;
    setFormData(prev => ({
      ...prev,
      departmentId: newDeptId,
      specializationId: '',
      specialization: '',
    }));
  };

  // Handle specialization selection
  const handleSpecializationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const specs: Specialization[] = specializationsData || [];
    const selectedSpec = specs.find((s: Specialization) => s.id === value);

    if (selectedSpec) {
      setFormData(prev => ({
        ...prev,
        specializationId: selectedSpec.id,
        specialization: selectedSpec.name,
      }));
    } else if (value) {
      // Fallback: using a text value directly
      setFormData(prev => ({
        ...prev,
        specializationId: '',
        specialization: value,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        specializationId: '',
        specialization: '',
      }));
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: DoctorFormData) => doctorApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast.success('Doctor created successfully!');
      navigate('/doctors');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create doctor');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: DoctorFormData) => doctorApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['doctor', id] });
      toast.success('Doctor updated successfully!');
      navigate('/doctors');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update doctor');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
    if (errors[name as keyof DoctorFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof DoctorFormData, string>> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.specialization) newErrors.specialization = 'Specialization is required';
    if (!formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
    if (!formData.departmentId) newErrors.departmentId = 'Department is required';
    if (!isEditMode && !formData.password.trim()) {
      newErrors.password = 'Password is required for new doctors';
    }

    // Check for schedule validation errors
    if (scheduleErrors.length > 0) {
      toast.error('Please fix the schedule errors before submitting');
      setErrors(newErrors as unknown as Partial<DoctorFormData>);
      return false;
    }

    setErrors(newErrors as unknown as Partial<DoctorFormData>);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Only include password if creating new doctor
    const submitData = isEditMode
      ? { ...formData, password: undefined }
      : formData;

    if (isEditMode) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (isEditMode && loadingDoctor) {
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
            {isEditMode ? 'Edit Doctor' : 'Add New Doctor'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEditMode ? 'Update doctor information' : 'Register a new doctor in the system'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserIcon className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-lg border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                placeholder="Enter first name"
              />
              {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-lg border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                placeholder="Enter last name"
              />
              {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.email ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="doctor@hospital.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.phone ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
            </div>

            {!isEditMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg border ${errors.password ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="Enter password for login"
                />
                {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Professional Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <AcademicCapIcon className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Professional Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specialization <span className="text-red-500">*</span>
              </label>
              <select
                name="specialization"
                value={formData.specializationId || formData.specialization}
                onChange={handleSpecializationChange}
                className={`w-full px-4 py-3 rounded-lg border ${errors.specialization ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              >
                <option value="">
                  {!formData.departmentId ? 'Select department first' : 'Select specialization'}
                </option>
                {/* Show dynamic specializations if department has them */}
                {(specializationsData || []).length > 0 ? (
                  (specializationsData || []).map((spec: Specialization) => (
                    <option key={spec.id} value={spec.id}>{spec.name}</option>
                  ))
                ) : formData.departmentId ? (
                  /* Fallback to hardcoded list if no specializations defined */
                  fallbackSpecializations.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))
                ) : null}
              </select>
              {(specializationsData || []).length === 0 && formData.departmentId && (
                <p className="mt-1 text-xs text-amber-600">
                  No specializations defined for this department. Using default list.
                </p>
              )}
              {errors.specialization && <p className="mt-1 text-sm text-red-500">{errors.specialization}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Qualification
              </label>
              <input
                type="text"
                name="qualification"
                value={formData.qualification}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="MBBS, MD, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                License Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-lg border ${errors.licenseNumber ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                placeholder="Medical license number"
              />
              {errors.licenseNumber && <p className="mt-1 text-sm text-red-500">{errors.licenseNumber}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience
              </label>
              <div className="relative">
                <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  min="0"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Years"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleDepartmentChange}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.departmentId ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                >
                  <option value="">Select department</option>
                  {(departmentsData || []).map((dept: { id: string; name: string }) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              {errors.departmentId && <p className="mt-1 text-sm text-red-500">{errors.departmentId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consultation Fee
              </label>
              <div className="relative">
                <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  name="consultationFee"
                  value={formData.consultationFee}
                  onChange={handleChange}
                  min="0"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Fee amount"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio / About
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description about the doctor..."
            />
          </div>
        </div>

        {/* Slot Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CalendarDaysIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Appointment Slot Configuration</h2>
              <p className="text-sm text-gray-500">Configure appointment slots and working schedule</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slot Duration (minutes)
              </label>
              <select
                name="slotDuration"
                value={formData.slotDuration}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Duration of each appointment slot
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Patients Per Day
              </label>
              <input
                type="number"
                name="maxPatientsPerDay"
                value={formData.maxPatientsPerDay}
                onChange={handleChange}
                min={1}
                max={100}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Maximum appointments per day"
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum number of appointments allowed per day
              </p>
            </div>
          </div>

          <ScheduleTable
            schedules={formData.schedules}
            onChange={(schedules) => setFormData(prev => ({ ...prev, schedules }))}
            onValidationChange={setScheduleErrors}
          />
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
            disabled={isLoading || scheduleErrors.length > 0}
            className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            title={scheduleErrors.length > 0 ? 'Fix schedule errors to enable submission' : undefined}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                {isEditMode ? 'Update Doctor' : 'Create Doctor'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
