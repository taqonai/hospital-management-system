import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tab } from '@headlessui/react';
import {
  ArrowLeftIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ClockIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  StarIcon,
  DocumentTextIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { doctorApi, appointmentApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import DoctorAbsenceList from '../components/doctors/DoctorAbsenceList';
import { format, isToday, isFuture, isPast } from 'date-fns';
import clsx from 'clsx';

export default function DoctorDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor', id],
    queryFn: async () => {
      const response = await doctorApi.getById(id!);
      return response.data.data;
    },
    enabled: !!id,
  });

  // Fetch doctor's appointments
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['doctor-appointments', id],
    queryFn: async () => {
      const response = await appointmentApi.getAll({ doctorId: id, limit: 50 });
      return response.data.data || [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Doctor not found</h3>
        <Link to="/doctors" className="btn-primary mt-4 inline-block">
          Back to Doctors
        </Link>
      </div>
    );
  }

  const tabs = [
    { name: 'Overview', icon: DocumentTextIcon },
    { name: 'Schedule', icon: CalendarDaysIcon },
    { name: 'Absences', icon: NoSymbolIcon },
    { name: 'Appointments', icon: UserGroupIcon },
  ];

  const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/doctors"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Doctors
      </Link>

      {/* Doctor Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-emerald-500 flex items-center justify-center">
              {doctor.user?.avatar ? (
                <img
                  src={doctor.user.avatar}
                  alt={doctor.user.firstName}
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {doctor.user?.firstName?.[0] || 'D'}{doctor.user?.lastName?.[0] || 'R'}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Dr. {doctor.user?.firstName} {doctor.user?.lastName}
              </h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="font-medium text-emerald-600">{doctor.specialization}</span>
                <span>|</span>
                <span>{doctor.department?.name || 'General Department'}</span>
                <span>|</span>
                <span className="font-mono text-xs">{doctor.licenseNumber}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/appointments/new?doctorId=${doctor.id}`}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              Book Appointment
            </Link>
            <Link
              to={`/doctors/${doctor.id}/edit`}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Contact Info & Status */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <PhoneIcon className="h-5 w-5 text-gray-400" />
            <span>{doctor.user?.phone || 'No phone'}</span>
          </div>
          {doctor.user?.email && (
            <div className="flex items-center gap-2 text-gray-600">
              <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              <span>{doctor.user.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
            <span className="font-semibold">${Number(doctor.consultationFee || 0).toFixed(2)}</span>
            <span className="text-sm">/visit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              doctor.isAvailable
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${doctor.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`} />
              {doctor.isAvailable ? 'Available' : 'Unavailable'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 p-1">
          {tabs.map((tab) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                clsx(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-emerald-400 ring-white ring-opacity-60',
                  selected
                    ? 'bg-white text-emerald-700 shadow'
                    : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-800'
                )
              }
            >
              <div className="flex items-center justify-center gap-2">
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </div>
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-4">
          {/* Overview Tab */}
          <Tab.Panel className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <AcademicCapIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{doctor.experience || 0}</p>
                    <p className="text-sm text-gray-500">Years Experience</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <StarIcon className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-2xl font-bold text-gray-900">{Number(doctor.rating || 0).toFixed(1)}</p>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          star <= Math.floor(doctor.rating || 0) ? (
                            <StarIconSolid key={star} className="h-4 w-4 text-amber-400" />
                          ) : (
                            <StarIcon key={star} className="h-4 w-4 text-gray-300" />
                          )
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">{doctor.totalReviews || 0} Reviews</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <UserGroupIcon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{doctor._count?.appointments || 0}</p>
                    <p className="text-sm text-gray-500">Total Appointments</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DocumentTextIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{doctor._count?.consultations || 0}</p>
                    <p className="text-sm text-gray-500">Consultations</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Qualification & Bio */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Professional Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Qualification</p>
                  <p className="text-gray-900 mt-1">{doctor.qualification || 'Not specified'}</p>
                </div>
                {doctor.specializationRef && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Specialization (Formal)</p>
                    <p className="text-gray-900 mt-1">
                      {doctor.specializationRef.name} ({doctor.specializationRef.code})
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-500">Department</p>
                  <div className="flex items-center gap-2 mt-1">
                    <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                    <p className="text-gray-900">{doctor.department?.name || 'Not assigned'}</p>
                  </div>
                </div>
                {doctor.bio && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Bio</p>
                    <p className="text-gray-700 mt-1">{doctor.bio}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Available Days */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Days</h3>
              <div className="flex flex-wrap gap-2">
                {dayOrder.map((day) => {
                  const isAvailable = doctor.availableDays?.includes(day);
                  return (
                    <span
                      key={day}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm font-medium',
                        isAvailable
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {day.charAt(0) + day.slice(1).toLowerCase()}
                    </span>
                  );
                })}
              </div>
            </div>
          </Tab.Panel>

          {/* Schedule Tab */}
          <Tab.Panel>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Schedule</h3>
              {doctor.schedules && doctor.schedules.length > 0 ? (
                <div className="space-y-3">
                  {dayOrder.map((day) => {
                    const schedule = doctor.schedules?.find((s: any) => s.dayOfWeek === day);
                    return (
                      <div
                        key={day}
                        className={clsx(
                          'flex items-center justify-between p-4 rounded-lg',
                          schedule?.isActive ? 'bg-emerald-50' : 'bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <CalendarDaysIcon className={clsx(
                            'h-5 w-5',
                            schedule?.isActive ? 'text-emerald-600' : 'text-gray-400'
                          )} />
                          <span className={clsx(
                            'font-medium',
                            schedule?.isActive ? 'text-gray-900' : 'text-gray-400'
                          )}>
                            {day.charAt(0) + day.slice(1).toLowerCase()}
                          </span>
                        </div>
                        {schedule?.isActive ? (
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <ClockIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-700">
                                {schedule.startTime} - {schedule.endTime}
                              </span>
                            </div>
                            {schedule.breakStart && schedule.breakEnd && (
                              <span className="text-sm text-gray-500">
                                (Break: {schedule.breakStart} - {schedule.breakEnd})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Not available</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No schedule set. Please configure the doctor's working hours.
                </p>
              )}
            </div>
          </Tab.Panel>

          {/* Absences Tab */}
          <Tab.Panel>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave & Absences</h3>
              <DoctorAbsenceList doctorId={doctor.id} />
            </div>
          </Tab.Panel>

          {/* Appointments Tab */}
          <Tab.Panel>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Appointments</h3>
              {appointmentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : appointments && appointments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {appointments.map((apt: any) => {
                        const aptDate = new Date(apt.appointmentDate);
                        const isUpcoming = isFuture(aptDate) || isToday(aptDate);
                        const isPastApt = isPast(aptDate) && !isToday(aptDate);

                        const statusConfig: Record<string, { bg: string; text: string; icon: any }> = {
                          SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: CalendarDaysIcon },
                          CONFIRMED: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: CheckCircleIcon },
                          CHECKED_IN: { bg: 'bg-amber-100', text: 'text-amber-700', icon: ClockIcon },
                          IN_PROGRESS: { bg: 'bg-purple-100', text: 'text-purple-700', icon: ClockIcon },
                          COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircleIcon },
                          CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircleIcon },
                          NO_SHOW: { bg: 'bg-gray-100', text: 'text-gray-700', icon: ExclamationCircleIcon },
                        };

                        const status = statusConfig[apt.status] || statusConfig.SCHEDULED;
                        const StatusIcon = status.icon;

                        return (
                          <tr key={apt.id} className={clsx(isPastApt && 'bg-gray-50')}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-600">
                                    {apt.patient?.firstName?.[0] || 'P'}{apt.patient?.lastName?.[0] || ''}
                                  </span>
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900">
                                    {apt.patient?.firstName} {apt.patient?.lastName}
                                  </p>
                                  <p className="text-xs text-gray-500">{apt.patient?.mrn || 'No MRN'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div>
                                <p className={clsx(
                                  'text-sm font-medium',
                                  isToday(aptDate) ? 'text-emerald-600' : 'text-gray-900'
                                )}>
                                  {isToday(aptDate) ? 'Today' : format(aptDate, 'MMM d, yyyy')}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {apt.startTime} - {apt.endTime}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm text-gray-700">
                                {apt.appointmentType?.replace(/_/g, ' ') || 'General'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={clsx(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                                status.bg, status.text
                              )}>
                                <StatusIcon className="h-3.5 w-3.5" />
                                {apt.status?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap flex gap-2">
                              <Link
                                to={`/patients/${apt.patientId}`}
                                className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
                              >
                                Patient
                              </Link>
                              <Link
                                to={`/appointments/${apt.id}/edit`}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Edit
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No appointments found for this doctor.
                </p>
              )}
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
