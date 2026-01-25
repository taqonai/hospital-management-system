import { useState } from 'react';
import {
  UserCircleIcon,
  CalendarIcon,
  ClockIcon,
  PhoneIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { BookingTicketData } from '../../hooks/useBookingData';
import { BookingStatusTimeline } from './BookingStatusTimeline';
import { VitalsSummaryCard } from './VitalsSummaryCard';
import { LabOrdersCard } from './LabOrdersCard';

interface BookingTicketProps {
  data: BookingTicketData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onClose?: () => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'SCHEDULED':
      return 'bg-blue-100 text-blue-800';
    case 'CONFIRMED':
      return 'bg-indigo-100 text-indigo-800';
    case 'CHECKED_IN':
      return 'bg-yellow-100 text-yellow-800';
    case 'IN_PROGRESS':
      return 'bg-orange-100 text-orange-800';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-600';
    case 'NO_SHOW':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function BookingTicket({
  data,
  isLoading,
  onRefresh,
  onClose,
  showActions = true,
  compact = false,
  className,
}: BookingTicketProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'notes'>('overview');

  const { appointment, patient, doctor, vitals, riskPrediction, consultation, labOrders, timeline } = data;

  const hasAllergies = patient.allergies && patient.allergies.length > 0;
  const age = calculateAge(patient.dateOfBirth);

  return (
    <div className={clsx('bg-white rounded-lg shadow-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <UserCircleIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">
                {patient.firstName} {patient.lastName}
              </h3>
              <div className="flex items-center gap-2 text-blue-100 text-sm">
                <span>{patient.mrn}</span>
                <span>•</span>
                <span>{age}Y / {patient.gender}</span>
                {patient.bloodGroup && (
                  <>
                    <span>•</span>
                    <span className="font-medium">{patient.bloodGroup}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {appointment.tokenNumber && (
              <div className="bg-white/20 px-3 py-1 rounded-full">
                <span className="text-white font-bold text-lg">#{appointment.tokenNumber}</span>
              </div>
            )}
            <span className={clsx('px-2 py-1 rounded text-xs font-medium', getStatusColor(appointment.status))}>
              {appointment.status.replace('_', ' ')}
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1 text-white/80 hover:text-white rounded"
                disabled={isLoading}
              >
                <ArrowPathIcon className={clsx('w-5 h-5', isLoading && 'animate-spin')} />
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="p-1 text-white/80 hover:text-white rounded">
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Allergy Banner */}
      {hasAllergies && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <span className="text-red-700 font-medium text-sm">Allergies:</span>
            <div className="flex flex-wrap gap-1">
              {patient.allergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    allergy.severity === 'SEVERE'
                      ? 'bg-red-200 text-red-800'
                      : allergy.severity === 'MODERATE'
                      ? 'bg-orange-200 text-orange-800'
                      : 'bg-yellow-200 text-yellow-800'
                  )}
                >
                  {allergy.allergen}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Appointment Info */}
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-gray-600">
              <CalendarIcon className="w-4 h-4" />
              <span>{new Date(appointment.appointmentDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <ClockIcon className="w-4 h-4" />
              <span>{appointment.startTime} - {appointment.endTime}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <PhoneIcon className="w-4 h-4" />
              <span>{patient.phone}</span>
            </div>
          </div>
          <div className="text-gray-600">
            <span className="font-medium">Dr. {doctor.firstName} {doctor.lastName}</span>
            <span className="text-gray-400 ml-1">({doctor.specialization})</span>
          </div>
        </div>
        {appointment.reason && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Reason: </span>
            {appointment.reason}
          </div>
        )}
      </div>

      {/* Status Timeline */}
      {!compact && (
        <div className="px-4 py-3 border-b">
          <BookingStatusTimeline
            status={appointment.status}
            checkedInAt={appointment.checkedInAt}
            vitalsRecordedAt={appointment.vitalsRecordedAt}
            consultationStarted={!!consultation}
          />
        </div>
      )}

      {/* Tabs */}
      {!compact && (
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('overview')}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                activeTab === 'timeline'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              Timeline
            </button>
            {data.clinicalNotes.length > 0 && (
              <button
                onClick={() => setActiveTab('notes')}
                className={clsx(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                  activeTab === 'notes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                Notes ({data.clinicalNotes.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Vitals */}
            <VitalsSummaryCard
              vitals={vitals}
              riskPrediction={riskPrediction}
              patient={{ gender: patient.gender, dateOfBirth: patient.dateOfBirth }}
              appointmentNotes={appointment.notes}
            />

            {/* Consultation Summary */}
            {consultation && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b flex items-center gap-2">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-gray-900">Consultation</span>
                </div>
                <div className="p-4 space-y-3">
                  {consultation.chiefComplaint && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">Chief Complaint</span>
                      <p className="text-sm text-gray-700">{consultation.chiefComplaint}</p>
                    </div>
                  )}
                  {consultation.diagnosis && consultation.diagnosis.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">Diagnosis</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {consultation.diagnosis.map((dx, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs"
                          >
                            {dx}
                            {consultation.icdCodes[idx] && (
                              <span className="ml-1 text-blue-600">({consultation.icdCodes[idx]})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {consultation.treatmentPlan && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">Treatment Plan</span>
                      <p className="text-sm text-gray-700">{consultation.treatmentPlan}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lab Orders */}
            <LabOrdersCard labOrders={labOrders} />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {timeline.map((event, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  {idx < timeline.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900">
                      {event.event.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {event.details && <p className="text-sm text-gray-600 mt-0.5">{event.details}</p>}
                  {event.actor && <p className="text-xs text-gray-400 mt-0.5">By: {event.actor}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3">
            {data.clinicalNotes.map((note) => (
              <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {note.noteType}
                  </span>
                  <div className="text-xs text-gray-400">
                    {note.author} • {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
                {note.subjective && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-500">Subjective:</span>
                    <p className="text-sm text-gray-700">{note.subjective}</p>
                  </div>
                )}
                {note.assessment && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-500">Assessment:</span>
                    <p className="text-sm text-gray-700">{note.assessment}</p>
                  </div>
                )}
                {note.plan && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">Plan:</span>
                    <p className="text-sm text-gray-700">{note.plan}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingTicket;
