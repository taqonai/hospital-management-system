import { useState, useEffect } from 'react';
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

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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

// Vitals Recording Modal for pre-consultation
interface VitalsModalProps {
  appointment: QueueItem;
  onClose: () => void;
  onSuccess: () => void;
}

function VitalsRecordingModal({ appointment, onClose, onSuccess }: VitalsModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
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
  });

  // Fetch existing vitals to pre-populate the form when updating
  useEffect(() => {
    const fetchExistingVitals = async () => {
      if (!appointment.vitalsRecordedAt) return; // Only fetch if vitals were previously recorded

      setLoadingExisting(true);
      try {
        const response = await opdApi.getBookingTicket(appointment.id);
        const existingVitals = response.data?.data?.vitals;
        if (existingVitals) {
          setVitals({
            temperature: existingVitals.temperature?.toString() || '',
            bloodPressureSys: existingVitals.bloodPressureSys?.toString() || '',
            bloodPressureDia: existingVitals.bloodPressureDia?.toString() || '',
            heartRate: existingVitals.heartRate?.toString() || '',
            respiratoryRate: existingVitals.respiratoryRate?.toString() || '',
            oxygenSaturation: existingVitals.oxygenSaturation?.toString() || '',
            weight: existingVitals.weight?.toString() || '',
            height: existingVitals.height?.toString() || '',
            bloodSugar: existingVitals.bloodSugar?.toString() || '',
            painLevel: existingVitals.painLevel?.toString() || '',
            notes: existingVitals.notes || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch existing vitals:', error);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchExistingVitals();
  }, [appointment.id, appointment.vitalsRecordedAt]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setVitals((prev) => ({ ...prev, [name]: value }));
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
      };

      await opdApi.recordVitals(appointment.id, vitalsData);
      toast.success('Vitals recorded successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to record vitals:', error);
      toast.error(error.response?.data?.message || 'Failed to record vitals');
    } finally {
      setLoading(false);
    }
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

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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

            {/* Primary Vitals */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-rose-500 rounded-full" />
                Primary Vitals
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Temperature (°F)
                  </label>
                  <input
                    type="number"
                    name="temperature"
                    value={vitals.temperature}
                    onChange={handleChange}
                    step="0.1"
                    min="90"
                    max="110"
                    placeholder="98.6"
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
        </div>
      </div>
    </div>
  );
}

export default function OPD() {
  const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'noshow'>('queue');
  const [queue, setQueue] = useState<QueueItem[]>([]);
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

  // Role-based permissions
  // Nurses and receptionists can: add walk-ins, record vitals, manage queue
  // Doctors can: view queue, call next patient
  const canAddWalkIn = hasRole(['NURSE', 'RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);
  const canRecordVitals = hasRole(['NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);

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
    { id: 'appointments', label: 'Today\'s Appointments', count: stats.seenToday + queue.length },
    { id: 'noshow', label: 'No-Show Risk' },
  ];

  return (
    <div className="space-y-6">
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
                            <div className="flex items-center gap-2">
                              {patient.status === 'IN_CONSULTATION' ? (
                                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                  In Consultation
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                                  <ClockIcon className="h-3.5 w-3.5" />
                                  ~{patient.estimatedWaitTime || 15} min
                                </span>
                              )}
                              {/* Vitals Status Indicator */}
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
                          {/* View Booking Button */}
                          <button
                            onClick={() => setSelectedBookingId(patient.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all duration-300"
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                            View
                          </button>
                          {/* Record Vitals Button - only for nurses and admins (not doctors) */}
                          {patient.status !== 'IN_CONSULTATION' && canRecordVitals && (
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
        <div
          className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 p-8 text-center shadow-lg animate-fade-in"
          style={{ animationDelay: '0ms' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <ClipboardDocumentListIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="font-semibold text-gray-900">Today's Appointments</h3>
          <p className="text-sm text-gray-500 mt-1">View and manage scheduled appointments</p>
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
              'relative rounded-2xl backdrop-blur-xl border border-white/50 p-5 shadow-lg overflow-hidden animate-fade-in',
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
