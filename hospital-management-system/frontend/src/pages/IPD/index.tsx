import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  ExclamationTriangleIcon,
  UserIcon,
  SparklesIcon,
  HeartIcon,
  ArrowRightOnRectangleIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ClockIcon,
  BellAlertIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { usePermissions } from '../../hooks/usePermissions';
import { ipdApi, patientApi, doctorApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Ward {
  id: string;
  name: string;
  type: string;
  beds: Array<{
    id: string;
    bedNumber: string;
    status: string;
    admissions?: Array<{
      id: string;
      patient: {
        id: string;
        firstName: string;
        lastName: string;
        mrn?: string;
      };
      status: string;
    }>;
  }>;
}

interface Admission {
  id: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  bed: {
    bedNumber: string;
    ward: {
      name: string;
    };
  };
  lengthOfStay: number;
  status: string;
  acuityLevel?: string;
  news2Score?: number;
}

interface IPDStats {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  criticalPatients: number;
}

interface DeteriorationPatient {
  admissionId: string;
  patientId: string;
  patientName: string;
  ward: string;
  bedNumber: string;
  news2Score: number;
  riskLevel: string;
  clinicalResponse: string;
  components: string[];
  trend: 'improving' | 'stable' | 'worsening';
  lastVitalsTime: string | null;
  vitalsOverdue: boolean;
}

interface DeteriorationDashboard {
  summary: {
    totalPatients: number;
    highRisk: number;
    vitalsOverdue: number;
    worsening: number;
  };
  patients: DeteriorationPatient[];
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

interface Bed {
  id: string;
  bedNumber: string;
  ward: {
    id: string;
    name: string;
  };
}

// New Admission Modal Component
function NewAdmissionModal({ onClose, onSuccess, wards }: { onClose: () => void; onSuccess: () => void; wards: Ward[] }) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableBeds, setAvailableBeds] = useState<Bed[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedBed, setSelectedBed] = useState<string>('');
  const [admissionType, setAdmissionType] = useState<'EMERGENCY' | 'ELECTIVE' | 'TRANSFER'>('ELECTIVE');
  const [admissionReason, setAdmissionReason] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingBeds, setLoadingBeds] = useState(true);

  // Patient mode: search existing or register new
  const [patientMode, setPatientMode] = useState<'search' | 'register'>('search');
  const [registering, setRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    bloodGroup: '',
    nationality: '',
  });

  const updateRegForm = (field: string, value: string) => {
    setRegForm(prev => ({ ...prev, [field]: value }));
  };

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoadingDoctors(true);
        const response = await doctorApi.getAll({ limit: 50 });
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

  // Fetch available beds
  useEffect(() => {
    const fetchBeds = async () => {
      try {
        setLoadingBeds(true);
        const response = await ipdApi.getAvailableBeds();
        setAvailableBeds(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch beds:', error);
        toast.error('Failed to load available beds');
      } finally {
        setLoadingBeds(false);
      }
    };
    fetchBeds();
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

  // Handle inline patient registration
  const handleRegisterPatient = async () => {
    const { firstName, lastName, dateOfBirth, gender, phone, address, city, state, zipCode } = regForm;
    if (!firstName || !lastName || !dateOfBirth || !gender || !phone || !address || !city || !state || !zipCode) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (phone.length < 10) {
      toast.error('Phone number must be at least 10 digits');
      return;
    }

    setRegistering(true);
    try {
      const payload: Record<string, string> = {
        firstName: regForm.firstName,
        lastName: regForm.lastName,
        dateOfBirth: new Date(regForm.dateOfBirth).toISOString(),
        gender: regForm.gender,
        phone: regForm.phone,
        address: regForm.address,
        city: regForm.city,
        state: regForm.state,
        zipCode: regForm.zipCode,
      };
      if (regForm.email) payload.email = regForm.email;
      if (regForm.bloodGroup) payload.bloodGroup = regForm.bloodGroup;
      if (regForm.nationality) payload.nationality = regForm.nationality;

      const response = await patientApi.create(payload);
      const newPatient = response.data.data;
      toast.success(`Patient registered successfully — MRN: ${newPatient.mrn}`);
      setSelectedPatient({
        id: newPatient.id,
        firstName: newPatient.firstName,
        lastName: newPatient.lastName,
        mrn: newPatient.mrn,
      });
      setPatientMode('search');
    } catch (error: any) {
      console.error('Failed to register patient:', error);
      toast.error(error.response?.data?.message || 'Failed to register patient');
    } finally {
      setRegistering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!selectedDoctor) {
      toast.error('Please select an attending doctor');
      return;
    }
    if (!selectedBed) {
      toast.error('Please select a bed');
      return;
    }

    setLoading(true);
    try {
      await ipdApi.createAdmission({
        patientId: selectedPatient.id,
        attendingDoctorId: selectedDoctor,
        bedId: selectedBed,
        admissionType,
        admissionReason: admissionReason || undefined,
        diagnosis: diagnosis || undefined,
      });
      toast.success('Patient admitted successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create admission:', error);
      toast.error(error.response?.data?.message || 'Failed to admit patient');
    } finally {
      setLoading(false);
    }
  };

  // Group beds by ward
  const bedsByWard = availableBeds.reduce((acc, bed) => {
    const wardName = bed.ward?.name || 'Unknown';
    if (!acc[wardName]) acc[wardName] = [];
    acc[wardName].push(bed);
    return acc;
  }, {} as Record<string, Bed[]>);

  const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">New Patient Admission</h2>
            <p className="text-indigo-100 text-sm">Admit a patient to the inpatient department</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
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
                <div>
                  {/* Mode Toggle Tabs */}
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setPatientMode('search')}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border',
                        patientMode === 'search'
                          ? 'bg-indigo-500 text-white border-indigo-500'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      )}
                    >
                      <MagnifyingGlassIcon className="h-4 w-4" />
                      Search Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientMode('register')}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border',
                        patientMode === 'register'
                          ? 'bg-indigo-500 text-white border-indigo-500'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      )}
                    >
                      <UserPlusIcon className="h-4 w-4" />
                      Register New
                    </button>
                  </div>

                  {/* Search Existing Mode */}
                  {patientMode === 'search' && (
                    <div className="relative">
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by name or MRN..."
                          className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                        />
                        {searching && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
                          </div>
                        )}
                      </div>
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
                      {/* No results prompt */}
                      {!searching && patients.length === 0 && searchQuery.trim().length >= 3 && (
                        <div className="mt-2 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-sm text-amber-800">No patient found. Register new?</span>
                          <button
                            type="button"
                            onClick={() => setPatientMode('register')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
                          >
                            <UserPlusIcon className="h-4 w-4" />
                            Register
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Register New Mode */}
                  {patientMode === 'register' && (
                    <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                      {/* Row 1: First Name | Last Name */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                          <input type="text" value={regForm.firstName} onChange={(e) => updateRegForm('firstName', e.target.value)} placeholder="First name" className={inputClass} required />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                          <input type="text" value={regForm.lastName} onChange={(e) => updateRegForm('lastName', e.target.value)} placeholder="Last name" className={inputClass} required />
                        </div>
                      </div>
                      {/* Row 2: Date of Birth | Gender */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                          <input type="date" value={regForm.dateOfBirth} onChange={(e) => updateRegForm('dateOfBirth', e.target.value)} className={inputClass} required />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Gender <span className="text-red-500">*</span></label>
                          <select value={regForm.gender} onChange={(e) => updateRegForm('gender', e.target.value)} className={inputClass} required>
                            <option value="">Select gender</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                      </div>
                      {/* Row 3: Phone | Email */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-red-500">*</span></label>
                          <input type="tel" value={regForm.phone} onChange={(e) => updateRegForm('phone', e.target.value)} placeholder="Phone number" className={inputClass} required />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                          <input type="email" value={regForm.email} onChange={(e) => updateRegForm('email', e.target.value)} placeholder="Email (optional)" className={inputClass} />
                        </div>
                      </div>
                      {/* Row 4: Address | City */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Address <span className="text-red-500">*</span></label>
                          <input type="text" value={regForm.address} onChange={(e) => updateRegForm('address', e.target.value)} placeholder="Street address" className={inputClass} required />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">City <span className="text-red-500">*</span></label>
                          <input type="text" value={regForm.city} onChange={(e) => updateRegForm('city', e.target.value)} placeholder="City" className={inputClass} required />
                        </div>
                      </div>
                      {/* Row 5: State | Zip Code */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">State <span className="text-red-500">*</span></label>
                          <input type="text" value={regForm.state} onChange={(e) => updateRegForm('state', e.target.value)} placeholder="State" className={inputClass} required />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Zip Code <span className="text-red-500">*</span></label>
                          <input type="text" value={regForm.zipCode} onChange={(e) => updateRegForm('zipCode', e.target.value)} placeholder="Zip code" className={inputClass} required />
                        </div>
                      </div>
                      {/* Row 6: Blood Group | Nationality */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Blood Group</label>
                          <select value={regForm.bloodGroup} onChange={(e) => updateRegForm('bloodGroup', e.target.value)} className={inputClass}>
                            <option value="">Select (optional)</option>
                            <option value="A_POSITIVE">A+</option>
                            <option value="A_NEGATIVE">A-</option>
                            <option value="B_POSITIVE">B+</option>
                            <option value="B_NEGATIVE">B-</option>
                            <option value="AB_POSITIVE">AB+</option>
                            <option value="AB_NEGATIVE">AB-</option>
                            <option value="O_POSITIVE">O+</option>
                            <option value="O_NEGATIVE">O-</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nationality</label>
                          <input type="text" value={regForm.nationality} onChange={(e) => updateRegForm('nationality', e.target.value)} placeholder="Nationality (optional)" className={inputClass} />
                        </div>
                      </div>
                      {/* Register & Select Button */}
                      <button
                        type="button"
                        onClick={handleRegisterPatient}
                        disabled={registering}
                        className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {registering ? (
                          <>
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            Registering...
                          </>
                        ) : (
                          <>
                            <UserPlusIcon className="h-4 w-4" />
                            Register &amp; Select
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bed Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bed <span className="text-red-500">*</span>
              </label>
              {loadingBeds ? (
                <div className="flex items-center justify-center py-4">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-indigo-500" />
                  <span className="ml-2 text-gray-500">Loading beds...</span>
                </div>
              ) : availableBeds.length === 0 ? (
                <p className="text-sm text-red-600 py-3">No beds available. Please free up a bed first.</p>
              ) : (
                <select
                  value={selectedBed}
                  onChange={(e) => setSelectedBed(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  required
                >
                  <option value="">Select a bed...</option>
                  {Object.entries(bedsByWard).map(([wardName, beds]) => (
                    <optgroup key={wardName} label={wardName}>
                      {beds.map((bed) => (
                        <option key={bed.id} value={bed.id}>
                          Bed {bed.bedNumber}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            {/* Doctor Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attending Doctor <span className="text-red-500">*</span>
              </label>
              {loadingDoctors ? (
                <div className="flex items-center justify-center py-4">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-indigo-500" />
                  <span className="ml-2 text-gray-500">Loading doctors...</span>
                </div>
              ) : (
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  required
                >
                  <option value="">Select a doctor...</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.user.firstName} {doc.user.lastName} - {doc.specialization}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Admission Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admission Type</label>
              <div className="flex gap-3">
                {['ELECTIVE', 'EMERGENCY', 'TRANSFER'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAdmissionType(type as typeof admissionType)}
                    className={clsx(
                      'flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border',
                      admissionType === type
                        ? type === 'EMERGENCY' ? 'bg-red-500 text-white border-red-500' : 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Admission Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admission Reason</label>
              <textarea
                value={admissionReason}
                onChange={(e) => setAdmissionReason(e.target.value)}
                placeholder="Reason for admission..."
                rows={2}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Diagnosis */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Initial Diagnosis</label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Enter diagnosis..."
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
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
                disabled={loading || !selectedPatient || !selectedDoctor || !selectedBed}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Admitting...
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-5 w-5" />
                    Admit Patient
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

// Patient Detail Drawer Component
function PatientDetailDrawer({ admissionId, onClose }: { admissionId: string | null; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [admission, setAdmission] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'vitals' | 'notes'>('overview');

  useEffect(() => {
    if (!admissionId) return;

    const fetchAdmission = async () => {
      try {
        setLoading(true);
        const response = await ipdApi.getAdmissionDetail(admissionId);
        setAdmission(response.data.data);
      } catch (error) {
        console.error('Failed to fetch admission:', error);
        toast.error('Failed to load patient details');
      } finally {
        setLoading(false);
      }
    };

    fetchAdmission();
  }, [admissionId]);

  if (!admissionId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-4xl flex">
        <div className="w-full bg-white shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserIcon className="h-8 w-8 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Patient Details</h2>
                  {admission && (
                    <p className="text-sm text-indigo-100">
                      {admission.patient?.firstName} {admission.patient?.lastName} • MRN: {admission.patient?.mrn}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-white" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
          ) : admission ? (
            <div className="p-6 space-y-6">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                  {[
                    { id: 'overview', label: 'Overview', icon: UserIcon },
                    { id: 'orders', label: 'Orders', icon: ClipboardDocumentListIcon },
                    { id: 'vitals', label: 'Vitals', icon: HeartIcon },
                    { id: 'notes', label: 'Notes', icon: DocumentTextIcon },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors',
                        activeTab === tab.id
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      )}
                    >
                      <tab.icon className="h-5 w-5" />
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (() => {
                const latestVitals = admission.patient?.vitals?.[0];
                const news2Score = admission.latestNEWS2Score;

                return (
                <div className="space-y-6">
                  {/* Patient Demographics */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <UserIcon className="h-5 w-5 text-indigo-600" />
                      Patient Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Name</p>
                        <p className="font-medium">{admission.patient?.firstName} {admission.patient?.lastName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">MRN</p>
                        <p className="font-medium">{admission.patient?.mrn}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Date of Birth</p>
                        <p className="font-medium">{admission.patient?.dateOfBirth ? new Date(admission.patient.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Gender</p>
                        <p className="font-medium capitalize">{admission.patient?.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Blood Group</p>
                        <p className="font-medium">{admission.patient?.bloodGroup || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{admission.patient?.phone || 'N/A'}</p>
                      </div>
                      {admission.patient?.address && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium">{admission.patient.address}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admission Details */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <BuildingOffice2Icon className="h-5 w-5 text-indigo-600" />
                      Admission Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Admission Date</p>
                        <p className="font-medium">{new Date(admission.admissionDate).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Type</p>
                        <p className="font-medium capitalize">{admission.admissionType || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Ward & Bed</p>
                        <p className="font-medium">{admission.bed?.ward?.name} - {admission.bed?.bedNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <span className={clsx(
                          'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                          admission.status === 'ADMITTED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        )}>
                          {admission.status}
                        </span>
                      </div>
                      {admission.admittingDoctor && (
                        <div>
                          <p className="text-sm text-gray-500">Admitting Doctor</p>
                          <p className="font-medium">
                            Dr. {admission.admittingDoctor.user?.firstName} {admission.admittingDoctor.user?.lastName}
                          </p>
                          {admission.admittingDoctor.specialization && (
                            <p className="text-xs text-gray-500">{admission.admittingDoctor.specialization}</p>
                          )}
                        </div>
                      )}
                      {news2Score !== undefined && news2Score !== null && (
                        <div>
                          <p className="text-sm text-gray-500">NEWS2 Score</p>
                          <p className={clsx(
                            'font-bold text-lg',
                            news2Score >= 7 ? 'text-red-600' :
                            news2Score >= 5 ? 'text-orange-600' :
                            news2Score >= 3 ? 'text-yellow-600' :
                            'text-green-600'
                          )}>
                            {news2Score}
                          </p>
                        </div>
                      )}
                    </div>
                    {admission.chiefComplaint && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500">Chief Complaint</p>
                        <p className="font-medium">{admission.chiefComplaint}</p>
                      </div>
                    )}
                    {admission.diagnosis && admission.diagnosis.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">Diagnosis</p>
                        <div className="flex flex-wrap gap-2">
                          {admission.diagnosis.map((d: string, i: number) => (
                            <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {admission.icdCodes && admission.icdCodes.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">ICD Codes</p>
                        <div className="flex flex-wrap gap-2">
                          {admission.icdCodes.map((code: string, i: number) => (
                            <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-mono">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {admission.treatmentPlan && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500">Treatment Plan</p>
                        <p className="font-medium whitespace-pre-wrap">{admission.treatmentPlan}</p>
                      </div>
                    )}
                  </div>

                  {/* Latest Vitals */}
                  {latestVitals && (
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <HeartIcon className="h-5 w-5 text-red-600" />
                        Latest Vitals
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        {latestVitals.respiratoryRate && (
                          <div>
                            <p className="text-sm text-gray-500">Respiratory Rate</p>
                            <p className="font-medium">{latestVitals.respiratoryRate} /min</p>
                          </div>
                        )}
                        {latestVitals.oxygenSaturation && (
                          <div>
                            <p className="text-sm text-gray-500">O₂ Saturation</p>
                            <p className="font-medium">{latestVitals.oxygenSaturation}%</p>
                          </div>
                        )}
                        {latestVitals.heartRate && (
                          <div>
                            <p className="text-sm text-gray-500">Heart Rate</p>
                            <p className="font-medium">{latestVitals.heartRate} bpm</p>
                          </div>
                        )}
                        {latestVitals.bloodPressureSys && (
                          <div>
                            <p className="text-sm text-gray-500">Blood Pressure</p>
                            <p className="font-medium">{latestVitals.bloodPressureSys}/{latestVitals.bloodPressureDia} mmHg</p>
                          </div>
                        )}
                        {latestVitals.temperature && (
                          <div>
                            <p className="text-sm text-gray-500">Temperature</p>
                            <p className="font-medium">{latestVitals.temperature}°C</p>
                          </div>
                        )}
                        {latestVitals.consciousness && (
                          <div>
                            <p className="text-sm text-gray-500">Consciousness</p>
                            <p className="font-medium capitalize">{latestVitals.consciousness}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}

              {activeTab === 'orders' && (
                <div className="space-y-4">
                  {admission.doctorOrders && admission.doctorOrders.length > 0 ? (
                    admission.doctorOrders.map((order: any) => (
                      <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                {order.orderType}
                              </span>
                              <span className={clsx(
                                'px-2 py-1 rounded text-xs font-medium',
                                order.priority === 'STAT' ? 'bg-red-100 text-red-700' :
                                order.priority === 'URGENT' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-700'
                              )}>
                                {order.priority}
                              </span>
                              <span className={clsx(
                                'px-2 py-1 rounded text-xs font-medium',
                                order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                order.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' :
                                'bg-yellow-100 text-yellow-700'
                              )}>
                                {order.status}
                              </span>
                            </div>
                            <p className="font-medium text-gray-900">{order.description}</p>
                            {order.notes && (
                              <p className="text-sm text-gray-600 mt-1">{order.notes}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Ordered: {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No doctor's orders found</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'vitals' && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Vitals History</h3>
                  {admission.patient?.vitals && admission.patient.vitals.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Displaying latest vitals recorded at {new Date().toLocaleString()}
                      </p>
                      {/* VitalsTrendChart component can be added here if needed */}
                      <div className="text-center text-gray-500 py-8">
                        Vitals trend chart will be displayed here
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <HeartIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No vitals recorded yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-4">
                  {admission.progressNotes && admission.progressNotes.length > 0 ? (
                    admission.progressNotes.map((note: any) => (
                      <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              {note.noteType}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              By {note.authorRole} • {new Date(note.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {note.noteType === 'SOAP' ? (
                          <div className="space-y-2">
                            {note.subjective && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700">Subjective:</p>
                                <p className="text-sm text-gray-600">{note.subjective}</p>
                              </div>
                            )}
                            {note.objective && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700">Objective:</p>
                                <p className="text-sm text-gray-600">{note.objective}</p>
                              </div>
                            )}
                            {note.assessment && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700">Assessment:</p>
                                <p className="text-sm text-gray-600">{note.assessment}</p>
                              </div>
                            )}
                            {note.plan && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700">Plan:</p>
                                <p className="text-sm text-gray-600">{note.plan}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{note.content}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No progress notes found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              <p>Failed to load patient details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IPD() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<'beds' | 'admissions' | 'monitoring' | 'discharge'>('beds');
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [wards, setWards] = useState<Ward[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [highRiskPatients, setHighRiskPatients] = useState<Admission[]>([]);
  const [deteriorationData, setDeteriorationData] = useState<DeteriorationDashboard | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<DeteriorationPatient | null>(null);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [selectedBedAdmission, setSelectedBedAdmission] = useState<string | null>(null);
  const [showPatientDrawer, setShowPatientDrawer] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    respiratoryRate: 16,
    oxygenSaturation: 98,
    supplementalOxygen: false,
    bloodPressureSys: 120,
    bloodPressureDia: 80,
    heartRate: 80,
    temperature: 37.0,
    consciousness: 'alert',
  });
  const [stats, setStats] = useState<IPDStats>({
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    criticalPatients: 0,
  });
  const [loading, setLoading] = useState(true);
  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  // Fetch wards with beds
  useEffect(() => {
    const fetchWards = async () => {
      try {
        setLoading(true);
        const response = await ipdApi.getWards();
        setWards(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch wards:', error);
        toast.error('Failed to load wards');
      } finally {
        setLoading(false);
      }
    };

    fetchWards();
  }, []);

  // Fetch high-risk patients
  useEffect(() => {
    const fetchHighRisk = async () => {
      try {
        const response = await ipdApi.getHighRiskPatients();
        setHighRiskPatients(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch high-risk patients:', error);
      }
    };

    fetchHighRisk();
  }, []);

  // Fetch admissions
  useEffect(() => {
    const fetchAdmissions = async () => {
      try {
        const response = await ipdApi.getAdmissions({ status: 'ADMITTED' });
        setAdmissions(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch admissions:', error);
      }
    };

    fetchAdmissions();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await ipdApi.getStats();
        setStats(response.data.data || {
          totalBeds: 0,
          occupiedBeds: 0,
          availableBeds: 0,
          criticalPatients: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  // Fetch deterioration dashboard
  const fetchDeteriorationDashboard = useCallback(async () => {
    try {
      setMonitoringLoading(true);
      const response = await ipdApi.getDeteriorationDashboard();
      setDeteriorationData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch deterioration data:', error);
      toast.error('Failed to load deterioration monitoring data');
    } finally {
      setMonitoringLoading(false);
    }
  }, []);

  // Fetch on tab change
  useEffect(() => {
    if (activeTab === 'monitoring') {
      fetchDeteriorationDashboard();
      // Auto-refresh every 60 seconds when on monitoring tab
      const interval = setInterval(fetchDeteriorationDashboard, 60000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchDeteriorationDashboard]);

  const handlePredictDeterioration = () => {
    setActiveTab('monitoring');
    fetchDeteriorationDashboard();
  };

  const handleOptimizeBeds = () => {
    toast.success('AI is optimizing bed allocation...');
  };

  const handleRecordVitals = async () => {
    if (!selectedPatient) return;
    try {
      const response = await ipdApi.recordVitals(selectedPatient.admissionId, vitalsForm);
      const result = response.data.data;
      toast.success(`Vitals recorded. NEWS2 Score: ${result.news2Score} (${result.riskLevel})`);
      setShowVitalsModal(false);
      fetchDeteriorationDashboard();
    } catch (error) {
      console.error('Failed to record vitals:', error);
      toast.error('Failed to record vitals');
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return 'bg-red-500/20 text-red-700 border-red-500/30';
      case 'MEDIUM-HIGH': return 'bg-orange-500/20 text-orange-700 border-orange-500/30';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'LOW-MEDIUM': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      default: return 'bg-green-500/20 text-green-700 border-green-500/30';
    }
  };

  const getRiskDotColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return 'bg-red-500';
      case 'MEDIUM-HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW-MEDIUM': return 'bg-blue-500';
      default: return 'bg-green-500';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'worsening': return <ArrowTrendingUpIcon className="h-5 w-5 text-red-500" />;
      case 'improving': return <ArrowTrendingDownIcon className="h-5 w-5 text-green-500" />;
      default: return <MinusIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatLastVitals = (time: string | null) => {
    if (!time) return 'Never';
    const diff = Date.now() - new Date(time).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m ago`;
    return `${mins}m ago`;
  };

  const handleDischarge = (admissionId: string) => {
    navigate(`/ipd/admission/${admissionId}?tab=discharge`);
  };

  const getBedColor = (status: string) => {
    if (status === 'AVAILABLE') return 'bg-green-500/20 border-green-500/40 text-green-700';
    if (status === 'MAINTENANCE') return 'bg-gray-500/20 border-gray-500/40 text-gray-600';
    if (status === 'OCCUPIED') return 'bg-blue-500/20 border-blue-500/40 text-blue-700';
    return 'bg-gray-500/20 border-gray-500/40 text-gray-700';
  };

  const handleBedClick = (bed: Ward['beds'][0]) => {
    // Only handle clicks on occupied beds with an admission
    if (bed.status === 'OCCUPIED' && bed.admissions && bed.admissions.length > 0) {
      const currentAdmission = bed.admissions.find(a => a.status === 'ADMITTED');
      if (currentAdmission) {
        setSelectedBedAdmission(currentAdmission.id);
        setShowPatientDrawer(true);
      }
    }
  };

  const dischargeReadyPatients = admissions.filter(a => a.lengthOfStay >= 3);

  const canAdmit = hasPermission('ipd:admissions:write');
  const canDischarge = hasPermission('ipd:discharge');
  const canManageBeds = hasPermission('ipd:beds:manage');
  const canRecordVitals = hasPermission('ipd:admissions:write');
  const canDoRounds = hasPermission('ipd:rounds');

  const allTabs = [
    { id: 'beds', label: 'Bed Management' },
    { id: 'admissions', label: 'Admissions', count: admissions.length },
    { id: 'monitoring', label: 'NEWS2 Monitoring', count: deteriorationData?.summary.highRisk, alert: true },
    { id: 'discharge', label: 'Discharge Planning', count: dischargeReadyPatients.length, permission: 'ipd:discharge' },
  ];
  const tabs = allTabs.filter(tab => !tab.permission || hasPermission(tab.permission));

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-8">
        {/* Floating orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-indigo-300/20 rounded-full blur-2xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30">
              <BuildingOffice2Icon className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">Inpatient Department</h1>
                <span className="px-3 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm text-white rounded-full border border-white/30">
                  Inpatient Department
                </span>
              </div>
              <p className="text-indigo-100">
                Bed management, admissions, and patient monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAIOnline && (
              <>
                <button
                  onClick={handlePredictDeterioration}
                  className="group relative flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-xl text-white rounded-xl border border-white/30 hover:bg-white/30 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                >
                  <HeartIcon className="h-5 w-5" />
                  <span className="font-medium">Deterioration Monitor</span>
                </button>
                {canManageBeds && (
                  <button
                    onClick={handleOptimizeBeds}
                    className="group relative flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-xl text-white rounded-xl border border-white/30 hover:bg-white/30 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                  >
                    <SparklesIcon className="h-5 w-5" />
                    <span className="font-medium">Optimize Beds</span>
                  </button>
                )}
              </>
            )}
            {canAdmit && (
              <button
                onClick={() => setShowAdmissionModal(true)}
                className="group relative flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-white/25"
              >
                <PlusIcon className="h-5 w-5" />
                New Admission
              </button>
            )}
          </div>
        </div>
      </div>

      {/* High Risk Patients Alert */}
      {highRiskPatients.length > 0 && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl p-5"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800">
                {highRiskPatients.length} High Risk Patients Require Attention
              </h3>
              <div className="mt-2 space-y-1.5">
                {highRiskPatients.slice(0, 3).map(p => (
                  <p key={p.id} className="text-sm text-red-700">
                    {p.patient?.firstName} {p.patient?.lastName} ({p.bed?.ward?.name} - {p.bed?.bedNumber})
                    {p.news2Score && ` - NEWS2 Score: ${p.news2Score}`}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated Gradient Tabs */}
      <div
        className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl p-2"
        style={{ animationDelay: '0.15s' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <nav className="flex space-x-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'relative px-5 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <span className="relative z-10 flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-semibold',
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : tab.alert
                        ? 'bg-red-500/20 text-red-600'
                        : 'bg-gray-200 text-gray-700'
                  )}>
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bed Management Tab */}
      {activeTab === 'beds' && (
        <div className="space-y-6">
          {/* Legend */}
          <div
            className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl p-4"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-lg bg-green-500/30 border border-green-500/50" />
                <span className="text-gray-700">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-lg bg-blue-500/30 border border-blue-500/50" />
                <span className="text-gray-700">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-lg bg-gray-500/30 border border-gray-500/50" />
                <span className="text-gray-700">Maintenance</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div
              className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl p-8 text-center"
              style={{ animationDelay: '0.25s' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
              <p className="mt-3 text-gray-600">Loading wards...</p>
            </div>
          ) : wards.length === 0 ? (
            <div
              className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl p-8 text-center"
              style={{ animationDelay: '0.25s' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <div className="p-4 bg-gray-100 rounded-2xl w-fit mx-auto mb-4">
                <UserIcon className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-600">No wards configured</p>
            </div>
          ) : (
            wards.map((ward, wardIndex) => (
              <div
                key={ward.id}
                className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl overflow-hidden"
                style={{ animationDelay: `${0.25 + wardIndex * 0.05}s` }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{ward.name}</h3>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-gray-600">
                      {ward.beds?.filter(b => b.status === 'AVAILABLE').length || 0} / {ward.beds?.length || 0} available
                    </span>
                  </span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {ward.beds?.map((bed) => {
                      const currentAdmission = bed.admissions?.find(a => a.status === 'ADMITTED');
                      const isOccupied = bed.status === 'OCCUPIED' && currentAdmission;

                      return (
                        <div
                          key={bed.id}
                          onClick={() => handleBedClick(bed)}
                          className={clsx(
                            'relative p-3 rounded-xl border-2 transition-all duration-300 backdrop-blur-sm',
                            isOccupied ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'cursor-default',
                            getBedColor(bed.status)
                          )}
                        >
                          <div className="text-center">
                            <p className="font-mono text-sm font-semibold">{bed.bedNumber}</p>
                            {currentAdmission?.patient && (
                              <p className="text-xs mt-1 truncate opacity-80">
                                {currentAdmission.patient.firstName} {currentAdmission.patient.lastName}
                              </p>
                            )}
                            {bed.status === 'AVAILABLE' && (
                              <p className="text-xs mt-1 opacity-80">Available</p>
                            )}
                            {bed.status === 'MAINTENANCE' && (
                              <p className="text-xs mt-1 opacity-80">Maintenance</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Discharge Planning Tab */}
      {activeTab === 'discharge' && (
        <div
          className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl overflow-hidden"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Patients Ready for Discharge</h3>
            {isAIOnline && (
              <span className="flex items-center gap-1.5 text-xs text-purple-600 px-3 py-1.5 bg-purple-500/10 rounded-full">
                <SparklesIcon className="h-4 w-4" />
                AI Predicted
              </span>
            )}
          </div>
          {dischargeReadyPatients.length === 0 ? (
            <div className="p-8 text-center">
              <div className="p-4 bg-gray-100 rounded-2xl w-fit mx-auto mb-4">
                <ArrowRightOnRectangleIcon className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-600">No patients ready for discharge</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {dischargeReadyPatients.map((patient, index) => (
                <div
                  key={patient.id}
                  className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  style={{ animationDelay: `${0.25 + index * 0.05}s` }}
                >
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {patient.patient?.firstName} {patient.patient?.lastName}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {patient.bed?.ward?.name} - {patient.bed?.bedNumber} | LOS: {patient.lengthOfStay} days
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/20 text-green-700 border border-green-500/30">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Ready
                    </span>
                    {canDischarge && (
                      <button
                        onClick={() => handleDischarge(patient.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 hover:scale-105"
                      >
                        <ArrowRightOnRectangleIcon className="h-4 w-4" />
                        Discharge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'admissions' && (
        <div
          className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl overflow-hidden"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <div className="p-5 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Active Admissions</h3>
          </div>
          {admissions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="p-4 bg-gray-100 rounded-2xl w-fit mx-auto mb-4">
                <UserIcon className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-600">No active admissions</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {admissions.map((admission, index) => (
                <div
                  key={admission.id}
                  className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  style={{ animationDelay: `${0.25 + index * 0.05}s` }}
                >
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {admission.patient?.firstName} {admission.patient?.lastName}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {admission.bed?.ward?.name} - {admission.bed?.bedNumber}
                    </p>
                    <p className="text-sm text-gray-500">LOS: {admission.lengthOfStay} days</p>
                  </div>
                  <button 
                    onClick={() => navigate(`/ipd/admission/${admission.id}`)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-all duration-300"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NEWS2 Deterioration Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {deteriorationData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Patients', value: deteriorationData.summary.totalPatients, color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', icon: UserIcon },
                { label: 'High Risk', value: deteriorationData.summary.highRisk, color: 'from-red-500 to-rose-500', bgColor: 'bg-red-500/10', icon: BellAlertIcon },
                { label: 'Vitals Overdue', value: deteriorationData.summary.vitalsOverdue, color: 'from-orange-500 to-amber-500', bgColor: 'bg-orange-500/10', icon: ClockIcon },
                { label: 'Worsening', value: deteriorationData.summary.worsening, color: 'from-purple-500 to-violet-500', bgColor: 'bg-purple-500/10', icon: ArrowTrendingUpIcon },
              ].map((stat, index) => (
                <div
                  key={stat.label}
                  className={clsx(
                    'relative backdrop-blur-xl border border-gray-200 rounded-2xl p-5 overflow-hidden',
                    stat.bgColor
                  )}
                  style={{ animationDelay: `${0.2 + index * 0.05}s` }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                  <div className="flex items-center gap-3 mb-3">
                    <div className={clsx('p-2 rounded-lg bg-gradient-to-r', stat.color)}>
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* NEWS2 Reference Chart */}
          <div
            className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl overflow-hidden"
            style={{ animationDelay: '0.35s' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-500 rounded-lg">
                  <SparklesIcon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">NEWS2 Score Reference</h3>
              </div>
              <button
                onClick={fetchDeteriorationDashboard}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-all duration-300"
                disabled={monitoringLoading}
              >
                <ArrowPathIcon className={clsx('h-4 w-4', monitoringLoading && 'animate-spin')} />
                Refresh
              </button>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-3 text-sm">
                {[
                  { label: '0: Low Risk', color: 'bg-green-500' },
                  { label: '1-2: Low-Medium', color: 'bg-blue-500' },
                  { label: '3-4: Medium', color: 'bg-yellow-500' },
                  { label: '5-6: Medium-High', color: 'bg-orange-500' },
                  { label: '7+: High Risk', color: 'bg-red-500' },
                ].map((item) => (
                  <span
                    key={item.label}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    <span className={clsx('w-2.5 h-2.5 rounded-full', item.color)} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Patient List */}
          <div
            className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl overflow-hidden"
            style={{ animationDelay: '0.4s' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Patient Monitoring</h3>
            </div>
            {monitoringLoading ? (
              <div className="p-8 text-center">
                <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                <p className="mt-3 text-gray-600">Loading monitoring data...</p>
              </div>
            ) : !deteriorationData || deteriorationData.patients.length === 0 ? (
              <div className="p-8 text-center">
                <div className="p-4 bg-gray-100 rounded-2xl w-fit mx-auto mb-4">
                  <HeartIcon className="h-12 w-12 text-gray-400" />
                </div>
                <p className="text-gray-600">No admitted patients to monitor</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {deteriorationData.patients.map((patient, index) => (
                  <div
                    key={patient.admissionId}
                    className={clsx(
                      'p-5 transition-all duration-300',
                      patient.riskLevel === 'HIGH' && 'bg-red-500/10',
                      patient.vitalsOverdue && 'border-l-4 border-orange-500'
                    )}
                    style={{ animationDelay: `${0.45 + index * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="font-semibold text-gray-900">{patient.patientName}</h4>
                          <span className={clsx(
                            'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm',
                            getRiskColor(patient.riskLevel)
                          )}>
                            <span className={clsx('w-2 h-2 rounded-full', getRiskDotColor(patient.riskLevel))} />
                            NEWS2: {patient.news2Score}
                          </span>
                          {getTrendIcon(patient.trend)}
                          {patient.vitalsOverdue && (
                            <span className="flex items-center gap-1.5 text-xs text-orange-600 px-3 py-1 bg-orange-500/10 rounded-full">
                              <ClockIcon className="h-4 w-4" />
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          {patient.ward} - Bed {patient.bedNumber}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Last vitals: {formatLastVitals(patient.lastVitalsTime)}
                        </p>
                        {patient.components.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {patient.components.map((comp, idx) => (
                              <span key={idx} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                                {comp}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-sm mt-3 text-gray-700">
                          <span className="font-medium">Response:</span> {patient.clinicalResponse}
                        </p>
                      </div>
                      {canRecordVitals && (
                        <button
                          onClick={() => {
                            setSelectedPatient(patient);
                            setShowVitalsModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 hover:scale-105"
                        >
                          Record Vitals
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vitals Recording Modal */}
      {showVitalsModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            style={{ animationDelay: '0s' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-gray-900">Record Vitals - {selectedPatient.patientName}</h3>
              <button
                onClick={() => setShowVitalsModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Respiratory Rate (/min)
                  </label>
                  <input
                    type="number"
                    value={vitalsForm.respiratoryRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    min="0"
                    max="60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SpO2 (%)
                  </label>
                  <input
                    type="number"
                    value={vitalsForm.oxygenSaturation}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, oxygenSaturation: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Systolic BP (mmHg)
                  </label>
                  <input
                    type="number"
                    value={vitalsForm.bloodPressureSys}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressureSys: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    min="0"
                    max="300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diastolic BP (mmHg)
                  </label>
                  <input
                    type="number"
                    value={vitalsForm.bloodPressureDia}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressureDia: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    min="0"
                    max="200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    value={vitalsForm.heartRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    min="0"
                    max="250"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature (C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalsForm.temperature}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    min="30"
                    max="45"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  id="supplementalOxygen"
                  checked={vitalsForm.supplementalOxygen}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, supplementalOxygen: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <label htmlFor="supplementalOxygen" className="text-sm font-medium text-gray-700">
                  On Supplemental Oxygen
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consciousness (AVPU)
                </label>
                <select
                  value={vitalsForm.consciousness}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, consciousness: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="alert">Alert</option>
                  <option value="voice">Responds to Voice</option>
                  <option value="pain">Responds to Pain</option>
                  <option value="unresponsive">Unresponsive</option>
                </select>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowVitalsModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordVitals}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 hover:scale-105"
              >
                <HeartIcon className="h-5 w-5" />
                Save & Calculate NEWS2
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Beds', value: stats.totalBeds, color: 'from-gray-500 to-gray-600', dotColor: 'bg-gray-500' },
          { label: 'Occupied', value: stats.occupiedBeds, color: 'from-blue-500 to-cyan-500', dotColor: 'bg-blue-500' },
          { label: 'Available', value: stats.availableBeds, color: 'from-green-500 to-emerald-500', dotColor: 'bg-green-500' },
          { label: 'Critical Patients', value: stats.criticalPatients, color: 'from-red-500 to-rose-500', dotColor: 'bg-red-500' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="relative backdrop-blur-xl bg-white border border-gray-200 rounded-2xl p-5 overflow-hidden"
            style={{ animationDelay: `${0.5 + index * 0.05}s` }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <span className={clsx('w-3 h-3 rounded-full', stat.dotColor)} />
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            </div>
            <p className={clsx('text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent', stat.color)}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* New Admission Modal */}
      {showAdmissionModal && (
        <NewAdmissionModal
          wards={wards}
          onClose={() => setShowAdmissionModal(false)}
          onSuccess={async () => {
            setShowAdmissionModal(false);
            // Refresh data
            try {
              const [wardsRes, admissionsRes, statsRes] = await Promise.all([
                ipdApi.getWards(),
                ipdApi.getAdmissions({ status: 'ADMITTED' }),
                ipdApi.getStats(),
              ]);
              setWards(wardsRes.data.data || []);
              setAdmissions(admissionsRes.data.data || []);
              setStats(statsRes.data.data || stats);
            } catch (error) {
              console.error('Failed to refresh data:', error);
            }
          }}
        />
      )}

      {/* Patient Detail Drawer */}
      {showPatientDrawer && selectedBedAdmission && (
        <PatientDetailDrawer
          admissionId={selectedBedAdmission}
          onClose={() => {
            setShowPatientDrawer(false);
            setSelectedBedAdmission(null);
          }}
        />
      )}
    </div>
  );
}
