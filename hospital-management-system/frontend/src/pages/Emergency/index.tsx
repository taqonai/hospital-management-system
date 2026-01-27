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
                      <option value="OTHER">Other</option>
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

export default function Emergency() {
  const [activeTab, setActiveTab] = useState<'tracking' | 'triage' | 'waiting'>('tracking');
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patients, setPatients] = useState<EDPatient[]>([]);
  const [stats, setStats] = useState<EmergencyStats>({
    inDepartment: 0,
    avgWaitTime: 0,
    treatedToday: 0,
    admitted: 0,
  });
  const [loading, setLoading] = useState(true);
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

  // Fetch ED patients
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const response = await emergencyApi.getPatients();
        setPatients(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch patients:', error);
        toast.error('Failed to load ED patients');
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await emergencyApi.getStats();
        setStats(response.data.data || {
          inDepartment: 0,
          avgWaitTime: 0,
          treatedToday: 0,
          admitted: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

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
    { id: 'tracking', label: 'Patient Tracking', count: patients.length },
    { id: 'triage', label: 'Triage Station' },
    { id: 'waiting', label: 'Waiting Room', count: patients.filter(p => p.status === 'WAITING').length },
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
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-3">
              <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              Emergency Department
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Emergency Department</h1>
            <p className="text-red-100">
              Patient tracking, triage, and ED management
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAIOnline && (
              <button
                onClick={handleAITriage}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30"
              >
                <SparklesIcon className="h-5 w-5 transition-transform group-hover:rotate-12" />
                AI Triage
              </button>
            )}
            <button
              onClick={() => setShowNewPatientModal(true)}
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

      {activeTab === 'triage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Triage Form */}
          <div
            className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-xl"
            style={{ animationDelay: '0.4s' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900">AI Triage Assistant</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chief Complaint *
                </label>
                <input
                  type="text"
                  value={triageForm.chiefComplaint}
                  onChange={(e) => setTriageForm({ ...triageForm, chiefComplaint: e.target.value })}
                  placeholder="e.g., Chest pain, shortness of breath, abdominal pain"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mental Status (AVPU)
                </label>
                <select
                  value={triageForm.mentalStatus}
                  onChange={(e) => setTriageForm({ ...triageForm, mentalStatus: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                >
                  <option value="alert">Alert</option>
                  <option value="voice">Responds to Voice</option>
                  <option value="pain">Responds to Pain</option>
                  <option value="unresponsive">Unresponsive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pain Scale (0-10): <span className="text-red-500 font-bold">{triageForm.painScale}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={triageForm.painScale}
                  onChange={(e) => setTriageForm({ ...triageForm, painScale: Number(e.target.value) })}
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
                    value={triageForm.bloodPressureSys}
                    onChange={(e) => setTriageForm({ ...triageForm, bloodPressureSys: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">BP Diastolic</label>
                  <input
                    type="number"
                    value={triageForm.bloodPressureDia}
                    onChange={(e) => setTriageForm({ ...triageForm, bloodPressureDia: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={triageForm.heartRate}
                    onChange={(e) => setTriageForm({ ...triageForm, heartRate: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Respiratory Rate</label>
                  <input
                    type="number"
                    value={triageForm.respiratoryRate}
                    onChange={(e) => setTriageForm({ ...triageForm, respiratoryRate: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SpO2 (%)</label>
                  <input
                    type="number"
                    value={triageForm.oxygenSaturation}
                    onChange={(e) => setTriageForm({ ...triageForm, oxygenSaturation: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Temperature (C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={triageForm.temperature}
                    onChange={(e) => setTriageForm({ ...triageForm, temperature: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 backdrop-blur-sm">
                <input
                  type="checkbox"
                  id="isPregnant"
                  checked={triageForm.isPregnant}
                  onChange={(e) => setTriageForm({ ...triageForm, isPregnant: e.target.checked })}
                  className="w-4 h-4 rounded text-red-500 focus:ring-red-500/50"
                />
                <label htmlFor="isPregnant" className="text-sm text-gray-700">
                  Patient is Pregnant
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAITriage}
                  disabled={triageLoading || !triageForm.chiefComplaint.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-red-500 to-rose-500 shadow-md"
                >
                  {triageLoading ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="h-5 w-5" />
                  )}
                  Calculate ESI Level
                </button>
                <button
                  onClick={resetTriageForm}
                  className="inline-flex items-center px-5 py-3 rounded-xl font-medium text-gray-700 bg-white backdrop-blur-sm border border-gray-200 hover:bg-gray-50 transition-all duration-300 hover:shadow-md"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* ESI Result */}
          <div
            className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-xl"
            style={{ animationDelay: '0.5s' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Triage Result</h3>
            </div>
            {!esiResult ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                  <ExclamationTriangleIcon className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500">Enter patient information and calculate ESI level</p>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* ESI Level Display */}
                <div className={clsx(
                  'relative overflow-hidden p-8 rounded-2xl text-center shadow-lg',
                  esiColors[esiResult.esiLevel]
                )}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
                  <p className="text-6xl font-bold">{esiResult.esiLevel}</p>
                  <p className="text-xl font-semibold mt-2">{esiResult.category}</p>
                  <p className="text-sm mt-2 opacity-90">
                    Estimated Resources: {esiResult.estimatedResources}
                  </p>
                </div>

                {/* Reasoning */}
                <div className="p-4 rounded-xl bg-gray-50 backdrop-blur-sm">
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
                <div className="p-4 rounded-xl bg-gray-50 backdrop-blur-sm">
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

                {/* ESI Guide */}
                <div className="p-4 rounded-xl bg-gray-50 backdrop-blur-sm">
                  <h4 className="font-medium text-gray-900 mb-3 text-sm">ESI Level Guide</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(level => (
                      <div
                        key={level}
                        className={clsx(
                          'p-2 rounded-xl text-center text-xs transition-all',
                          esiColors[level],
                          esiResult.esiLevel === level && 'ring-2 ring-black ring-offset-2'
                        )}
                      >
                        <p className="font-bold">{level}</p>
                        <p className="opacity-90">{esiLabels[level]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
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
            try {
              const response = await emergencyApi.getPatients();
              setPatients(response.data.data || []);
            } catch (error) {
              console.error('Failed to refresh patients:', error);
            }
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
                        <button className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all">
                          Update Triage
                        </button>
                        <button className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all">
                          Assign Doctor
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <button className="flex-1 px-4 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-all">
                          Admit
                        </button>
                        <button className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all">
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
    </div>
  );
}
