import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserGroupIcon, MicrophoneIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { departmentApi, referralApi, api } from '../../services/api';
import EmergencySlotSelector from './EmergencySlotSelector';
import toast from 'react-hot-toast';

interface ReferralFormProps {
  appointmentId: string;
  consultationId?: string;
  patientId: string;
  doctorId: string;
  whisperAvailable?: boolean;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  isRecording?: boolean;
  isProcessing?: boolean;
  transcribedText?: string;
  onTranscribedTextClear?: () => void;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Doctor {
  id: string;
  user: {
    firstName: string;
    lastName: string;
  };
  specialization: string;
  consultationFee: number;
}

type ReferralUrgency = 'EMERGENCY' | 'URGENT' | 'ROUTINE';

export default function ReferralForm({
  appointmentId,
  consultationId,
  patientId,
  doctorId,
  whisperAvailable = false,
  onStartVoice,
  onStopVoice,
  isRecording = false,
  isProcessing = false,
  transcribedText,
  onTranscribedTextClear,
}: ReferralFormProps) {
  const queryClient = useQueryClient();

  // Form State
  const [needsReferral, setNeedsReferral] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [urgency, setUrgency] = useState<ReferralUrgency>('ROUTINE');
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Modal State
  const [showSlotSelector, setShowSlotSelector] = useState(false);
  const [pendingReferral, setPendingReferral] = useState<any>(null);

  // Fetch departments
  const { data: departmentsData, isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await departmentApi.getAll();
      return response.data.data || response.data;
    },
    enabled: needsReferral,
  });

  // Fetch doctors by department
  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ['doctors', 'department', selectedDepartmentId],
    queryFn: async () => {
      const response = await api.get(`/doctors`, {
        params: { departmentId: selectedDepartmentId, limit: 100 },
      });
      return response.data.data?.doctors || response.data.data || [];
    },
    enabled: needsReferral && !!selectedDepartmentId,
  });

  const departments: Department[] = departmentsData || [];
  const doctors: Doctor[] = doctorsData || [];

  // Handle transcribed text from voice input
  useEffect(() => {
    if (transcribedText) {
      setReferralReason((prev) => {
        const newText = prev ? `${prev} ${transcribedText}` : transcribedText;
        return newText;
      });
      onTranscribedTextClear?.();
    }
  }, [transcribedText, onTranscribedTextClear]);

  // Reset doctor when department changes
  useEffect(() => {
    setSelectedDoctorId('');
  }, [selectedDepartmentId]);

  // Create referral mutation
  const createReferralMutation = useMutation({
    mutationFn: async (data: {
      sourceConsultationId?: string;
      sourceAppointmentId: string;
      patientId: string;
      targetDepartmentId: string;
      targetDoctorId?: string;
      reason: string;
      urgency: ReferralUrgency;
      clinicalNotes?: string;
    }) => {
      const response = await referralApi.create(data);
      return response.data.data;
    },
    onSuccess: (data) => {
      if (urgency === 'EMERGENCY' && selectedDoctorId) {
        // For EMERGENCY, show slot selector
        setPendingReferral(data);
        setShowSlotSelector(true);
      } else {
        // For URGENT/ROUTINE, just show success
        toast.success(
          urgency === 'URGENT'
            ? 'Urgent referral created. Receptionist will schedule the appointment.'
            : 'Referral created. Patient will receive booking link.'
        );
        resetForm();
        queryClient.invalidateQueries({ queryKey: ['referrals'] });
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create referral');
    },
  });

  // Schedule appointment for EMERGENCY referral
  const scheduleAppointmentMutation = useMutation({
    mutationFn: async ({ referralId, appointmentDate, startTime, endTime }: {
      referralId: string;
      appointmentDate: string;
      startTime: string;
      endTime: string;
    }) => {
      const response = await referralApi.schedule(referralId, {
        appointmentDate,
        startTime,
        endTime,
      });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('Emergency appointment scheduled successfully');
      setShowSlotSelector(false);
      setPendingReferral(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to schedule appointment');
    },
  });

  const resetForm = () => {
    setNeedsReferral(false);
    setSelectedDepartmentId('');
    setSelectedDoctorId('');
    setReferralReason('');
    setUrgency('ROUTINE');
    setClinicalNotes('');
  };

  const handleSubmitReferral = useCallback(() => {
    if (!selectedDepartmentId) {
      toast.error('Please select a department');
      return;
    }

    if (!referralReason.trim()) {
      toast.error('Please provide a reason for referral');
      return;
    }

    if (urgency === 'EMERGENCY' && !selectedDoctorId) {
      toast.error('Please select a consultant for emergency referral');
      return;
    }

    createReferralMutation.mutate({
      sourceConsultationId: consultationId,
      sourceAppointmentId: appointmentId,
      patientId,
      targetDepartmentId: selectedDepartmentId,
      targetDoctorId: selectedDoctorId || undefined,
      reason: referralReason,
      urgency,
      clinicalNotes: clinicalNotes || undefined,
    });
  }, [
    selectedDepartmentId,
    selectedDoctorId,
    referralReason,
    urgency,
    clinicalNotes,
    consultationId,
    appointmentId,
    patientId,
    createReferralMutation,
  ]);

  const handleSlotSelect = (slot: { slotDate: string; startTime: string; endTime: string }) => {
    if (pendingReferral) {
      scheduleAppointmentMutation.mutate({
        referralId: pendingReferral.id,
        appointmentDate: slot.slotDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
  };

  const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <UserGroupIcon className="h-5 w-5 text-indigo-500" />
          Consultant Referral
        </h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <span className="text-sm text-gray-600">Needs Referral</span>
          <button
            type="button"
            onClick={() => setNeedsReferral(!needsReferral)}
            className={clsx(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
              needsReferral ? 'bg-indigo-600' : 'bg-gray-200'
            )}
          >
            <span
              className={clsx(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                needsReferral ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </label>
      </div>

      {needsReferral && (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Department <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              disabled={departmentsLoading}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 disabled:bg-gray-100"
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Selection (optional for ROUTINE, required for EMERGENCY) */}
          {selectedDepartmentId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Consultant {urgency === 'EMERGENCY' && <span className="text-red-500">*</span>}
                {urgency !== 'EMERGENCY' && <span className="text-gray-500 font-normal">(Optional)</span>}
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                disabled={doctorsLoading}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 disabled:bg-gray-100"
              >
                <option value="">
                  {urgency === 'EMERGENCY' ? 'Select Consultant' : 'Any available consultant'}
                </option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.user.firstName} {doc.user.lastName} - {doc.specialization}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Urgency Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Urgency Level
            </label>
            <div className="flex gap-3">
              {[
                { value: 'ROUTINE', label: 'Routine', color: 'bg-green-100 border-green-300 text-green-700', desc: 'Patient books via portal' },
                { value: 'URGENT', label: 'Urgent', color: 'bg-amber-100 border-amber-300 text-amber-700', desc: 'Receptionist schedules within 24hrs' },
                { value: 'EMERGENCY', label: 'Emergency', color: 'bg-red-100 border-red-300 text-red-700', desc: 'Book immediately' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUrgency(option.value as ReferralUrgency)}
                  className={clsx(
                    'flex-1 px-4 py-3 rounded-lg border-2 text-center transition-all',
                    urgency === option.value
                      ? option.color
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs mt-1 opacity-75">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* EMERGENCY warning */}
          {urgency === 'EMERGENCY' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <span className="font-medium">Emergency Referral:</span> You will be prompted to select an available slot immediately after submission.
              </div>
            </div>
          )}

          {/* Referral Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Referral <span className="text-red-500">*</span>
              {whisperAvailable && !isRecording && !isProcessing && (
                <span className="ml-2 text-xs text-indigo-500 flex items-center gap-1 inline-flex">
                  <MicrophoneIcon className="h-3 w-3" />
                  Voice enabled
                </span>
              )}
            </label>
            <div className="relative">
              <textarea
                value={referralReason}
                onChange={(e) => setReferralReason(e.target.value)}
                rows={3}
                placeholder="Describe the reason for consultant referral..."
                className={clsx(
                  "w-full rounded-xl border bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none pr-12",
                  isRecording ? "border-red-400 bg-red-50" : "border-gray-300"
                )}
              />
              {/* Mic button */}
              {!isRecording && !isProcessing && onStartVoice && (
                <button
                  type="button"
                  onClick={onStartVoice}
                  disabled={!whisperAvailable}
                  className={clsx(
                    "absolute right-3 top-3 p-2 rounded-lg transition-colors",
                    !whisperAvailable
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-indigo-500 text-white hover:bg-indigo-600"
                  )}
                  title={!whisperAvailable ? "Voice input unavailable" : "Voice input for referral reason"}
                >
                  <MicrophoneIcon className="h-5 w-5" />
                </button>
              )}
              {/* Recording indicator */}
              {isRecording && onStopVoice && (
                <div className="absolute right-3 top-3 flex items-center gap-2">
                  <span className="flex items-center gap-1 text-red-600 text-sm">
                    <span className="animate-pulse">●</span> Recording...
                  </span>
                  <button
                    type="button"
                    onClick={onStopVoice}
                    className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Stop
                  </button>
                </div>
              )}
              {/* Processing indicator */}
              {isProcessing && (
                <div className="absolute right-3 top-3 flex items-center gap-2 text-indigo-600 text-sm">
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Transcribing...
                </div>
              )}
            </div>
          </div>

          {/* Clinical Notes (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Clinical Notes <span className="text-gray-500 font-normal">(Optional)</span>
            </label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={2}
              placeholder="Any additional clinical context for the consultant..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Referral Summary */}
          {selectedDepartmentId && referralReason && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <p className="text-sm text-indigo-800">
                <span className="font-semibold">Referral Summary:</span> Patient will be referred to{' '}
                <span className="font-medium">{selectedDepartment?.name}</span>
                {selectedDoctor && (
                  <> (Dr. {selectedDoctor.user.firstName} {selectedDoctor.user.lastName})</>
                )} with{' '}
                <span className={clsx(
                  'font-medium',
                  urgency === 'ROUTINE' && 'text-green-700',
                  urgency === 'URGENT' && 'text-amber-700',
                  urgency === 'EMERGENCY' && 'text-red-700'
                )}>
                  {urgency.toLowerCase()}
                </span>{' '}
                priority.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmitReferral}
            disabled={createReferralMutation.isPending || !selectedDepartmentId || !referralReason.trim()}
            className={clsx(
              "w-full py-3 px-4 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2",
              createReferralMutation.isPending || !selectedDepartmentId || !referralReason.trim()
                ? "bg-gray-300 cursor-not-allowed"
                : urgency === 'EMERGENCY'
                  ? "bg-red-600 hover:bg-red-700"
                  : urgency === 'URGENT'
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {createReferralMutation.isPending ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Creating Referral...
              </>
            ) : urgency === 'EMERGENCY' ? (
              'Create Emergency Referral & Select Slot'
            ) : urgency === 'URGENT' ? (
              'Create Urgent Referral'
            ) : (
              'Create Routine Referral'
            )}
          </button>
        </div>
      )}

      {/* Emergency Slot Selector Modal */}
      {showSlotSelector && pendingReferral && (
        <EmergencySlotSelector
          referralId={pendingReferral.id}
          doctorName={selectedDoctor ? `Dr. ${selectedDoctor.user.firstName} ${selectedDoctor.user.lastName}` : 'Selected Doctor'}
          departmentName={selectedDepartment?.name || 'Department'}
          onSelectSlot={handleSlotSelect}
          onClose={() => {
            setShowSlotSelector(false);
            // Don't reset - referral was already created
            toast('Referral created but appointment not scheduled yet. Receptionist can schedule later.');
          }}
          isLoading={scheduleAppointmentMutation.isPending}
        />
      )}
    </div>
  );
}
