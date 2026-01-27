import { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  UserPlusIcon,
  SparklesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { emergencyApi, patientApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import EDBeds from './EDBeds';
import ResuscitationDashboard from './ResuscitationDashboard';
import BloodBank from './BloodBank';
import OnCallDoctors from './OnCallDoctors';

interface EDPatient {
  id: string;
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  chiefComplaint: string;
  esiLevel: number;
  arrivalTime: string;
  status: string;
  triageNotes?: string;
  doctor?: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  vitals?: Array<{
    id: string;
    temperature?: string;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: string;
    recordedAt: string;
  }>;
  allergies?: Array<{
    id: string;
    allergen: string;
    severity: string;
  }>;
}

interface EmergencyStats {
  inDepartment: number;
  avgWaitTime: number;
  treatedToday: number;
  admitted: number;
}

const esiColors: Record<number, string> = {
  1: 'bg-red-600 text-white',
  2: 'bg-orange-500 text-white',
  3: 'bg-yellow-500 text-black',
  4: 'bg-green-500 text-white',
  5: 'bg-blue-500 text-white',
};

const esiLabels: Record<number, string> = {
  1: 'Resuscitation',
  2: 'Emergent',
  3: 'Urgent',
  4: 'Less Urgent',
  5: 'Non-Urgent',
};

interface ESIResult {
  esiLevel: number;
  category: string;
  reasoning: string[];
  recommendations: string[];
  estimatedResources: number;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

// New ED Patient Modal Component
function NewEDPatientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    phone: '',
    chiefComplaint: '',
    esiLevel: 3,
    arrivalMode: 'WALK_IN',
    notes: '',
  });

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
    if (!selectedPatient && !isNewPatient) {
      toast.error('Please select a patient or create new');
      return;
    }
    if (!formData.chiefComplaint.trim()) {
      toast.error('Please enter chief complaint');
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        chiefComplaint: formData.chiefComplaint,
        esiLevel: formData.esiLevel,
        arrivalMode: formData.arrivalMode,
        triageNotes: formData.notes || undefined,
      };

      if (selectedPatient) {
        data.patientId = selectedPatient.id;
      } else if (isNewPatient) {
        // Backend expects flat fields, not wrapped in newPatient object
        data.firstName = formData.firstName;
        data.lastName = formData.lastName;
        data.dateOfBirth = formData.dateOfBirth;
        data.gender = formData.gender;
        data.phone = formData.phone;
      }

      await emergencyApi.registerPatient(data);
      toast.success('Patient registered in ED');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to register patient:', error);
      toast.error(error.response?.data?.message || 'Failed to register patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 via-rose-500 to-red-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Register ED Patient</h2>
            <p className="text-red-100 text-sm">Add a patient to the emergency department</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setIsNewPatient(false); setSelectedPatient(null); }}
                className={clsx('flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-all', !isNewPatient ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                Existing Patient
              </button>
              <button type="button" onClick={() => { setIsNewPatient(true); setSelectedPatient(null); }}
                className={clsx('flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-all', isNewPatient ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                New Patient
              </button>
            </div>

            {/* Patient Selection */}
            {!isNewPatient ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient <span className="text-red-500">*</span></label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div>
                      <span className="font-medium text-gray-900">{selectedPatient.firstName} {selectedPatient.lastName}</span>
                      <span className="ml-2 text-sm text-gray-500">MRN: {selectedPatient.mrn}</span>
                    </div>
                    <button type="button" onClick={() => setSelectedPatient(null)} className="text-sm text-red-600 hover:text-red-700">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name or MRN..."
                        className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50" />
                      {searching && <ArrowPathIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />}
                    </div>
                    {patients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {patients.map((patient) => (
                          <button key={patient.id} type="button" onClick={() => { setSelectedPatient(patient); setSearchQuery(''); setPatients([]); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl">
                            <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                            <span className="ml-2 text-sm text-gray-500">MRN: {patient.mrn}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* New Patient Form */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50" required={isNewPatient} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50" required={isNewPatient} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                    <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50">
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50" />
                </div>
              </>
            )}

            {/* ED Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chief Complaint <span className="text-red-500">*</span></label>
              <textarea value={formData.chiefComplaint} onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                placeholder="e.g., Chest pain, difficulty breathing..." rows={2}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ESI Level</label>
                <select value={formData.esiLevel} onChange={(e) => setFormData({ ...formData, esiLevel: Number(e.target.value) })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50">
                  <option value={1}>1 - Resuscitation</option>
                  <option value={2}>2 - Emergent</option>
                  <option value={3}>3 - Urgent</option>
                  <option value={4}>4 - Less Urgent</option>
                  <option value={5}>5 - Non-Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arrival Mode</label>
                <select value={formData.arrivalMode} onChange={(e) => setFormData({ ...formData, arrivalMode: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50">
                  <option value="WALK_IN">Walk-in</option>
                  <option value="AMBULANCE">Ambulance</option>
                  <option value="POLICE">Police</option>
                  <option value="TRANSFER">Transfer</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" disabled={loading || (!selectedPatient && !isNewPatient)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {loading ? <><ArrowPathIcon className="h-5 w-5 animate-spin" />Registering...</> : <><UserPlusIcon className="h-5 w-5" />Register Patient</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Update Triage Modal
function UpdateTriageModal({ 
  patientId, 
  currentESI, 
  onClose, 
  onSuccess 
}: { 
  patientId: string; 
  currentESI: number; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [esiLevel, setEsiLevel] = useState(currentESI);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await emergencyApi.updateTriage(patientId, esiLevel, notes);
      toast.success('Triage level updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to update triage:', error);
      toast.error(error.response?.data?.message || 'Failed to update triage level');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white">Update Triage Level</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New ESI Level</label>
            <select 
              value={esiLevel} 
              onChange={(e) => setEsiLevel(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              <option value={1}>1 - Resuscitation (Critical)</option>
              <option value={2}>2 - Emergent (High Risk)</option>
              <option value={3}>3 - Urgent (Stable)</option>
              <option value={4}>4 - Less Urgent</option>
              <option value={5}>5 - Non-Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for triage update..."
              rows={3}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
            />
          </div>

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
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <><ArrowPathIcon className="h-5 w-5 animate-spin" />Updating...</> : 'Update Triage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Assign Doctor Modal
function AssignDoctorModal({ 
  patientId, 
  onClose, 
  onSuccess 
}: { 
  patientId: string; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingDoctors, setFetchingDoctors] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await emergencyApi.getAvailableDoctors();
        setDoctors(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch doctors:', error);
        toast.error('Failed to load available doctors');
      } finally {
        setFetchingDoctors(false);
      }
    };

    fetchDoctors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      toast.error('Please select a doctor');
      return;
    }

    setLoading(true);
    
    try {
      await emergencyApi.assignDoctor(patientId, selectedDoctorId);
      toast.success('Doctor assigned successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to assign doctor:', error);
      toast.error(error.response?.data?.message || 'Failed to assign doctor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white">Assign Doctor</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Doctor</label>
            {fetchingDoctors ? (
              <div className="flex items-center justify-center py-8">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No doctors available at the moment.</p>
                <p className="text-sm mt-2">Please contact the charge nurse.</p>
              </div>
            ) : (
              <select 
                value={selectedDoctorId} 
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">Select a doctor...</option>
                {doctors.map((doctor: any) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} - {doctor.specialization} ({doctor.activePatients} patients)
                  </option>
                ))}
              </select>
            )}
          </div>

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
              disabled={loading || !selectedDoctorId}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <><ArrowPathIcon className="h-5 w-5 animate-spin" />Assigning...</> : 'Assign Doctor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Admit Patient Modal
function AdmitPatientModal({ 
  patientId, 
  onClose, 
  onSuccess 
}: { 
  patientId: string; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [beds, setBeds] = useState<any[]>([]);
  const [bedId, setBedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingBeds, setFetchingBeds] = useState(true);

  useEffect(() => {
    const fetchBeds = async () => {
      try {
        const response = await emergencyApi.getAvailableBeds();
        setBeds(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch beds:', error);
        toast.error('Failed to load available beds');
      } finally {
        setFetchingBeds(false);
      }
    };

    fetchBeds();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedId) {
      toast.error('Please enter a bed ID');
      return;
    }

    setLoading(true);
    
    try {
      await emergencyApi.admit(patientId, bedId);
      toast.success('Patient admitted successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to admit patient:', error);
      toast.error(error.response?.data?.message || 'Failed to admit patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white">Admit Patient</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Bed <span className="text-red-500">*</span></label>
            {fetchingBeds ? (
              <div className="flex items-center justify-center py-8">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : beds.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No beds available at the moment.</p>
                <p className="text-sm mt-2">Please contact bed management.</p>
              </div>
            ) : (
              <select
                value={bedId}
                onChange={(e) => setBedId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                required
              >
                <option value="">Select a bed...</option>
                {beds.map((bed: any) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.ward} - Bed {bed.bedNumber} {bed.floor ? `(Floor ${bed.floor})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

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
              disabled={loading || !bedId}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <><ArrowPathIcon className="h-5 w-5 animate-spin" />Admitting...</> : 'Admit Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Discharge Patient Modal
function DischargePatientModal({ 
  patientId, 
  onClose, 
  onSuccess 
}: { 
  patientId: string; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    
    try {
      await emergencyApi.discharge(patientId, notes);
      toast.success('Patient discharged successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to discharge patient:', error);
      toast.error(error.response?.data?.message || 'Failed to discharge patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white">Discharge Patient</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Notes</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Discharge instructions, follow-up care, prescriptions..."
              rows={5}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>

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
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <><ArrowPathIcon className="h-5 w-5 animate-spin" />Discharging...</> : 'Discharge Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface IncomingAmbulance {
  id: string;
  ambulanceNumber: string;
  vehicleType: string;
  patientInfo: string;
  chiefComplaint: string;
  tripType: string;
  estimatedArrival: string;
  etaMinutes: number | null;
  pickupLocation: string;
  status: string;
  vitals: any;
}

export default function Emergency() {
  const [activeTab, setActiveTab] = useState<'triageRegister' | 'tracking' | 'waiting' | 'beds' | 'resus' | 'bloodBank' | 'onCall'>('tracking');
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patients, setPatients] = useState<EDPatient[]>([]);
  const [incomingAmbulances, setIncomingAmbulances] = useState<IncomingAmbulance[]>([]);
  const [stats, setStats] = useState<EmergencyStats>({
    inDepartment: 0,
    avgWaitTime: 0,
    treatedToday: 0,
    admitted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  
  // Action modals state
  const [showUpdateTriageModal, setShowUpdateTriageModal] = useState(false);
  const [showAssignDoctorModal, setShowAssignDoctorModal] = useState(false);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [actionPatientId, setActionPatientId] = useState<string | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [esiResult, setEsiResult] = useState<ESIResult | null>(null);
  const [triageForm, setTriageForm] = useState({
    chiefComplaint: '',
    painScale: 5,
    mentalStatus: 'alert' as 'alert' | 'voice' | 'pain' | 'unresponsive',
    bloodPressureSys: 120,
    bloodPressureDia: 80,
    heartRate: 80,
    respiratoryRate: 16,
    oxygenSaturation: 98,
    temperature: 37.0,
    isPregnant: false,
  });
  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  // Unified Triage & Register workflow state
  const [currentStep, setCurrentStep] = useState(1);
  const [unifiedFormData, setUnifiedFormData] = useState({
    // Patient selection
    selectedPatient: null as Patient | null,
    isNewPatient: false,
    // New patient data
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    phone: '',
    // Triage data
    chiefComplaint: '',
    painScale: 5,
    mentalStatus: 'alert' as 'alert' | 'voice' | 'pain' | 'unresponsive',
    bloodPressureSys: 120,
    bloodPressureDia: 80,
    heartRate: 80,
    respiratoryRate: 16,
    oxygenSaturation: 98,
    temperature: 37.0,
    isPregnant: false,
    arrivalMode: 'WALK_IN',
    notes: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Search patients for unified workflow
  const searchPatients = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await patientApi.getAll({ search: query, limit: 10 });
      setSearchResults(response.data.data || []);
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

  // Reset unified workflow
  const resetUnifiedWorkflow = () => {
    setCurrentStep(1);
    setUnifiedFormData({
      selectedPatient: null,
      isNewPatient: false,
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'MALE',
      phone: '',
      chiefComplaint: '',
      painScale: 5,
      mentalStatus: 'alert',
      bloodPressureSys: 120,
      bloodPressureDia: 80,
      heartRate: 80,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      temperature: 37.0,
      isPregnant: false,
      arrivalMode: 'WALK_IN',
      notes: '',
    });
    setEsiResult(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Handle AI Triage for unified workflow
  const handleUnifiedAITriage = async () => {
    if (!unifiedFormData.chiefComplaint.trim()) {
      toast.error('Please enter the chief complaint');
      return;
    }

    try {
      setTriageLoading(true);
      setEsiResult(null);
      const response = await emergencyApi.calculateESI({
        chiefComplaint: unifiedFormData.chiefComplaint,
        vitals: {
          heartRate: unifiedFormData.heartRate,
          respiratoryRate: unifiedFormData.respiratoryRate,
          oxygenSaturation: unifiedFormData.oxygenSaturation,
          bloodPressureSys: unifiedFormData.bloodPressureSys,
          bloodPressureDia: unifiedFormData.bloodPressureDia,
          temperature: unifiedFormData.temperature,
        },
        painScale: unifiedFormData.painScale,
        mentalStatus: unifiedFormData.mentalStatus,
        isPregnant: unifiedFormData.isPregnant,
      });
      setEsiResult(response.data.data);
      toast.success(`ESI Level ${response.data.data.esiLevel} - ${response.data.data.category}`);
      setCurrentStep(3); // Move to results step
    } catch (error) {
      console.error('Failed to calculate ESI:', error);
      toast.error('Failed to calculate ESI level');
    } finally {
      setTriageLoading(false);
    }
  };

  // Handle final registration
  const handleUnifiedRegistration = async () => {
    if (!unifiedFormData.selectedPatient && !unifiedFormData.isNewPatient) {
      toast.error('Please select or create a patient');
      return;
    }
    if (!unifiedFormData.chiefComplaint.trim()) {
      toast.error('Please enter chief complaint');
      return;
    }
    if (!esiResult) {
      toast.error('Please calculate ESI level first');
      return;
    }

    setRegistering(true);
    try {
      const data: any = {
        chiefComplaint: unifiedFormData.chiefComplaint,
        esiLevel: esiResult.esiLevel,
        arrivalMode: unifiedFormData.arrivalMode,
        triageNotes: unifiedFormData.notes || undefined,
      };

      if (unifiedFormData.selectedPatient) {
        data.patientId = unifiedFormData.selectedPatient.id;
      } else if (unifiedFormData.isNewPatient) {
        data.firstName = unifiedFormData.firstName;
        data.lastName = unifiedFormData.lastName;
        data.dateOfBirth = unifiedFormData.dateOfBirth;
        data.gender = unifiedFormData.gender;
        data.phone = unifiedFormData.phone;
      }

      await emergencyApi.registerPatient(data);
      toast.success('Patient registered in ED successfully!');
      resetUnifiedWorkflow();
      setActiveTab('tracking'); // Switch to tracking tab
      await fetchData(false);
    } catch (error: any) {
      console.error('Failed to register patient:', error);
      toast.error(error.response?.data?.message || 'Failed to register patient');
    } finally {
      setRegistering(false);
    }
  };

  // Fetch ED patients and stats (reusable function)
  const fetchData = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      
      // Fetch patients, stats, and incoming ambulances in parallel (resilient — partial failures don't break everything)
      const [patientsResult, statsResult, ambulancesResult] = await Promise.allSettled([
        emergencyApi.getPatients(),
        emergencyApi.getStats(),
        emergencyApi.getIncomingAmbulances(),
      ]);
      
      if (patientsResult.status === 'fulfilled') {
        setPatients(patientsResult.value.data.data || []);
      } else {
        console.error('Failed to fetch patients:', patientsResult.reason);
      }
      
      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data.data || {
          inDepartment: 0,
          avgWaitTime: 0,
          treatedToday: 0,
          admitted: 0,
        });
      } else {
        console.error('Failed to fetch stats:', statsResult.reason);
      }
      
      if (ambulancesResult.status === 'fulfilled') {
        setIncomingAmbulances(ambulancesResult.value.data.data || []);
      } else {
        console.error('Failed to fetch ambulances:', ambulancesResult.reason);
      }
      
      // Show error only if ALL calls failed
      const allFailed = [patientsResult, statsResult, ambulancesResult].every(r => r.status === 'rejected');
      if (allFailed && showLoader) {
        toast.error('Failed to load ED data');
      }
      
      setLastUpdated(new Date());
      setSecondsSinceUpdate(0);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      if (showLoader) toast.error('Failed to load ED data');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchData(false); // Don't show loader for background refresh
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, []);

  // Update "seconds since last update" counter every second
  useEffect(() => {
    const counterInterval = setInterval(() => {
      setSecondsSinceUpdate((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(counterInterval);
  }, [lastUpdated]);

  const handleAITriage = async () => {
    if (!triageForm.chiefComplaint.trim()) {
      toast.error('Please enter the chief complaint');
      return;
    }

    try {
      setTriageLoading(true);
      setEsiResult(null);
      const response = await emergencyApi.calculateESI({
        chiefComplaint: triageForm.chiefComplaint,
        vitals: {
          heartRate: triageForm.heartRate,
          respiratoryRate: triageForm.respiratoryRate,
          oxygenSaturation: triageForm.oxygenSaturation,
          bloodPressureSys: triageForm.bloodPressureSys,
          bloodPressureDia: triageForm.bloodPressureDia,
          temperature: triageForm.temperature,
        },
        painScale: triageForm.painScale,
        mentalStatus: triageForm.mentalStatus,
        isPregnant: triageForm.isPregnant,
      });
      setEsiResult(response.data.data);
      toast.success(`ESI Level ${response.data.data.esiLevel} - ${response.data.data.category}`);
    } catch (error) {
      console.error('Failed to calculate ESI:', error);
      toast.error('Failed to calculate ESI level');
    } finally {
      setTriageLoading(false);
    }
  };

  const handlePredictWaitTime = () => {
    toast.success('AI is calculating wait times...');
  };

  const resetTriageForm = () => {
    setTriageForm({
      chiefComplaint: '',
      painScale: 5,
      mentalStatus: 'alert',
      bloodPressureSys: 120,
      bloodPressureDia: 80,
      heartRate: 80,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      temperature: 37.0,
      isPregnant: false,
    });
    setEsiResult(null);
  };

  const criticalCount = patients.filter(p => p.esiLevel <= 2).length;

  // Count patients by ESI level
  const esiCounts = [1, 2, 3, 4, 5].map(level => patients.filter(p => p.esiLevel === level).length);

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const calculateWaitTime = (arrivalTime: string) => {
    if (!arrivalTime) return 0;
    const arrival = new Date(arrivalTime);
    if (isNaN(arrival.getTime())) return 0;
    const now = new Date();
    return Math.round((now.getTime() - arrival.getTime()) / (1000 * 60));
  };

  const tabs = [
    { id: 'triageRegister', label: 'Triage & Register' },
    { id: 'tracking', label: 'Patient Tracking', count: patients.length },
    { id: 'waiting', label: 'Waiting Room', count: patients.filter(p => p.status === 'WAITING').length },
    { id: 'beds', label: 'ED Beds' },
    { id: 'resus', label: 'Resuscitation', count: criticalCount },
    { id: 'bloodBank', label: 'Blood Bank' },
    { id: 'onCall', label: 'On-Call Doctors' },
  ];

  return (
    <div className="min-h-screen">
      {/* Glassmorphism Header */}
      <div className="relative overflow-hidden rounded-2xl mb-8 bg-gradient-to-r from-red-600 via-rose-500 to-red-700 p-8">
        {/* Floating Orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-300/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-red-400/20 rounded-full blur-2xl"></div>

        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium">
                <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                Emergency Department
              </div>
              {lastUpdated && (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/80 text-xs font-medium">
                  <ClockIcon className="h-3 w-3 mr-1.5" />
                  Updated {secondsSinceUpdate === 0 ? 'just now' : `${secondsSinceUpdate}s ago`}
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Emergency Department</h1>
            <p className="text-red-100">
              Patient tracking, triage, and ED management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                resetUnifiedWorkflow();
                setActiveTab('triageRegister');
              }}
              className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-red-700 overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg bg-white backdrop-blur-sm border border-white/30"
            >
              <UserPlusIcon className="h-5 w-5 transition-transform group-hover:scale-110" />
              New Patient
            </button>
          </div>
        </div>
      </div>

      {/* Critical Alert */}
      {criticalCount > 0 && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-red-500/90 rounded-2xl p-5 mb-6 border border-red-400/50 shadow-xl"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
              <ExclamationTriangleIcon className="h-8 w-8 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">{criticalCount} Critical Patients</h3>
              <p className="text-red-100">ESI Level 1-2 patients require immediate attention</p>
            </div>
          </div>
        </div>
      )}

      {/* ESI Level Summary */}
      <div
        className="grid grid-cols-5 gap-3 mb-8"
        style={{ animationDelay: '0.2s' }}
      >
        {[1, 2, 3, 4, 5].map((level, idx) => (
          <div
            key={level}
            className={clsx(
              'relative overflow-hidden p-4 rounded-xl text-center backdrop-blur-sm border shadow-lg transition-all duration-300 hover:scale-105',
              level === 1 && 'bg-gradient-to-br from-red-500 to-red-600 border-red-400/50 text-white',
              level === 2 && 'bg-gradient-to-br from-orange-400 to-orange-500 border-orange-400/50 text-white',
              level === 3 && 'bg-gradient-to-br from-yellow-400 to-yellow-500 border-yellow-400/50 text-black',
              level === 4 && 'bg-gradient-to-br from-green-400 to-green-500 border-green-400/50 text-white',
              level === 5 && 'bg-gradient-to-br from-blue-400 to-blue-500 border-blue-400/50 text-white'
            )}
            style={{ animationDelay: `${0.2 + idx * 0.1}s` }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            <p className="text-3xl font-bold">{esiCounts[idx]}</p>
            <p className="text-xs mt-1 font-semibold">ESI {level}</p>
            <p className="text-xs opacity-80">{esiLabels[level]}</p>
          </div>
        ))}
      </div>

      {/* Animated Gradient Tabs */}
      <div
        className="relative mb-8"
        style={{ animationDelay: '0.3s' }}
      >
        <div className="relative backdrop-blur-xl bg-white rounded-2xl p-2 border border-gray-200 shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
          <nav className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={clsx(
                  'relative flex-1 py-3 px-4 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {activeTab === tab.id && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
                )}
                {tab.label}
                {tab.count !== undefined && (
                  <span className={clsx(
                    'ml-2 py-0.5 px-2 rounded-full text-xs',
                    activeTab === tab.id
                      ? 'bg-white/20'
                      : 'bg-gray-200'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Unified Triage & Register Tab */}
      {activeTab === 'triageRegister' && (
        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
            <div className="flex items-center justify-between mb-8">
              {[
                { num: 1, label: 'Patient Selection' },
                { num: 2, label: 'Triage Assessment' },
                { num: 3, label: 'ESI Result' },
                { num: 4, label: 'Register' },
              ].map((step, idx) => (
                <div key={step.num} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all',
                      currentStep === step.num && 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg scale-110',
                      currentStep > step.num && 'bg-green-500 text-white',
                      currentStep < step.num && 'bg-gray-200 text-gray-500'
                    )}>
                      {currentStep > step.num ? '✓' : step.num}
                    </div>
                    <p className={clsx(
                      'text-sm mt-2 font-medium',
                      currentStep === step.num && 'text-red-600',
                      currentStep > step.num && 'text-green-600',
                      currentStep < step.num && 'text-gray-500'
                    )}>{step.label}</p>
                  </div>
                  {idx < 3 && (
                    <div className={clsx(
                      'h-1 flex-1 mx-2 rounded transition-all',
                      currentStep > step.num ? 'bg-green-500' : 'bg-gray-200'
                    )} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Patient Selection */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 1: Select or Create Patient</h2>
                
                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUnifiedFormData({ ...unifiedFormData, isNewPatient: false, selectedPatient: null });
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className={clsx(
                      'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
                      !unifiedFormData.isNewPatient
                        ? 'bg-red-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    Existing Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnifiedFormData({ ...unifiedFormData, isNewPatient: true, selectedPatient: null });
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className={clsx(
                      'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
                      unifiedFormData.isNewPatient
                        ? 'bg-red-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    New Patient
                  </button>
                </div>

                {/* Existing Patient Search */}
                {!unifiedFormData.isNewPatient ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Patient <span className="text-red-500">*</span>
                    </label>
                    {unifiedFormData.selectedPatient ? (
                      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div>
                          <span className="font-medium text-gray-900">
                            {unifiedFormData.selectedPatient.firstName} {unifiedFormData.selectedPatient.lastName}
                          </span>
                          <span className="ml-2 text-sm text-gray-500">
                            MRN: {unifiedFormData.selectedPatient.mrn}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUnifiedFormData({ ...unifiedFormData, selectedPatient: null })}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name or MRN..."
                            className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          />
                          {searching && (
                            <ArrowPathIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />
                          )}
                        </div>
                        {searchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {searchResults.map((patient) => (
                              <button
                                key={patient.id}
                                type="button"
                                onClick={() => {
                                  setUnifiedFormData({ ...unifiedFormData, selectedPatient: patient });
                                  setSearchQuery('');
                                  setSearchResults([]);
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
                ) : (
                  /* New Patient Form */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={unifiedFormData.firstName}
                          onChange={(e) => setUnifiedFormData({ ...unifiedFormData, firstName: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={unifiedFormData.lastName}
                          onChange={(e) => setUnifiedFormData({ ...unifiedFormData, lastName: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                        <input
                          type="date"
                          value={unifiedFormData.dateOfBirth}
                          onChange={(e) => setUnifiedFormData({ ...unifiedFormData, dateOfBirth: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                        <select
                          value={unifiedFormData.gender}
                          onChange={(e) => setUnifiedFormData({ ...unifiedFormData, gender: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={unifiedFormData.phone}
                        onChange={(e) => setUnifiedFormData({ ...unifiedFormData, phone: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      />
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetUnifiedWorkflow}
                    className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!unifiedFormData.selectedPatient && !unifiedFormData.isNewPatient) {
                        toast.error('Please select or create a patient');
                        return;
                      }
                      if (unifiedFormData.isNewPatient && (!unifiedFormData.firstName.trim() || !unifiedFormData.lastName.trim())) {
                        toast.error('Please enter patient first and last name');
                        return;
                      }
                      setCurrentStep(2);
                    }}
                    disabled={!unifiedFormData.selectedPatient && !unifiedFormData.isNewPatient}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next: Triage Assessment
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Triage Assessment */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 2: Triage Assessment</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chief Complaint <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={unifiedFormData.chiefComplaint}
                    onChange={(e) => setUnifiedFormData({ ...unifiedFormData, chiefComplaint: e.target.value })}
                    placeholder="e.g., Chest pain, difficulty breathing, abdominal pain..."
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mental Status (AVPU)</label>
                  <select
                    value={unifiedFormData.mentalStatus}
                    onChange={(e) => setUnifiedFormData({ ...unifiedFormData, mentalStatus: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  >
                    <option value="alert">Alert</option>
                    <option value="voice">Responds to Voice</option>
                    <option value="pain">Responds to Pain</option>
                    <option value="unresponsive">Unresponsive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pain Scale (0-10): <span className="text-red-500 font-bold">{unifiedFormData.painScale}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={unifiedFormData.painScale}
                    onChange={(e) => setUnifiedFormData({ ...unifiedFormData, painScale: Number(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>No Pain</span>
                    <span>Worst Pain</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">BP Systolic</label>
                    <input
                      type="number"
                      value={unifiedFormData.bloodPressureSys}
                      onChange={(e) => setUnifiedFormData({ ...unifiedFormData, bloodPressureSys: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">BP Diastolic</label>
                    <input
                      type="number"
                      value={unifiedFormData.bloodPressureDia}
                      onChange={(e) => setUnifiedFormData({ ...unifiedFormData, bloodPressureDia: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={unifiedFormData.heartRate}
                      onChange={(e) => setUnifiedFormData({ ...unifiedFormData, heartRate: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Respiratory Rate</label>
                    <input
                      type="number"
                      value={unifiedFormData.respiratoryRate}
                      onChange={(e) => setUnifiedFormData({ ...unifiedFormData, respiratoryRate: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SpO2 (%)</label>
                    <input
                      type="number"
                      value={unifiedFormData.oxygenSaturation}
                      onChange={(e) => setUnifiedFormData({ ...unifiedFormData, oxygenSaturation: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={unifiedFormData.temperature}
                      onChange={(e) => setUnifiedFormData({ ...unifiedFormData, temperature: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <input
                    type="checkbox"
                    id="isPregnantUnified"
                    checked={unifiedFormData.isPregnant}
                    onChange={(e) => setUnifiedFormData({ ...unifiedFormData, isPregnant: e.target.checked })}
                    className="w-4 h-4 rounded text-red-500 focus:ring-red-500/50"
                  />
                  <label htmlFor="isPregnantUnified" className="text-sm text-gray-700">
                    Patient is Pregnant
                  </label>
                </div>

                {/* Navigation */}
                <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleUnifiedAITriage}
                    disabled={triageLoading || !unifiedFormData.chiefComplaint.trim()}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {triageLoading ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Calculating ESI...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-5 w-5" />
                        Calculate ESI Level
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: ESI Result */}
            {currentStep === 3 && esiResult && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 3: ESI Result</h2>

                {/* ESI Level Display */}
                <div className={clsx(
                  'relative overflow-hidden p-8 rounded-2xl text-center shadow-lg',
                  esiColors[esiResult.esiLevel]
                )}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
                  <p className="text-6xl font-bold">{esiResult.esiLevel}</p>
                  <p className="text-2xl font-semibold mt-2">{esiResult.category}</p>
                  <p className="text-sm mt-2 opacity-90">
                    Estimated Resources: {esiResult.estimatedResources}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Reasoning */}
                  <div className="p-4 rounded-xl bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3">Clinical Reasoning</h4>
                    <ul className="space-y-2">
                      {esiResult.reasoning.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div className="p-4 rounded-xl bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
                    <ul className="space-y-2">
                      {esiResult.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-2"></span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back to Triage
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all"
                  >
                    Next: Register Patient
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Final Registration */}
            {currentStep === 4 && esiResult && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 4: Register Patient in ED</h2>

                {/* Patient Summary */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Patient Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">
                        {unifiedFormData.selectedPatient
                          ? `${unifiedFormData.selectedPatient.firstName} ${unifiedFormData.selectedPatient.lastName}`
                          : `${unifiedFormData.firstName} ${unifiedFormData.lastName}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">ESI Level</p>
                      <p className="font-medium text-gray-900">
                        Level {esiResult.esiLevel} - {esiResult.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Chief Complaint</p>
                      <p className="font-medium text-gray-900">{unifiedFormData.chiefComplaint}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Estimated Resources</p>
                      <p className="font-medium text-gray-900">{esiResult.estimatedResources}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Arrival Mode</label>
                  <select
                    value={unifiedFormData.arrivalMode}
                    onChange={(e) => setUnifiedFormData({ ...unifiedFormData, arrivalMode: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  >
                    <option value="WALK_IN">Walk-in</option>
                    <option value="AMBULANCE">Ambulance</option>
                    <option value="POLICE">Police</option>
                    <option value="TRANSFER">Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                  <textarea
                    value={unifiedFormData.notes}
                    onChange={(e) => setUnifiedFormData({ ...unifiedFormData, notes: e.target.value })}
                    placeholder="Any additional notes or observations..."
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                  />
                </div>

                {/* Navigation */}
                <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleUnifiedRegistration}
                    disabled={registering}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {registering ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <UserPlusIcon className="h-5 w-5" />
                        Register Patient in ED
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming Ambulances - Feature 6 */}
      {activeTab === 'tracking' && incomingAmbulances.length > 0 && (
        <div 
          className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-300 shadow-xl mb-6"
          style={{ animationDelay: '0.3s' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          <div className="px-6 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center animate-pulse">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900">
                  {incomingAmbulances.length} Incoming Ambulance{incomingAmbulances.length > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-blue-700">En route to ED</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incomingAmbulances.map((ambulance) => (
                <div
                  key={ambulance.id}
                  className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-blue-200 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{ambulance.ambulanceNumber}</p>
                      <p className="text-xs text-gray-500">{ambulance.vehicleType.replace('_', ' ')}</p>
                    </div>
                    {ambulance.etaMinutes !== null && (
                      <div className={clsx(
                        'px-3 py-1 rounded-full text-sm font-bold',
                        ambulance.etaMinutes <= 5
                          ? 'bg-red-100 text-red-700 animate-pulse'
                          : ambulance.etaMinutes <= 15
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      )}>
                        ETA {ambulance.etaMinutes} min
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Patient</p>
                      <p className="text-sm font-semibold text-gray-900">{ambulance.patientInfo}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-600">Chief Complaint</p>
                      <p className="text-sm text-gray-700">{ambulance.chiefComplaint}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-600">From</p>
                      <p className="text-xs text-gray-600 truncate">{ambulance.pickupLocation}</p>
                    </div>

                    {ambulance.vitals && Object.keys(ambulance.vitals).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-600 mb-2">Paramedic Vitals</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {ambulance.vitals.heartRate && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">HR:</span>
                              <span className="font-semibold">{ambulance.vitals.heartRate}</span>
                            </div>
                          )}
                          {ambulance.vitals.bloodPressure && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">BP:</span>
                              <span className="font-semibold">{ambulance.vitals.bloodPressure}</span>
                            </div>
                          )}
                          {ambulance.vitals.oxygenSaturation && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">SpO2:</span>
                              <span className="font-semibold">{ambulance.vitals.oxygenSaturation}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Patient Tracking Tab */}
      {activeTab === 'tracking' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-xl"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
          {loading ? (
            <div className="p-8 text-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-red-400" />
              <p className="mt-2 text-gray-500">Loading patients...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No patients in ED</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {patients.map((patient, index) => (
                <div
                  key={patient.id}
                  className={clsx(
                    'p-5 transition-all duration-300 hover:bg-gray-50',
                    patient.esiLevel === 1 && 'bg-red-50/50',
                    patient.esiLevel === 2 && 'bg-orange-50/50'
                  )}
                  style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={clsx(
                        'w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg shadow-lg',
                        esiColors[patient.esiLevel]
                      )}>
                        {patient.esiLevel}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {patient.patient?.firstName} {patient.patient?.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {patient.patient?.dateOfBirth ? calculateAge(patient.patient.dateOfBirth) : 'N/A'} years old
                        </p>
                        <p className="text-sm mt-1 text-gray-700">{patient.chiefComplaint}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>
                            Arrived: {patient.arrivalTime
                              ? new Date(patient.arrivalTime).toLocaleTimeString()
                              : 'N/A'}
                          </span>
                          {patient.status === 'WAITING' && patient.arrivalTime && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              Wait: {calculateWaitTime(patient.arrivalTime)} min
                            </span>
                          )}
                        </div>
                        
                        {/* Feature 7: Real-time Vitals Display */}
                        {patient.vitals && patient.vitals.length > 0 && (() => {
                          const latestVitals = patient.vitals[0];
                          
                          // Helper function to get vital status
                          const getVitalStatus = (vital: string, value: number | string | undefined) => {
                            if (value === undefined || value === null) return 'normal';
                            const numValue = typeof value === 'string' ? parseFloat(value) : value;
                            
                            switch (vital) {
                              case 'hr':
                                if (numValue < 40 || numValue > 150) return 'critical';
                                if (numValue < 50 || numValue > 120) return 'warning';
                                return 'normal';
                              case 'spo2':
                                if (numValue < 90) return 'critical';
                                if (numValue < 95) return 'warning';
                                return 'normal';
                              case 'sbp':
                                if (numValue < 80 || numValue > 200) return 'critical';
                                if (numValue < 90 || numValue > 180) return 'warning';
                                return 'normal';
                              case 'rr':
                                if (numValue < 8 || numValue > 30) return 'critical';
                                if (numValue < 10 || numValue > 25) return 'warning';
                                return 'normal';
                              case 'temp':
                                if (numValue > 40) return 'critical';
                                if (numValue > 38.5) return 'warning';
                                return 'normal';
                              default:
                                return 'normal';
                            }
                          };
                          
                          const getVitalColorClasses = (status: string) => {
                            switch (status) {
                              case 'critical': return 'bg-red-100 text-red-700 border-red-300';
                              case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
                              default: return 'bg-green-100 text-green-700 border-green-300';
                            }
                          };
                          
                          return (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {latestVitals.heartRate && (
                                <span className={clsx(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border',
                                  getVitalColorClasses(getVitalStatus('hr', latestVitals.heartRate))
                                )}>
                                  <span className="font-semibold">HR:</span> {latestVitals.heartRate}
                                </span>
                              )}
                              
                              {latestVitals.bloodPressureSys && latestVitals.bloodPressureDia && (
                                <span className={clsx(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border',
                                  getVitalColorClasses(getVitalStatus('sbp', latestVitals.bloodPressureSys))
                                )}>
                                  <span className="font-semibold">BP:</span> {latestVitals.bloodPressureSys}/{latestVitals.bloodPressureDia}
                                </span>
                              )}
                              
                              {latestVitals.oxygenSaturation && (
                                <span className={clsx(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border',
                                  getVitalColorClasses(getVitalStatus('spo2', latestVitals.oxygenSaturation))
                                )}>
                                  <span className="font-semibold">SpO2:</span> {latestVitals.oxygenSaturation}%
                                </span>
                              )}
                              
                              {latestVitals.respiratoryRate && (
                                <span className={clsx(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border',
                                  getVitalColorClasses(getVitalStatus('rr', latestVitals.respiratoryRate))
                                )}>
                                  <span className="font-semibold">RR:</span> {latestVitals.respiratoryRate}
                                </span>
                              )}
                              
                              {latestVitals.temperature && (
                                <span className={clsx(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border',
                                  getVitalColorClasses(getVitalStatus('temp', latestVitals.temperature))
                                )}>
                                  <span className="font-semibold">Temp:</span> {latestVitals.temperature}°C
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        
                        {(!patient.vitals || patient.vitals.length === 0) && (
                          <div className="mt-3">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500 border border-gray-300">
                              No vitals recorded
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {/* Glass-styled status badge */}
                      <span className={clsx(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border',
                        patient.status === 'RESUSCITATION' && 'bg-red-100 text-red-700 border-red-200',
                        patient.status === 'IN_TREATMENT' && 'bg-blue-100 text-blue-700 border-blue-200',
                        patient.status === 'WAITING' && 'bg-yellow-100 text-yellow-700 border-yellow-200',
                        patient.status === 'REGISTERED' && 'bg-gray-100 text-gray-700 border-gray-200'
                      )}>
                        <span className={clsx(
                          'w-2 h-2 rounded-full',
                          patient.status === 'RESUSCITATION' && 'bg-red-500 animate-pulse',
                          patient.status === 'IN_TREATMENT' && 'bg-blue-500',
                          patient.status === 'WAITING' && 'bg-yellow-500',
                          patient.status === 'REGISTERED' && 'bg-gray-500'
                        )}></span>
                        {patient.status?.replace('_', ' ')}
                      </span>
                      <div className="mt-3">
                        <button 
                          onClick={() => setSelectedPatientId(patient.id)}
                          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white backdrop-blur-sm border border-gray-200 hover:bg-gray-50 transition-all duration-300 hover:shadow-md"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'waiting' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-xl"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Waiting Room</h3>
            {isAIOnline && (
              <button
                onClick={handlePredictWaitTime}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-purple-600 bg-purple-50 backdrop-blur-sm border border-purple-200 hover:bg-purple-100 transition-all"
              >
                <SparklesIcon className="h-4 w-4" />
                Update Wait Times
              </button>
            )}
          </div>
          {patients.filter(p => p.status === 'WAITING').length === 0 ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                <ClockIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No patients waiting</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {patients.filter(p => p.status === 'WAITING').map((patient, index) => (
                <div
                  key={patient.id}
                  className="p-5 flex items-center justify-between transition-all duration-300 hover:bg-gray-50"
                  style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      'w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg',
                      esiColors[patient.esiLevel]
                    )}>
                      {patient.esiLevel}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {patient.patient?.firstName} {patient.patient?.lastName}
                      </h4>
                      <p className="text-sm text-gray-500">{patient.chiefComplaint}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex flex-col items-end px-4 py-2 rounded-xl bg-gray-50 backdrop-blur-sm">
                      <p className="text-2xl font-bold text-gray-900">
                        {calculateWaitTime(patient.arrivalTime)} min
                      </p>
                      <p className="text-xs text-gray-500">Wait time</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ED Beds Tab - Feature 4 */}
      {activeTab === 'beds' && (
        <div style={{ animationDelay: '0.4s' }}>
          <EDBeds />
        </div>
      )}

      {/* Resuscitation Dashboard Tab - Feature 5 */}
      {activeTab === 'resus' && (
        <div style={{ animationDelay: '0.4s' }}>
          <ResuscitationDashboard />
        </div>
      )}

      {/* Blood Bank Tab */}
      {activeTab === 'bloodBank' && (
        <div style={{ animationDelay: '0.4s' }}>
          <BloodBank />
        </div>
      )}

      {/* On-Call Doctors Tab */}
      {activeTab === 'onCall' && (
        <div style={{ animationDelay: '0.4s' }}>
          <OnCallDoctors />
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {[
          { label: 'In Department', value: stats.inDepartment, color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500' },
          { label: 'Avg Wait Time', value: `${stats.avgWaitTime} min`, color: 'from-yellow-500 to-amber-500', bgColor: 'bg-yellow-50', dotColor: 'bg-yellow-500' },
          { label: 'Treated Today', value: stats.treatedToday, color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-50', dotColor: 'bg-green-500' },
          { label: 'Admitted', value: stats.admitted, color: 'from-purple-500 to-violet-500', bgColor: 'bg-purple-50', dotColor: 'bg-purple-500' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={clsx(
              'relative overflow-hidden backdrop-blur-xl rounded-2xl p-5 border border-gray-200 shadow-lg transition-all duration-300 hover:scale-105',
              stat.bgColor
            )}
            style={{ animationDelay: `${0.6 + index * 0.1}s` }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx('w-2 h-2 rounded-full', stat.dotColor)}></span>
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            </div>
            <p className={clsx(
              'text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent',
              stat.color
            )}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* New Patient Modal */}
      {showNewPatientModal && (
        <NewEDPatientModal
          onClose={() => setShowNewPatientModal(false)}
          onSuccess={async () => {
            setShowNewPatientModal(false);
            await fetchData(false); // Refresh data after registration
          }}
        />
      )}

      {/* Patient Detail Slide-Out Panel */}
      {selectedPatientId && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedPatientId(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl transform transition-transform duration-300">
            <div className="h-full overflow-y-auto">
              {(() => {
                const patient = patients.find(p => p.id === selectedPatientId);
                if (!patient) return null;
                
                return (
                  <div>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-red-600 via-rose-500 to-red-700 px-6 py-5 flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white">
                          {patient.patient?.firstName} {patient.patient?.lastName}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={clsx(
                            'px-3 py-1 rounded-full text-sm font-bold',
                            esiColors[patient.esiLevel]
                          )}>
                            ESI {patient.esiLevel}
                          </span>
                          <span className="text-white/90 text-sm">
                            {patient.patient?.dateOfBirth ? calculateAge(patient.patient.dateOfBirth) : 'N/A'} years old
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedPatientId(null)}
                        className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                      {/* Overview */}
                      <div className="bg-gray-50 rounded-xl p-5">
                        <h3 className="font-semibold text-gray-900 mb-3">Chief Complaint</h3>
                        <p className="text-gray-700">{patient.chiefComplaint}</p>
                      </div>

                      {/* Arrival Info */}
                      <div className="bg-gray-50 rounded-xl p-5">
                        <h3 className="font-semibold text-gray-900 mb-3">Arrival Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Arrival Time</p>
                            <p className="font-medium text-gray-900">
                              {patient.arrivalTime
                                ? new Date(patient.arrivalTime).toLocaleString()
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Wait Time</p>
                            <p className="font-medium text-gray-900">
                              {calculateWaitTime(patient.arrivalTime)} minutes
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className="font-medium text-gray-900">
                              {patient.status?.replace('_', ' ')}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Triage Level</p>
                            <p className="font-medium text-gray-900">
                              {esiLabels[patient.esiLevel]}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Assigned Staff */}
                      {patient.doctor && (
                        <div className="bg-gray-50 rounded-xl p-5">
                          <h3 className="font-semibold text-gray-900 mb-3">Assigned Staff</h3>
                          <div>
                            <p className="text-sm text-gray-500">Doctor</p>
                            <p className="font-medium text-gray-900">
                              Dr. {patient.doctor.user?.firstName} {patient.doctor.user?.lastName}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Latest Vitals */}
                      {patient.vitals && patient.vitals.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-5">
                          <h3 className="font-semibold text-gray-900 mb-3">Latest Vitals</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {patient.vitals[0].temperature && (
                              <div>
                                <p className="text-sm text-gray-500">Temperature</p>
                                <p className="font-medium text-gray-900">{patient.vitals[0].temperature}°C</p>
                              </div>
                            )}
                            {patient.vitals[0].bloodPressureSys && (
                              <div>
                                <p className="text-sm text-gray-500">Blood Pressure</p>
                                <p className="font-medium text-gray-900">
                                  {patient.vitals[0].bloodPressureSys}/{patient.vitals[0].bloodPressureDia} mmHg
                                </p>
                              </div>
                            )}
                            {patient.vitals[0].heartRate && (
                              <div>
                                <p className="text-sm text-gray-500">Heart Rate</p>
                                <p className="font-medium text-gray-900">{patient.vitals[0].heartRate} bpm</p>
                              </div>
                            )}
                            {patient.vitals[0].oxygenSaturation && (
                              <div>
                                <p className="text-sm text-gray-500">SpO2</p>
                                <p className="font-medium text-gray-900">{patient.vitals[0].oxygenSaturation}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Triage Notes */}
                      {patient.triageNotes && (
                        <div className="bg-gray-50 rounded-xl p-5">
                          <h3 className="font-semibold text-gray-900 mb-3">Triage Notes</h3>
                          <p className="text-gray-700">{patient.triageNotes}</p>
                        </div>
                      )}

                      {/* Allergies */}
                      {patient.allergies && patient.allergies.length > 0 && (
                        <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                          <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5" />
                            Critical Allergies
                          </h3>
                          <ul className="space-y-2">
                            {patient.allergies.map((allergy: any, idx: number) => (
                              <li key={idx} className="text-red-800 font-medium">
                                {allergy.allergen} - {allergy.severity}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button 
                          onClick={() => {
                            setActionPatientId(patient.id);
                            setShowUpdateTriageModal(true);
                          }}
                          className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all"
                        >
                          Update Triage
                        </button>
                        <button 
                          onClick={() => {
                            setActionPatientId(patient.id);
                            setShowAssignDoctorModal(true);
                          }}
                          className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                        >
                          Assign Doctor
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => {
                            setActionPatientId(patient.id);
                            setShowAdmitModal(true);
                          }}
                          className="flex-1 px-4 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-all"
                        >
                          Admit
                        </button>
                        <button 
                          onClick={() => {
                            setActionPatientId(patient.id);
                            setShowDischargeModal(true);
                          }}
                          className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all"
                        >
                          Discharge
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {showUpdateTriageModal && actionPatientId && (() => {
        const patient = patients.find(p => p.id === actionPatientId);
        if (!patient) return null;
        return (
          <UpdateTriageModal
            patientId={actionPatientId}
            currentESI={patient.esiLevel}
            onClose={() => {
              setShowUpdateTriageModal(false);
              setActionPatientId(null);
            }}
            onSuccess={() => {
              fetchData(false);
              setSelectedPatientId(null); // Close detail panel
            }}
          />
        );
      })()}

      {showAssignDoctorModal && actionPatientId && (
        <AssignDoctorModal
          patientId={actionPatientId}
          onClose={() => {
            setShowAssignDoctorModal(false);
            setActionPatientId(null);
          }}
          onSuccess={() => {
            fetchData(false);
            setSelectedPatientId(null);
          }}
        />
      )}

      {showAdmitModal && actionPatientId && (
        <AdmitPatientModal
          patientId={actionPatientId}
          onClose={() => {
            setShowAdmitModal(false);
            setActionPatientId(null);
          }}
          onSuccess={() => {
            fetchData(false);
            setSelectedPatientId(null);
          }}
        />
      )}

      {showDischargeModal && actionPatientId && (
        <DischargePatientModal
          patientId={actionPatientId}
          onClose={() => {
            setShowDischargeModal(false);
            setActionPatientId(null);
          }}
          onSuccess={() => {
            fetchData(false);
            setSelectedPatientId(null);
          }}
        />
      )}
    </div>
  );
}
