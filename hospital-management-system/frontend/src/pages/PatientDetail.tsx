import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tab } from '@headlessui/react';
import {
  ArrowLeftIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  CalendarIcon,
  CpuChipIcon,
  BeakerIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { patientApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PatientAIInsights from '../components/ai/PatientAIInsights';
import { format } from 'date-fns';
import clsx from 'clsx';

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const response = await patientApi.getById(id!);
      return response.data.data;
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

  if (!patient) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Patient not found</h3>
        <Link to="/patients" className="btn-primary mt-4">
          Back to Patients
        </Link>
      </div>
    );
  }

  const age = Math.floor(
    (new Date().getTime() - new Date(patient.dateOfBirth).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

  const tabs = [
    { name: 'Overview', icon: DocumentTextIcon },
    { name: 'Medical History', icon: DocumentTextIcon },
    { name: 'Appointments', icon: CalendarIcon },
    { name: 'Lab Results', icon: BeakerIcon },
    { name: 'AI Insights', icon: CpuChipIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/patients"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Patients
      </Link>

      {/* Patient Header */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-700">
                {patient.firstName[0]}
                {patient.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {patient.firstName} {patient.lastName}
              </h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="font-mono">{patient.mrn}</span>
                <span>|</span>
                <span>{age} years old</span>
                <span>|</span>
                <span className="capitalize">{patient.gender.toLowerCase()}</span>
                {patient.bloodGroup && (
                  <>
                    <span>|</span>
                    <span className="font-medium text-red-600">{patient.bloodGroup}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/appointments/new?patientId=${patient.id}`} className="btn-primary">
              Book Appointment
            </Link>
            <Link to={`/patients/${patient.id}/edit`} className="btn-outline">
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <PhoneIcon className="h-5 w-5 text-gray-400" />
            <span>{patient.phone}</span>
          </div>
          {patient.email && (
            <div className="flex items-center gap-2 text-gray-600">
              <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              <span>{patient.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <MapPinIcon className="h-5 w-5 text-gray-400" />
            <span>
              {patient.city}, {patient.state}
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
                  'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-primary-400 ring-white ring-opacity-60',
                  selected
                    ? 'bg-white text-primary-700 shadow'
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
            {/* Latest Vitals */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Latest Vitals</h3>
              </div>
              <div className="card-body">
                {patient.vitals && patient.vitals.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Blood Pressure', value: `${patient.vitals[0].bloodPressureSys}/${patient.vitals[0].bloodPressureDia}`, unit: 'mmHg' },
                      { label: 'Heart Rate', value: patient.vitals[0].heartRate, unit: 'bpm' },
                      { label: 'Temperature', value: patient.vitals[0].temperature, unit: '°C' },
                      { label: 'SpO2', value: patient.vitals[0].oxygenSaturation, unit: '%' },
                    ].map((vital) => (
                      <div key={vital.label} className="p-4 rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-500">{vital.label}</p>
                        <p className="text-xl font-semibold text-gray-900 mt-1">
                          {vital.value || '--'} <span className="text-sm font-normal">{vital.unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No vitals recorded yet.</p>
                )}
              </div>
            </div>

            {/* Allergies */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Allergies</h3>
              </div>
              <div className="card-body">
                {patient.allergies && patient.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {patient.allergies.map((allergy: any) => (
                      <span
                        key={allergy.id}
                        className={clsx(
                          'px-3 py-1 rounded-full text-sm font-medium',
                          allergy.severity === 'SEVERE' || allergy.severity === 'LIFE_THREATENING'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        )}
                      >
                        {allergy.allergen}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No known allergies.</p>
                )}
              </div>
            </div>
          </Tab.Panel>

          {/* Medical History Tab */}
          <Tab.Panel className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Medical History</h3>
              </div>
              <div className="card-body space-y-6">
                {patient.medicalHistory ? (
                  <>
                    <div>
                      <h4 className="font-medium text-gray-900">Chronic Conditions</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {patient.medicalHistory.chronicConditions?.length > 0 ? (
                          patient.medicalHistory.chronicConditions.map((condition: string, idx: number) => (
                            <span key={idx} className="badge-info">{condition}</span>
                          ))
                        ) : (
                          <span className="text-gray-500">None recorded</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Past Surgeries</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {patient.medicalHistory.pastSurgeries?.length > 0 ? (
                          patient.medicalHistory.pastSurgeries.map((surgery: string, idx: number) => (
                            <span key={idx} className="badge-warning">{surgery}</span>
                          ))
                        ) : (
                          <span className="text-gray-500">None recorded</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Current Medications</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {patient.medicalHistory.currentMedications?.length > 0 ? (
                          patient.medicalHistory.currentMedications.map((med: string, idx: number) => (
                            <span key={idx} className="badge-success">{med}</span>
                          ))
                        ) : (
                          <span className="text-gray-500">None recorded</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500">No medical history recorded yet.</p>
                )}
              </div>
            </div>
          </Tab.Panel>

          {/* Appointments Tab */}
          <Tab.Panel>
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Appointments</h3>
              </div>
              <div className="card-body">
                {patient.appointments && patient.appointments.length > 0 ? (
                  <div className="space-y-4">
                    {patient.appointments.map((apt: any) => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-gray-50"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            Dr. {apt.doctor.user.firstName} {apt.doctor.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {apt.doctor.department.name} - {apt.doctor.specialization}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            {format(new Date(apt.appointmentDate), 'MMM d, yyyy')}
                          </p>
                          <p className="text-sm text-gray-500">{apt.startTime}</p>
                        </div>
                        <span
                          className={clsx(
                            'badge',
                            apt.status === 'COMPLETED' && 'badge-success',
                            apt.status === 'SCHEDULED' && 'badge-info',
                            apt.status === 'CANCELLED' && 'badge-error'
                          )}
                        >
                          {apt.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No appointments found.</p>
                )}
              </div>
            </div>
          </Tab.Panel>

          {/* Lab Results Tab */}
          <Tab.Panel>
            <div className="card p-6 text-center text-gray-500">
              Lab results will be displayed here.
            </div>
          </Tab.Panel>

          {/* AI Insights Tab */}
          <Tab.Panel>
            <PatientAIInsights patient={patient} />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
