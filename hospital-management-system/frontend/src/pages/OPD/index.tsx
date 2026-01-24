import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardDocumentListIcon,
  ClockIcon,
  SparklesIcon,
  MegaphoneIcon,
  ArrowPathIcon,
  PlusIcon,
  UserPlusIcon,
  HeartIcon,
  CheckCircleIcon,
  XMarkIcon,
  EyeIcon,
  CheckIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { useAIHealth } from '../../hooks/useAI';
import { useBookingData } from '../../hooks/useBookingData';
import { BookingTicket } from '../../components/booking';
import { opdApi, appointmentApi, doctorApi, patientApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

interface QueueItem {
  id: string; // Appointment/Booking ID
  tokenNumber: string;
  patient: {
    id: string; // Patient ID
    firstName: string;
    lastName: string;
    mrn?: string;
  };
  doctor: {
    user: {
      firstName: string;
      lastName: string;
    };
    specialization: string;
  };
  status: string;
  estimatedWaitTime?: number;
  vitalsRecordedAt?: string;
}

interface OPDStats {
  inQueue: number;
  inConsultation: number;
  avgWaitTime: number;
  seenToday: number;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

interface Doctor {
  id: string;
  user: {
    firstName: string;
    lastName: string;
  };
  specialization: string;
}

function WalkInModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [visitType, setVisitType] = useState<'CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE'>('CONSULTATION');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // Fetch available doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoadingDoctors(true);
        const response = await doctorApi.getAll({ isAvailable: true, limit: 50 });
        setDoctors(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch doctors:', error);
        toast.error('Failed to load doctors');
      } finally {
        setLoadingDoctors(false);
      }
    };
    fetchDoctors();
  }, []);

  // Search patients
  const searchPatients = async (query: string) => {
    if (!query.trim()) {
      setPatients([]);
      return;
    }
    setSearching(true);
    try {
      const response = await patientApi.getAll({ search: query, limit: 10 });
      setPatients(response.data.data || []);
    } catch (error) {
      console.error('Failed to search patients:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchPatients(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!selectedDoctor) {
      toast.error('Please select a doctor');
      return;
    }

    setLoading(true);
    try {
      // Create appointment for today
      const today = new Date();
      today.setMinutes(today.getMinutes() + 5); // Start 5 mins from now

      await appointmentApi.create({
        patientId: selectedPatient.id,
        doctorId: selectedDoctor,
        appointmentDate: today.toISOString(),
        type: visitType,
        notes: chiefComplaint || undefined,
        status: 'CONFIRMED',
        isWalkIn: true,
        priority,
      });
      toast.success('Walk-in patient added to queue');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to add walk-in:', error);
      toast.error(error.response?.data?.message || 'Failed to add walk-in patient');
    } finally {
      setLoading(false);
    }
  };

  // Group doctors by specialization
  const doctorsBySpecialization = doctors.reduce((acc, doc) => {
    const spec = doc.specialization || 'General';
    if (!acc[spec]) acc[spec] = [];
    acc[spec].push(doc);
    return acc;
  }, {} as Record<string, Doctor[]>);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Add Walk-in Patient</h2>
            <p className="text-white/80 text-sm">Register a walk-in patient for OPD consultation</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto overflow-x-hidden">
            {/* Patient Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Patient <span className="text-red-500">*</span>
              </label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div>
                    <span className="font-medium text-gray-900">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">MRN: {selectedPatient.mrn}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or MRN..."
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                  {searching && (
                    <div className="absolute right-3 top-3">
                      <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  )}
                  {patients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {patients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setSearchQuery('');
                            setPatients([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                        >
                          <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                          <span className="ml-2 text-sm text-gray-500">MRN: {patient.mrn}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Doctor Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Doctor <span className="text-red-500">*</span>
              </label>
              {loadingDoctors ? (
                <div className="flex items-center justify-center py-4">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-500">Loading doctors...</span>
                </div>
              ) : (
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  required
                >
                  <option value="">Select a doctor...</option>
                  {Object.entries(doctorsBySpecialization).map(([spec, docs]) => (
                    <optgroup key={spec} label={spec}>
                      {docs.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          Dr. {doc.user.firstName} {doc.user.lastName}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            {/* Visit Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visit Type</label>
                <select
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value as typeof visitType)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                >
                  <option value="CONSULTATION">Consultation</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                  <option value="PROCEDURE">Procedure</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPriority('NORMAL')}
                    className={clsx(
                      'flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border',
                      priority === 'NORMAL'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('URGENT')}
                    className={clsx(
                      'flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border',
                      priority === 'URGENT'
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    Urgent
                  </button>
                </div>
              </div>
            </div>

            {/* Chief Complaint */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chief Complaint (Optional)</label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="Reason for visit..."
                rows={3}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedPatient || !selectedDoctor}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-5 w-5" />
                    Add to Queue
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Medication interface for current medications
interface CurrentMedication {
  name: string;
  dosage: string;
  frequency: string;
}

// Vitals Recording Modal for pre-consultation
interface VitalsModalProps {
  appointment: QueueItem;
  onClose: () => void;
  onSuccess: () => void;
}

// Helper to calculate age from date of birth
const calculateAge = (dateOfBirth: string | undefined): number | null => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

function VitalsRecordingModal({ appointment, onClose, onSuccess }: VitalsModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [patientData, setPatientData] = useState<{ gender?: string; dateOfBirth?: string } | null>(null);
  const [vitals, setVitals] = useState({
    temperature: '',
    bloodPressureSys: '',
    bloodPressureDia: '',
    heartRate: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    bloodSugar: '',
    painLevel: '',
    notes: '',
    // New fields for pregnancy and medications
    isPregnant: undefined as boolean | undefined,
    expectedDueDate: '',
    currentMedications: [] as CurrentMedication[],
    currentTreatment: '',
  });

  // State for new medication input
  const [newMedication, setNewMedication] = useState<CurrentMedication>({
    name: '',
    dosage: '',
    frequency: '',
  });

  // State for AI risk assessment display
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [showRiskAssessment, setShowRiskAssessment] = useState(false);

  // State for patient medical summary (read-only display from MedicalHistory model)
  const [medicalSummary, setMedicalSummary] = useState<{
    medicalHistory: {
      chronicConditions: string[];
      pastSurgeries: string[];
      familyHistory: string[];
      currentMedications: string[];
      currentTreatment: string | null;
      isPregnant: boolean | null;
      expectedDueDate: string | null;
    } | null;
    allergies: Array<{
      id: string;
      allergen: string;
      type: string;
      severity: string;
      reaction: string | null;
    }>;
  } | null>(null);
  const [loadingMedicalSummary, setLoadingMedicalSummary] = useState(false);

  // Calculate if pregnancy question should be shown
  const patientAge = patientData?.dateOfBirth ? calculateAge(patientData.dateOfBirth) : null;
  const showPregnancyQuestion =
    patientData?.gender?.toUpperCase() === 'FEMALE' &&
    patientAge !== null &&
    patientAge >= 13 &&
    patientAge <= 51;

  // Fetch patient details for gender/DOB
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!appointment.patient?.id) return;

      setLoadingPatient(true);
      try {
        const response = await patientApi.getById(appointment.patient.id);
        const patient = response.data?.data;
        if (patient) {
          setPatientData({
            gender: patient.gender,
            dateOfBirth: patient.dateOfBirth,
          });
        }
      } catch (error) {
        console.error('Failed to fetch patient data:', error);
      } finally {
        setLoadingPatient(false);
      }
    };

    fetchPatientData();
  }, [appointment.patient?.id]);

  // Fetch patient medical summary (medical history + allergies from MedicalHistory model)
  useEffect(() => {
    const fetchMedicalSummary = async () => {
      if (!appointment.patient?.id) return;

      setLoadingMedicalSummary(true);
      try {
        const response = await opdApi.getPatientMedicalSummary(appointment.patient.id);
        setMedicalSummary(response.data?.data || null);
      } catch (error) {
        console.error('Failed to fetch patient medical summary:', error);
        setMedicalSummary(null);
      } finally {
        setLoadingMedicalSummary(false);
      }
    };

    fetchMedicalSummary();
  }, [appointment.patient?.id]);

  // Fetch existing vitals and patient status from previous appointments
  useEffect(() => {
    const fetchVitalsData = async () => {
      setLoadingExisting(true);
      try {
        let existingVitals = null;
        let patientStatus = null;

        // 1. Fetch current appointment's vitals if they exist
        if (appointment.vitalsRecordedAt) {
          const response = await opdApi.getBookingTicket(appointment.id);
          existingVitals = response.data?.data?.vitals;
        }

        // 2. Fetch patient's latest status from Medical History (single source of truth)
        // This will be used if current vitals don't have patient status data
        if (appointment.patient?.id) {
          try {
            const statusResponse = await opdApi.getPatientStatus(appointment.patient.id);
            patientStatus = statusResponse.data?.data;
          } catch (err) {
            // Patient may not have medical history yet, that's okay
            console.log('No patient medical history found');
          }
        }

        // Helper to format date to YYYY-MM-DD for date input
        const formatDateForInput = (dateValue: string | Date | null | undefined): string => {
          if (!dateValue) return '';
          try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
          } catch {
            return '';
          }
        };

        // 3. Merge the data - use current vitals for measurements, but fall back to
        // previous patient status for pregnancy/medications/treatment if not set in current
        // Check each field individually for proper carry-over
        const hasCurrentPregnancy = existingVitals?.isPregnant !== null && existingVitals?.isPregnant !== undefined;
        const hasCurrentMedications = existingVitals?.currentMedications && existingVitals.currentMedications.length > 0;
        const hasCurrentTreatment = existingVitals?.currentTreatment;

        setVitals({
          // Vital measurements from current appointment
          temperature: existingVitals?.temperature?.toString() || '',
          bloodPressureSys: existingVitals?.bloodPressureSys?.toString() || '',
          bloodPressureDia: existingVitals?.bloodPressureDia?.toString() || '',
          heartRate: existingVitals?.heartRate?.toString() || '',
          respiratoryRate: existingVitals?.respiratoryRate?.toString() || '',
          oxygenSaturation: existingVitals?.oxygenSaturation?.toString() || '',
          weight: existingVitals?.weight?.toString() || '',
          height: existingVitals?.height?.toString() || '',
          bloodSugar: existingVitals?.bloodSugar?.toString() || '',
          painLevel: existingVitals?.painLevel?.toString() || '',
          notes: existingVitals?.notes || '',
          // Patient status - check each field individually for carry-over
          isPregnant: hasCurrentPregnancy
            ? existingVitals?.isPregnant
            : patientStatus?.isPregnant ?? undefined,
          expectedDueDate: hasCurrentPregnancy
            ? formatDateForInput(existingVitals?.expectedDueDate)
            : formatDateForInput(patientStatus?.expectedDueDate),
          currentMedications: hasCurrentMedications
            ? (existingVitals?.currentMedications || [])
            : (patientStatus?.currentMedications || []),
          currentTreatment: hasCurrentTreatment
            ? (existingVitals?.currentTreatment || '')
            : (patientStatus?.currentTreatment || ''),
        });
      } catch (error) {
        console.error('Failed to fetch vitals data:', error);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchVitalsData();
  }, [appointment.id, appointment.vitalsRecordedAt, appointment.patient?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setVitals((prev) => ({ ...prev, [name]: value }));
  };

  // Add medication to list
  const addMedication = () => {
    if (newMedication.name.trim()) {
      setVitals({
        ...vitals,
        currentMedications: [...vitals.currentMedications, { ...newMedication }],
      });
      setNewMedication({ name: '', dosage: '', frequency: '' });
    }
  };

  // Remove medication from list
  const removeMedication = (index: number) => {
    setVitals({
      ...vitals,
      currentMedications: vitals.currentMedications.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const vitalsData = {
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
        bloodPressureSys: vitals.bloodPressureSys ? parseInt(vitals.bloodPressureSys) : undefined,
        bloodPressureDia: vitals.bloodPressureDia ? parseInt(vitals.bloodPressureDia) : undefined,
        heartRate: vitals.heartRate ? parseInt(vitals.heartRate) : undefined,
        respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : undefined,
        oxygenSaturation: vitals.oxygenSaturation ? parseFloat(vitals.oxygenSaturation) : undefined,
        weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
        height: vitals.height ? parseFloat(vitals.height) : undefined,
        bloodSugar: vitals.bloodSugar ? parseFloat(vitals.bloodSugar) : undefined,
        painLevel: vitals.painLevel ? parseInt(vitals.painLevel) : undefined,
        notes: vitals.notes || undefined,
        // New pregnancy and medication fields
        isPregnant: vitals.isPregnant,
        expectedDueDate: vitals.expectedDueDate || undefined,
        currentMedications: vitals.currentMedications.length > 0 ? vitals.currentMedications : undefined,
        currentTreatment: vitals.currentTreatment || undefined,
      };

      const response = await opdApi.recordVitals(appointment.id, vitalsData);

      // Safely extract and validate risk assessment data
      const responseData = response?.data?.data;
      const riskData = responseData?.riskAssessment;

      // Validate that riskData has the required structure before displaying
      const isValidRiskData = riskData &&
        typeof riskData === 'object' &&
        riskData.news2Score !== undefined &&
        riskData.riskLevel !== undefined;

      if (isValidRiskData) {
        // Ensure recommendedActions is always an array
        const sanitizedRiskData = {
          ...riskData,
          news2Score: Number(riskData.news2Score) || 0,
          riskLevel: String(riskData.riskLevel || 'LOW').toUpperCase(),
          deteriorationProbability: typeof riskData.deteriorationProbability === 'number'
            ? riskData.deteriorationProbability
            : undefined,
          sepsisRisk: riskData.sepsisRisk,
          fallRisk: riskData.fallRisk,
          recommendedActions: Array.isArray(riskData.recommendedActions)
            ? riskData.recommendedActions
            : [],
          escalationRequired: Boolean(riskData.escalationRequired),
        };

        setRiskAssessment(sanitizedRiskData);
        setShowRiskAssessment(true);
        toast.success('Vitals recorded - AI risk assessment generated');
      } else {
        // No valid risk assessment, just close
        toast.success('Vitals recorded successfully');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to record vitals:', error);
      toast.error(error?.response?.data?.message || 'Failed to record vitals');
    } finally {
      setLoading(false);
    }
  };

  // Handle continuing after viewing risk assessment
  const handleContinueAfterRiskAssessment = () => {
    setShowRiskAssessment(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HeartIcon className="h-6 w-6" />
                  {appointment.vitalsRecordedAt ? 'Update' : 'Record'} Pre-Consultation Vitals
                </h2>
                <div className="text-white/90 text-sm mt-1 space-y-0.5">
                  <p className="font-medium">
                    {appointment.patient?.firstName} {appointment.patient?.lastName}
                  </p>
                  <p className="text-white/70 text-xs flex flex-wrap gap-x-3">
                    <span>Booking ID: {appointment.id.slice(0, 8)}...</span>
                    <span>Patient ID: {appointment.patient?.id?.slice(0, 8)}...</span>
                    {appointment.patient?.mrn && <span>MRN: {appointment.patient.mrn}</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto overflow-x-hidden">
            {/* Loading indicator when fetching existing vitals */}
            {loadingExisting && (
              <div className="flex items-center justify-center py-4 text-gray-500">
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                Loading existing vitals...
              </div>
            )}

            {/* Update notice */}
            {appointment.vitalsRecordedAt && !loadingExisting && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <HeartIconSolid className="h-5 w-5 text-amber-500" />
                <span>
                  Vitals previously recorded at{' '}
                  {new Date(appointment.vitalsRecordedAt).toLocaleTimeString()}
                  . You are updating existing values.
                </span>
              </div>
            )}

            {/* Patient Medical History (Read-Only) */}
            {!loadingMedicalSummary && medicalSummary && (
              (medicalSummary.medicalHistory?.chronicConditions?.length > 0 ||
               medicalSummary.medicalHistory?.pastSurgeries?.length > 0 ||
               medicalSummary.medicalHistory?.currentTreatment ||
               medicalSummary.allergies?.length > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <ClipboardDocumentListIcon className="h-5 w-5" />
                    Patient Medical History (Read-Only)
                  </h3>

                  {/* Allergies - Highlighted for safety */}
                  {medicalSummary.allergies?.length > 0 && (
                    <div className="mb-3 p-2.5 bg-red-100 border border-red-300 rounded-lg">
                      <span className="text-xs text-red-700 uppercase font-semibold flex items-center gap-1 mb-1.5">
                        <ExclamationTriangleIcon className="h-4 w-4" /> Allergies
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {medicalSummary.allergies.map((a, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-red-200 text-red-900 rounded text-sm font-medium"
                          >
                            {a.allergen} ({a.severity})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chronic Conditions */}
                  {medicalSummary.medicalHistory?.chronicConditions?.length > 0 && (
                    <div className="mb-3">
                      <span className="text-xs text-gray-500 uppercase font-medium">Chronic Conditions</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {medicalSummary.medicalHistory.chronicConditions.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-sm">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past Surgeries */}
                  {medicalSummary.medicalHistory?.pastSurgeries?.length > 0 && (
                    <div className="mb-3">
                      <span className="text-xs text-gray-500 uppercase font-medium">Past Surgeries</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {medicalSummary.medicalHistory.pastSurgeries.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ongoing Treatment from MedicalHistory */}
                  {medicalSummary.medicalHistory?.currentTreatment && (
                    <div className="mb-3">
                      <span className="text-xs text-gray-500 uppercase font-medium">Ongoing Treatment</span>
                      <p className="mt-1 text-sm text-gray-700 bg-cyan-50 px-2 py-1 rounded">
                        {medicalSummary.medicalHistory.currentTreatment}
                      </p>
                    </div>
                  )}

                  {/* Patient Medications from MedicalHistory */}
                  {medicalSummary.medicalHistory?.currentMedications?.length > 0 && (
                    <div className="mb-3">
                      <span className="text-xs text-gray-500 uppercase font-medium">Current Medications (from Medical History)</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {medicalSummary.medicalHistory.currentMedications.map((m, i) => (
                          <span key={i} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-sm">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pregnancy Status from MedicalHistory */}
                  {medicalSummary.medicalHistory?.isPregnant === true && (
                    <div className="p-2 bg-pink-100 border border-pink-300 rounded-lg">
                      <div className="flex items-center gap-2 text-pink-800">
                        <span className="text-lg">🤰</span>
                        <span className="font-medium text-sm">Patient is Pregnant</span>
                        {medicalSummary.medicalHistory.expectedDueDate && (
                          <span className="text-xs text-pink-600">
                            (Due: {new Date(medicalSummary.medicalHistory.expectedDueDate).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Primary Vitals */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-rose-500 rounded-full" />
                Primary Vitals
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Temperature (°C)
                  </label>
                  <input
                    type="number"
                    name="temperature"
                    value={vitals.temperature}
                    onChange={handleChange}
                    step="0.1"
                    min="32"
                    max="42"
                    placeholder="37.0"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    BP Systolic (mmHg)
                  </label>
                  <input
                    type="number"
                    name="bloodPressureSys"
                    value={vitals.bloodPressureSys}
                    onChange={handleChange}
                    min="60"
                    max="250"
                    placeholder="120"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    BP Diastolic (mmHg)
                  </label>
                  <input
                    type="number"
                    name="bloodPressureDia"
                    value={vitals.bloodPressureDia}
                    onChange={handleChange}
                    min="40"
                    max="150"
                    placeholder="80"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    name="heartRate"
                    value={vitals.heartRate}
                    onChange={handleChange}
                    min="30"
                    max="220"
                    placeholder="72"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Resp. Rate (/min)
                  </label>
                  <input
                    type="number"
                    name="respiratoryRate"
                    value={vitals.respiratoryRate}
                    onChange={handleChange}
                    min="8"
                    max="40"
                    placeholder="16"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    SpO2 (%)
                  </label>
                  <input
                    type="number"
                    name="oxygenSaturation"
                    value={vitals.oxygenSaturation}
                    onChange={handleChange}
                    step="0.1"
                    min="70"
                    max="100"
                    placeholder="98"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Body Measurements */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Body Measurements
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={vitals.weight}
                    onChange={handleChange}
                    step="0.1"
                    min="1"
                    max="500"
                    placeholder="70"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    name="height"
                    value={vitals.height}
                    onChange={handleChange}
                    step="0.1"
                    min="30"
                    max="250"
                    placeholder="170"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Blood Sugar (mg/dL)
                  </label>
                  <input
                    type="number"
                    name="bloodSugar"
                    value={vitals.bloodSugar}
                    onChange={handleChange}
                    step="0.1"
                    min="20"
                    max="600"
                    placeholder="100"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Pain Level (0-10)
                  </label>
                  <input
                    type="number"
                    name="painLevel"
                    value={vitals.painLevel}
                    onChange={handleChange}
                    min="0"
                    max="10"
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Patient Details Section - Pregnancy, Medications, Treatment */}
            <div className="p-4 bg-pink-50 rounded-xl border border-pink-200">
              <h3 className="text-sm font-semibold text-pink-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-pink-500 rounded-full" />
                Patient Details
              </h3>

              {/* Loading indicator */}
              {loadingPatient && (
                <div className="flex items-center justify-center py-2 text-gray-500 text-sm">
                  <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                  Loading patient info...
                </div>
              )}

              {/* Pregnancy Check - Female aged 13-51 only */}
              {showPregnancyQuestion && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Is the patient pregnant? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    <label className={clsx(
                      'flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-colors text-sm',
                      vitals.isPregnant === true ? 'bg-pink-100 border-pink-500 text-pink-700' : 'bg-white border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="radio"
                        name="pregnancy"
                        checked={vitals.isPregnant === true}
                        onChange={() => setVitals({ ...vitals, isPregnant: true })}
                        className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                      />
                      <span className="font-medium">Yes</span>
                    </label>
                    <label className={clsx(
                      'flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-colors text-sm',
                      vitals.isPregnant === false ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="radio"
                        name="pregnancy"
                        checked={vitals.isPregnant === false}
                        onChange={() => setVitals({ ...vitals, isPregnant: false, expectedDueDate: '' })}
                        className="w-4 h-4 text-green-600 focus:ring-green-500"
                      />
                      <span className="font-medium">No</span>
                    </label>
                  </div>

                  {/* Expected Due Date - shown only if pregnant */}
                  {vitals.isPregnant === true && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Expected Due Date <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="date"
                        value={vitals.expectedDueDate}
                        onChange={(e) => setVitals({ ...vitals, expectedDueDate: e.target.value })}
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Current Medications */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Current Medications <span className="text-gray-400">(optional)</span>
                </label>

                {/* Medications List */}
                {vitals.currentMedications.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {vitals.currentMedications.map((med, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                        <div className="flex-1 text-sm">
                          <span className="font-medium text-gray-900">{med.name}</span>
                          {med.dosage && <span className="text-gray-600 ml-2">{med.dosage}</span>}
                          {med.frequency && <span className="text-gray-500 ml-2">({med.frequency})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMedication(index)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Medication */}
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-[120px]">
                    <input
                      type="text"
                      placeholder="Medication name"
                      value={newMedication.name}
                      onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="text"
                      placeholder="Dosage"
                      value={newMedication.dosage}
                      onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="Frequency"
                      value={newMedication.frequency}
                      onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addMedication}
                    disabled={!newMedication.name.trim()}
                    className="flex items-center gap-1 px-3 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              {/* Current Treatment */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Current Treatment / Ongoing Conditions <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={vitals.currentTreatment}
                  onChange={(e) => setVitals({ ...vitals, currentTreatment: e.target.value })}
                  placeholder="e.g., Undergoing chemotherapy, Dialysis 3x/week, Post-surgery recovery..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm resize-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={vitals.notes}
                onChange={handleChange}
                placeholder="Any additional observations..."
                rows={2}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold hover:from-rose-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-5 w-5" />
                    Save Vitals
                  </>
                )}
              </button>
            </div>
          </form>

          {/* AI Risk Assessment Display */}
          {showRiskAssessment && riskAssessment && (
            <div className="absolute inset-0 bg-white z-10 flex flex-col">
              {/* Risk Assessment Header */}
              <div className={clsx(
                'px-6 py-4',
                riskAssessment.riskLevel === 'CRITICAL' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                riskAssessment.riskLevel === 'HIGH' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                riskAssessment.riskLevel === 'MODERATE' ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                'bg-gradient-to-r from-emerald-500 to-emerald-600'
              )}>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <SparklesIcon className="h-6 w-6" />
                  AI Risk Assessment
                </h2>
                <p className="text-white/90 text-sm mt-1">
                  Early Warning Score Analysis for {appointment.patient?.firstName} {appointment.patient?.lastName}
                </p>
              </div>

              {/* Risk Assessment Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Main Score Card */}
                <div className={clsx(
                  'rounded-2xl p-6 border-2',
                  riskAssessment.riskLevel === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                  riskAssessment.riskLevel === 'HIGH' ? 'bg-orange-50 border-orange-200' :
                  riskAssessment.riskLevel === 'MODERATE' ? 'bg-amber-50 border-amber-200' :
                  'bg-emerald-50 border-emerald-200'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">NEWS2 Score</h3>
                      <p className="text-sm text-gray-600">National Early Warning Score</p>
                    </div>
                    <div className={clsx(
                      'text-5xl font-bold',
                      riskAssessment.riskLevel === 'CRITICAL' ? 'text-red-600' :
                      riskAssessment.riskLevel === 'HIGH' ? 'text-orange-600' :
                      riskAssessment.riskLevel === 'MODERATE' ? 'text-amber-600' :
                      'text-emerald-600'
                    )}>
                      {riskAssessment.news2Score || 0}
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className={clsx(
                      'inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold',
                      riskAssessment.riskLevel === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                      riskAssessment.riskLevel === 'HIGH' ? 'bg-orange-200 text-orange-800' :
                      riskAssessment.riskLevel === 'MODERATE' ? 'bg-amber-200 text-amber-800' :
                      'bg-emerald-200 text-emerald-800'
                    )}>
                      {riskAssessment.riskLevel} Risk
                    </span>
                  </div>
                </div>

                {/* Escalation Warning */}
                {riskAssessment.escalationRequired && (
                  <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                    <ExclamationCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-800">Escalation Required</h4>
                      <p className="text-sm text-red-700 mt-1">
                        This patient requires immediate clinical escalation. Please notify the senior medical team.
                      </p>
                    </div>
                  </div>
                )}

                {/* Additional Scores Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {riskAssessment.deteriorationProbability !== undefined && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600">Deterioration Risk</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(riskAssessment.deteriorationProbability * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {riskAssessment.sepsisRisk !== undefined && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600">Sepsis Risk (qSOFA)</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {typeof riskAssessment.sepsisRisk === 'number'
                          ? `${(riskAssessment.sepsisRisk * 100).toFixed(1)}%`
                          : typeof riskAssessment.sepsisRisk === 'object' && riskAssessment.sepsisRisk !== null
                            ? riskAssessment.sepsisRisk.riskLevel || `${((riskAssessment.sepsisRisk.probability || 0) * 100).toFixed(1)}%`
                            : String(riskAssessment.sepsisRisk || 'N/A')}
                      </p>
                    </div>
                  )}
                  {riskAssessment.fallRisk !== undefined && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600">Fall Risk</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {typeof riskAssessment.fallRisk === 'number'
                          ? `${(riskAssessment.fallRisk * 100).toFixed(1)}%`
                          : typeof riskAssessment.fallRisk === 'object' && riskAssessment.fallRisk !== null
                            ? riskAssessment.fallRisk.riskLevel || 'N/A'
                            : String(riskAssessment.fallRisk || 'N/A')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {riskAssessment.recommendedActions && riskAssessment.recommendedActions.length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <ClipboardDocumentListIcon className="h-5 w-5" />
                      Recommended Actions
                    </h4>
                    <ul className="space-y-2">
                      {riskAssessment.recommendedActions.map((action: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                          <CheckCircleIcon className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Continue Button */}
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={handleContinueAfterRiskAssessment}
                  className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OPD() {
  const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'noshow'>('queue');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<OPDStats>({
    inQueue: 0,
    inConsultation: 0,
    avgWaitTime: 0,
    seenToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [selectedAppointmentForVitals, setSelectedAppointmentForVitals] = useState<QueueItem | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';
  const { hasRole } = useAuth();

  // Fetch booking ticket data when a booking is selected
  const { data: bookingTicketData, isLoading: loadingBookingTicket, refetch: refetchBookingTicket } = useBookingData(
    selectedBookingId,
    15000, // Poll every 15 seconds
    !!selectedBookingId
  );

  // Role-based permissions - Updated workflow separation
  // Receptionists (Front Desk): check-in patients, add walk-ins
  // Nurses: record vitals (primary responsibility)
  // Doctors: view queue, call next patient
  const canAddWalkIn = hasRole(['RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);
  const canCheckIn = hasRole(['RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);
  const canRecordVitals = hasRole(['NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);
  const isDoctor = hasRole(['DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);

  // Fetch queue with polling (every 15 seconds)
  useEffect(() => {
    const fetchQueue = async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        const response = await opdApi.getQueue();
        setQueue(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch queue:', error);
        // Only show error on initial load
        if (showLoading) toast.error('Failed to load queue');
      } finally {
        if (showLoading) setLoading(false);
      }
    };

    fetchQueue();

    // Poll every 15 seconds
    const interval = setInterval(() => {
      fetchQueue(false);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await opdApi.getStats();
        setStats(response.data.data || {
          inQueue: 0,
          inConsultation: 0,
          avgWaitTime: 0,
          seenToday: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  // Fetch today's appointments (all statuses)
  useEffect(() => {
    const fetchTodayAppointments = async () => {
      try {
        const response = await opdApi.getTodayAppointments();
        setTodayAppointments(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch today appointments:', error);
      }
    };

    fetchTodayAppointments();

    // Poll every 30 seconds
    const interval = setInterval(fetchTodayAppointments, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCallNext = async (doctorId: string) => {
    try {
      const response = await opdApi.callNext(doctorId);
      if (response.data.data) {
        toast.success(`Called patient: ${response.data.data.patient?.firstName}`);
      } else {
        toast.success('No patients waiting');
      }
      // Refresh queue
      const queueResponse = await opdApi.getQueue();
      setQueue(queueResponse.data.data || []);
    } catch (error) {
      console.error('Failed to call next:', error);
      toast.error('Failed to call next patient');
    }
  };

  const handleOptimizeQueue = () => {
    toast.success('AI is optimizing the queue...');
  };

  // Handle patient check-in (Front Desk / Receptionist only)
  const handleCheckIn = async (appointmentId: string) => {
    try {
      await opdApi.checkIn(appointmentId);
      toast.success('Patient checked in successfully');
      // Refresh queue
      const response = await opdApi.getQueue();
      setQueue(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to check in patient:', error);
      toast.error(error.response?.data?.message || 'Failed to check in patient');
    }
  };

  // Group queue by doctor
  const doctorQueues = queue.reduce((acc, item) => {
    const doctorName = `Dr. ${item.doctor?.user?.firstName || ''} ${item.doctor?.user?.lastName || ''}`.trim();
    if (!acc[doctorName]) {
      acc[doctorName] = {
        doctorId: item.doctor?.user?.firstName || 'unknown',
        specialization: item.doctor?.specialization || 'General',
        patients: [],
      };
    }
    acc[doctorName].patients.push(item);
    return acc;
  }, {} as Record<string, { doctorId: string; specialization: string; patients: QueueItem[] }>);

  const tabs = [
    { id: 'queue', label: 'Live Queue', count: queue.length },
    { id: 'appointments', label: 'Today\'s Appointments', count: todayAppointments.length },
    { id: 'noshow', label: 'No-Show Risk' },
  ];

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Glassmorphism Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 p-8 shadow-xl">
        {/* Floating Orbs */}
        <div className="absolute top-4 right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-cyan-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-blue-200/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />

        {/* Glass Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white/90 text-sm font-medium mb-3">
              <span className="w-2 h-2 bg-cyan-300 rounded-full mr-2 animate-pulse" />
              Outpatient Department
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">OPD Queue Management</h1>
            <p className="mt-2 text-blue-100">
              Queue management and consultation tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAIOnline && (
              <button
                onClick={handleOptimizeQueue}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white font-medium shadow-lg hover:bg-white/30 hover:scale-105 transition-all duration-300"
              >
                <SparklesIcon className="h-5 w-5 group-hover:animate-spin" />
                Optimize Queue
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400/0 via-purple-400/30 to-purple-400/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            {/* Walk-in Patient button - only for nurses, receptionists, admins (not doctors) */}
            {canAddWalkIn && (
              <button
                onClick={() => setShowWalkInModal(true)}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white font-semibold shadow-lg hover:bg-white/30 hover:scale-105 transition-all duration-300"
              >
                <PlusIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                Walk-in Patient
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Animated Gradient Tabs */}
      <div className="relative rounded-xl bg-white/70 backdrop-blur-xl border border-white/50 p-2 shadow-lg">
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <nav className="flex space-x-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'relative py-3 px-6 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                  : 'text-gray-600 hover:bg-white/50'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={clsx(
                  'ml-2 py-0.5 px-2.5 rounded-full text-xs font-semibold',
                  activeTab === tab.id
                    ? 'bg-white/25 text-white'
                    : 'bg-gray-200/80 text-gray-600'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {loading ? (
            <div
              className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 p-8 text-center shadow-lg animate-fade-in"
              style={{ animationDelay: '0ms' }}
            >
              {/* Shine line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-blue-500" />
              <p className="mt-2 text-gray-600">Loading queue...</p>
            </div>
          ) : Object.keys(doctorQueues).length === 0 ? (
            <div
              className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 p-8 text-center shadow-lg animate-fade-in"
              style={{ animationDelay: '0ms' }}
            >
              {/* Shine line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <ClipboardDocumentListIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No patients in queue</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {Object.entries(doctorQueues).map(([doctorName, { doctorId, specialization, patients }], index) => (
                <div
                  key={doctorName}
                  className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Shine line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                  <div className="p-5 border-b border-gray-200/50 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{doctorName}</h3>
                      <p className="text-sm text-gray-500">{specialization}</p>
                    </div>
                    <button
                      onClick={() => handleCallNext(doctorId)}
                      className="group relative inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300"
                    >
                      <MegaphoneIcon className="h-4 w-4" />
                      Call Next
                    </button>
                  </div>
                  <div className="divide-y divide-gray-200/50">
                    {patients.map((patient, patientIndex) => (
                      <div
                        key={patient.id}
                        className={clsx(
                          'p-4 flex items-center justify-between transition-colors duration-200',
                          patient.status === 'IN_CONSULTATION'
                            ? 'bg-emerald-50/50'
                            : 'hover:bg-white/50'
                        )}
                        style={{ animationDelay: `${(index * 100) + (patientIndex * 50)}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md',
                            patient.status === 'IN_CONSULTATION'
                              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
                              : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700'
                          )}>
                            {patient.tokenNumber}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {patient.patient?.firstName} {patient.patient?.lastName}
                            </h4>
                            {/* Enhanced Status Indicators based on workflow stage */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {patient.status === 'IN_PROGRESS' || patient.status === 'IN_CONSULTATION' ? (
                                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                  In Consultation
                                </span>
                              ) : patient.status === 'SCHEDULED' || patient.status === 'CONFIRMED' ? (
                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                  <ClockIcon className="h-3 w-3" />
                                  Awaiting Check-in
                                </span>
                              ) : patient.status === 'CHECKED_IN' && !patient.vitalsRecordedAt ? (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                  <ExclamationCircleIcon className="h-3 w-3" />
                                  Awaiting Vitals
                                </span>
                              ) : patient.status === 'CHECKED_IN' && patient.vitalsRecordedAt ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  <CheckCircleIcon className="h-3 w-3" />
                                  Ready for Doctor
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                                  <ClockIcon className="h-3.5 w-3.5" />
                                  ~{patient.estimatedWaitTime || 15} min
                                </span>
                              )}
                              {/* Vitals Recorded Badge */}
                              {patient.vitalsRecordedAt && (
                                <span className="inline-flex items-center gap-1 text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                  <HeartIconSolid className="h-3 w-3" />
                                  Vitals
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Check-in Button - only for Front Desk / Receptionists on SCHEDULED/CONFIRMED patients */}
                          {(patient.status === 'SCHEDULED' || patient.status === 'CONFIRMED') && canCheckIn && (
                            <button
                              onClick={() => handleCheckIn(patient.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300"
                            >
                              <CheckIcon className="h-3.5 w-3.5" />
                              Check In
                            </button>
                          )}
                          {/* View Booking Button */}
                          <button
                            onClick={() => setSelectedBookingId(patient.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all duration-300"
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                            View
                          </button>
                          {/* Record Vitals Button - only for nurses and admins on CHECKED_IN patients */}
                          {patient.status === 'CHECKED_IN' && canRecordVitals && (
                            <button
                              onClick={() => setSelectedAppointmentForVitals(patient)}
                              className={clsx(
                                'group relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300',
                                patient.vitalsRecordedAt
                                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                  : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25 hover:shadow-rose-500/40 hover:scale-105'
                              )}
                            >
                              <HeartIcon className="h-3.5 w-3.5" />
                              {patient.vitalsRecordedAt ? 'Update Vitals' : 'Record Vitals'}
                            </button>
                          )}
                          {/* Start Consultation Button - only for DOCTOR on CHECKED_IN patients with vitals */}
                          {patient.status === 'CHECKED_IN' && patient.vitalsRecordedAt && isDoctor && (
                            <Link
                              to={`/consultation/${patient.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300"
                            >
                              <PlayIcon className="h-3.5 w-3.5" />
                              Start Consultation
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No-Show Risk Tab */}
      {activeTab === 'noshow' && isAIOnline && (
        <div
          className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg overflow-hidden animate-fade-in"
          style={{ animationDelay: '0ms' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <div className="p-5 border-b border-gray-200/50 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25">
              <SparklesIcon className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900">AI No-Show Risk Prediction</h3>
          </div>
          <div className="p-8 text-center">
            <p className="text-gray-500">AI predictions will appear here based on historical patterns</p>
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="space-y-4">
          {todayAppointments.length === 0 ? (
            <div
              className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 p-8 text-center shadow-lg animate-fade-in"
              style={{ animationDelay: '0ms' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <ClipboardDocumentListIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-semibold text-gray-900">No Appointments Today</h3>
              <p className="text-sm text-gray-500 mt-1">There are no scheduled appointments for today</p>
            </div>
          ) : (
            <div
              className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg overflow-hidden animate-fade-in"
              style={{ animationDelay: '0ms' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="p-5 border-b border-gray-200/50">
                <h3 className="font-semibold text-gray-900">Today's Appointments ({todayAppointments.length})</h3>
                <p className="text-sm text-gray-500">All scheduled appointments for today</p>
              </div>
              <div className="divide-y divide-gray-200/50">
                {todayAppointments.map((appointment, index) => (
                  <div
                    key={appointment.id}
                    className={clsx(
                      'p-4 flex items-center justify-between transition-colors duration-200',
                      appointment.status === 'IN_PROGRESS' || appointment.status === 'IN_CONSULTATION'
                        ? 'bg-emerald-50/50'
                        : appointment.status === 'COMPLETED'
                        ? 'bg-gray-50/50'
                        : 'hover:bg-white/50'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md',
                        appointment.status === 'COMPLETED'
                          ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                          : appointment.status === 'IN_PROGRESS' || appointment.status === 'IN_CONSULTATION'
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
                          : appointment.status === 'CHECKED_IN'
                          ? 'bg-gradient-to-br from-cyan-400 to-cyan-600 text-white'
                          : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700'
                      )}>
                        {appointment.tokenNumber || '#'}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {appointment.patient?.firstName} {appointment.patient?.lastName}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-500">
                            Dr. {appointment.doctor?.user?.firstName} {appointment.doctor?.user?.lastName}
                          </span>
                          <span className="text-gray-300">|</span>
                          <span className="text-sm text-gray-500">{appointment.doctor?.specialization}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Status Badge */}
                      <span className={clsx(
                        'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full',
                        appointment.status === 'COMPLETED'
                          ? 'bg-gray-100 text-gray-600'
                          : appointment.status === 'IN_PROGRESS' || appointment.status === 'IN_CONSULTATION'
                          ? 'bg-emerald-100 text-emerald-700'
                          : appointment.status === 'CHECKED_IN'
                          ? 'bg-cyan-100 text-cyan-700'
                          : appointment.status === 'CONFIRMED'
                          ? 'bg-blue-100 text-blue-700'
                          : appointment.status === 'NO_SHOW'
                          ? 'bg-red-100 text-red-700'
                          : appointment.status === 'CANCELLED'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                      )}>
                        {appointment.status === 'IN_PROGRESS' || appointment.status === 'IN_CONSULTATION' ? (
                          <>
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            In Consultation
                          </>
                        ) : appointment.status === 'CHECKED_IN' ? (
                          'Checked In'
                        ) : appointment.status === 'CONFIRMED' ? (
                          'Confirmed'
                        ) : appointment.status === 'SCHEDULED' ? (
                          'Scheduled'
                        ) : appointment.status === 'COMPLETED' ? (
                          'Completed'
                        ) : appointment.status === 'NO_SHOW' ? (
                          'No Show'
                        ) : appointment.status === 'CANCELLED' ? (
                          'Cancelled'
                        ) : (
                          appointment.status
                        )}
                      </span>
                      {/* View Button */}
                      <button
                        onClick={() => setSelectedBookingId(appointment.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all duration-300"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        View
                      </button>
                      {/* Check-in Button for SCHEDULED/CONFIRMED */}
                      {(appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED') && canCheckIn && (
                        <button
                          onClick={() => handleCheckIn(appointment.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md hover:scale-105 transition-all duration-300"
                        >
                          <CheckIcon className="h-3.5 w-3.5" />
                          Check In
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats with Glassmorphism */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'In Queue', value: stats.inQueue, gradient: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-500/10', dotColor: 'bg-blue-500' },
          { label: 'In Consultation', value: stats.inConsultation, gradient: 'from-emerald-500 to-emerald-600', bgColor: 'bg-emerald-500/10', dotColor: 'bg-emerald-500' },
          { label: 'Avg Wait Time', value: `${stats.avgWaitTime} min`, gradient: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10', dotColor: 'bg-amber-500' },
          { label: 'Seen Today', value: stats.seenToday, gradient: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-500/10', dotColor: 'bg-purple-500' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={clsx(
              'relative rounded-2xl backdrop-blur-xl border border-white/50 p-5 shadow-lg overflow-hidden animate-fade-in min-w-0',
              stat.bgColor
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            <div className="flex items-center gap-2 mb-2">
              <span className={clsx('w-2 h-2 rounded-full', stat.dotColor)} />
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            </div>
            <p className={clsx('text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent', stat.gradient)}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Walk-in Patient Modal */}
      {showWalkInModal && (
        <WalkInModal
          onClose={() => setShowWalkInModal(false)}
          onSuccess={() => {
            setShowWalkInModal(false);
            // Refresh queue
            const fetchQueue = async () => {
              try {
                const response = await opdApi.getQueue();
                setQueue(response.data.data || []);
              } catch (error) {
                console.error('Failed to fetch queue:', error);
              }
            };
            fetchQueue();
          }}
        />
      )}

      {/* Vitals Recording Modal */}
      {selectedAppointmentForVitals && (
        <VitalsRecordingModal
          appointment={selectedAppointmentForVitals}
          onClose={() => setSelectedAppointmentForVitals(null)}
          onSuccess={() => {
            setSelectedAppointmentForVitals(null);
            // Refresh queue
            const fetchQueue = async () => {
              try {
                const response = await opdApi.getQueue();
                setQueue(response.data.data || []);
              } catch (error) {
                console.error('Failed to fetch queue:', error);
              }
            };
            fetchQueue();
          }}
        />
      )}

      {/* Booking Ticket Modal */}
      {selectedBookingId && bookingTicketData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <BookingTicket
              data={bookingTicketData}
              isLoading={loadingBookingTicket}
              onRefresh={() => refetchBookingTicket()}
              onClose={() => setSelectedBookingId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
