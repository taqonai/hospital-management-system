import { useState, useEffect } from 'react';
import {
  UserIcon,
  BeakerIcon,
  HeartIcon,
  ClipboardDocumentListIcon,
  ClipboardDocumentCheckIcon,
  CheckBadgeIcon,
  ArrowPathRoundedSquareIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { nursingApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Import existing nursing components
import MedSchedule from '../../components/nursing/MedSchedule';
import BarcodeScanner from '../../components/nursing/BarcodeScanner';
import MedVerification from '../../components/nursing/MedVerification';
import MedAdminRecord from '../../components/nursing/MedAdminRecord';
import VitalsTrendChart from '../../components/nursing/VitalsTrendChart';
import EWSCalculator from '../../components/nursing/EWSCalculator';
import EWSAlertCard from '../../components/nursing/EWSAlertCard';

type Tab = 'patients' | 'emar' | 'vitals' | 'assessments' | 'tasks' | 'handoff';

interface DashboardStats {
  myPatients: number;
  pendingTasks: number;
  overdueMeds: number;
  alerts: number;
}

interface Patient {
  assignmentId: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup: string;
  };
  bed: {
    id: string;
    bedNumber: string;
    ward: {
      name: string;
    };
  };
  diagnosis: string[];
  admissionDate: string;
  latestVital: any;
  news2Score: number | null;
  riskLevel: string | null;
  admission?: { id: string }; // Add optional admission property
}

export default function Nursing() {
  const [activeTab, setActiveTab] = useState<Tab>('patients');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    myPatients: 0,
    pendingTasks: 0,
    overdueMeds: 0,
    alerts: 0,
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'patients') {
      loadMyPatients();
    }
  }, [activeTab]);

  const loadDashboard = async () => {
    try {
      const response = await nursingApi.getDashboard();
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadMyPatients = async () => {
    try {
      const response = await nursingApi.getMyPatients();
      setPatients(response.data.data || []);
    } catch (error) {
      console.error('Failed to load patients:', error);
      toast.error('Failed to load patients');
    }
  };

  const tabs = [
    { id: 'patients' as Tab, label: 'My Patients', icon: UserIcon },
    { id: 'emar' as Tab, label: 'eMAR', icon: BeakerIcon },
    { id: 'vitals' as Tab, label: 'Vitals & I/O', icon: HeartIcon },
    { id: 'assessments' as Tab, label: 'Assessments', icon: ClipboardDocumentListIcon },
    { id: 'tasks' as Tab, label: 'Tasks', icon: CheckBadgeIcon },
    { id: 'handoff' as Tab, label: 'Handoff', icon: ArrowPathRoundedSquareIcon },
  ];

  const getRiskLevelColor = (riskLevel: string | null) => {
    if (!riskLevel) return 'bg-gray-100 text-gray-700';
    switch (riskLevel) {
      case 'HIGH':
        return 'bg-red-100 text-red-700';
      case 'MEDIUM':
      case 'LOW_MEDIUM':
        return 'bg-yellow-100 text-yellow-700';
      case 'LOW':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nursing Station</h1>
            <p className="text-gray-600 mt-1">Patient care & medication management</p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-4">
            <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-blue-100">
              <div className="text-2xl font-bold text-blue-600">{stats.myPatients}</div>
              <div className="text-xs text-gray-600">My Patients</div>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-yellow-100">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingTasks}</div>
              <div className="text-xs text-gray-600">Pending Tasks</div>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-red-100">
              <div className="text-2xl font-bold text-red-600">{stats.overdueMeds}</div>
              <div className="text-xs text-gray-600">Overdue Meds</div>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-purple-100">
              <div className="text-2xl font-bold text-purple-600">{stats.alerts}</div>
              <div className="text-xs text-gray-600">Alerts</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
                )}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-xl p-6 min-h-[600px]">
        {activeTab === 'patients' && (
          <MyPatientsTab patients={patients} onSelectPatient={setSelectedPatient} />
        )}
        {activeTab === 'emar' && <EmarTab patients={patients} />}
        {activeTab === 'vitals' && <VitalsTab patients={patients} />}
        {activeTab === 'assessments' && <AssessmentsTab patients={patients} />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'handoff' && <HandoffTab patients={patients} />}
      </div>
    </div>
  );
}

// ==================== TAB 1: MY PATIENTS ====================

function MyPatientsTab({ patients, onSelectPatient }: {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
}) {
  if (patients.length === 0) {
    return (
      <div className="text-center py-20">
        <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">No patients assigned to you for this shift</p>
        <p className="text-gray-400 text-sm mt-2">Assignments will appear here once made by charge nurse</p>
      </div>
    );
  }

  const getRiskLevelColor = (riskLevel: string | null) => {
    if (!riskLevel) return 'bg-gray-100 text-gray-700';
    switch (riskLevel) {
      case 'HIGH':
        return 'bg-red-100 text-red-700';
      case 'MEDIUM':
      case 'LOW_MEDIUM':
        return 'bg-yellow-100 text-yellow-700';
      case 'LOW':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Assigned Patients</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.map((patient) => (
          <div
            key={patient.assignmentId}
            className="bg-gradient-to-br from-white to-blue-50 rounded-xl p-5 border-2 border-blue-100 hover:border-blue-300 transition-all cursor-pointer"
            onClick={() => onSelectPatient(patient)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {patient.patient.firstName} {patient.patient.lastName}
                </h3>
                <p className="text-sm text-gray-500">MRN: {patient.patient.mrn}</p>
              </div>
              {patient.news2Score !== null && (
                <span className={clsx(
                  'px-3 py-1 rounded-full text-xs font-semibold',
                  getRiskLevelColor(patient.riskLevel)
                )}>
                  NEWS2: {patient.news2Score}
                </span>
              )}
            </div>

            {/* Bed Info */}
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-lg font-semibold">
                {patient.bed.bedNumber}
              </span>
              <span className="text-gray-600">{patient.bed.ward.name}</span>
            </div>

            {/* Diagnosis */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Diagnosis:</p>
              <div className="flex flex-wrap gap-1">
                {patient.diagnosis.slice(0, 2).map((diag, idx) => (
                  <span key={idx} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
                    {diag}
                  </span>
                ))}
                {patient.diagnosis.length > 2 && (
                  <span className="text-gray-500 text-xs">+{patient.diagnosis.length - 2} more</span>
                )}
              </div>
            </div>

            {/* Latest Vitals */}
            {patient.latestVital && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                {patient.latestVital.bloodPressureSys && (
                  <div className="bg-white rounded-lg px-2 py-1">
                    <div className="text-gray-500">BP</div>
                    <div className="font-semibold">{patient.latestVital.bloodPressureSys}/{patient.latestVital.bloodPressureDia}</div>
                  </div>
                )}
                {patient.latestVital.heartRate && (
                  <div className="bg-white rounded-lg px-2 py-1">
                    <div className="text-gray-500">HR</div>
                    <div className="font-semibold">{patient.latestVital.heartRate}</div>
                  </div>
                )}
                {patient.latestVital.oxygenSaturation && (
                  <div className="bg-white rounded-lg px-2 py-1">
                    <div className="text-gray-500">SpO2</div>
                    <div className="font-semibold">{patient.latestVital.oxygenSaturation}%</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== TAB 2: eMAR ====================

function EmarTab({ patients }: { patients: Patient[] }) {
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (patients.length > 0 && !selectedAdmissionId) {
      setSelectedAdmissionId(patients[0].admission.id);
    }
  }, [patients]);

  useEffect(() => {
    if (selectedAdmissionId) {
      loadEMAR();
    }
  }, [selectedAdmissionId]);

  const loadEMAR = async () => {
    if (!selectedAdmissionId) return;
    setLoading(true);
    try {
      const response = await nursingApi.getEMAR(selectedAdmissionId);
      setMedications(response.data.data || []);
    } catch (error) {
      console.error('Failed to load eMAR:', error);
      toast.error('Failed to load medications');
    } finally {
      setLoading(false);
    }
  };

  if (patients.length === 0) {
    return (
      <div className="text-center py-20">
        <BeakerIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No patients assigned. eMAR will appear once you have patients.</p>
      </div>
    );
  }

  const selectedPatient = patients.find(p => p.admission?.id === selectedAdmissionId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">eMAR - Electronic Medication Administration Record</h2>
        
        {/* Patient Selector */}
        <select
          value={selectedAdmissionId || ''}
          onChange={(e) => setSelectedAdmissionId(e.target.value)}
          className="px-4 py-2 border-2 border-blue-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
        >
          {patients.map((patient) => (
            <option key={patient.assignmentId} value={patient.admission.id}>
              {patient.patient.firstName} {patient.patient.lastName} - {patient.bed.bedNumber}
            </option>
          ))}
        </select>
      </div>

      {selectedPatient && (
        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-bold text-lg text-gray-900">
                {selectedPatient.patient.firstName} {selectedPatient.patient.lastName}
              </h3>
              <p className="text-sm text-gray-600">
                MRN: {selectedPatient.patient.mrn} | Bed: {selectedPatient.bed.bedNumber}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* eMAR Medication List */}
      <div className="bg-white rounded-xl border-2 border-blue-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Medication Schedule</h3>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            Refresh
          </button>
        </div>
        {medications.length > 0 ? (
          <MedSchedule
            medications={medications.map((m: any) => ({
              id: m.id || '',
              prescriptionId: m.prescriptionId || '',
              name: m.medicationName || '',
              genericName: m.genericName || '',
              dose: m.dosage || '',
              unit: m.unit || 'mg',
              route: m.route || 'ORAL',
              frequency: m.frequency || '',
              scheduledTime: m.scheduledTime || new Date().toISOString(),
              status: (m.status === 'OVERDUE' ? 'OVERDUE' : m.status === 'DUE' ? 'DUE_NOW' : 'SCHEDULED') as any,
              isPRN: m.frequency === 'PRN',
              isHighAlert: false,
              instructions: m.notes || '',
              prescribedBy: m.prescribedBy || 'Doctor',
            }))}
            onSelectMedication={(med) => console.log('Selected:', med)}
            onRefresh={() => loadEMAR()}
            loading={loading}
          />
        ) : (
          <div className="text-center py-10 text-gray-400">
            <ClipboardDocumentCheckIcon className="w-12 h-12 mx-auto mb-2" />
            <p>{loading ? 'Loading medications...' : 'No medications scheduled for this patient'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== TAB 3: VITALS & I/O ====================

function VitalsTab({ patients }: { patients: Patient[] }) {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  useEffect(() => {
    if (patients.length > 0 && !selectedPatient) {
      setSelectedPatient(patients[0].patient.id);
    }
  }, [patients]);

  if (patients.length === 0) {
    return (
      <div className="text-center py-20">
        <HeartIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No patients assigned</p>
      </div>
    );
  }

  const patient = patients.find(p => p.patient.id === selectedPatient);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Vitals & Intake/Output</h2>
        
        {/* Patient Selector */}
        <select
          value={selectedPatient || ''}
          onChange={(e) => setSelectedPatient(e.target.value)}
          className="px-4 py-2 border-2 border-purple-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500"
        >
          {patients.map((p) => (
            <option key={p.patient.id} value={p.patient.id}>
              {p.patient.firstName} {p.patient.lastName} - {p.bed.bedNumber}
            </option>
          ))}
        </select>
      </div>

      {patient && (
        <div className="space-y-6">
          {/* Vitals Trend Chart */}
          <div className="bg-white rounded-xl border-2 border-purple-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Vitals Trends (24h)</h3>
            <VitalsTrendChart
              data={{
                labels: [],
                respiratoryRate: [],
                oxygenSaturation: [],
                heartRate: [],
                systolicBP: [],
                diastolicBP: [],
                temperature: [],
                news2Scores: [],
              }}
              patientName={`${patient.patient.firstName} ${patient.patient.lastName}`}
            />
          </div>

          {/* NEWS2 Calculator & EWS Alert */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border-2 border-yellow-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">NEWS2 Calculator</h3>
              <EWSCalculator
                patientId={patient.patient.id}
                patientName={`${patient.patient.firstName} ${patient.patient.lastName}`}
              />
            </div>
            <div className="bg-white rounded-xl border-2 border-red-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Early Warning Alerts</h3>
              <EWSAlertCard
                alert={{
                  id: patient.patient.id,
                  patientId: patient.patient.id,
                  patientName: `${patient.patient.firstName} ${patient.patient.lastName}`,
                  ward: patient.bed?.ward || 'N/A',
                  bed: patient.bed?.bedNumber || 'N/A',
                  severity: 'info',
                  title: 'Patient Monitoring',
                  news2Score: patient.latestVitals?.news2Score || 0,
                  riskLevel: (patient.latestVitals?.news2Risk as any) || 'LOW',
                  components: [],
                  clinicalResponse: 'Routine monitoring',
                  timestamp: new Date().toISOString(),
                  status: 'active',
                }}
                compact
              />
            </div>
          </div>

          {/* I&O Balance (simplified for now) */}
          <div className="bg-white rounded-xl border-2 border-blue-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Intake & Output (24h Balance)</h3>
            <IntakeOutputBalance admissionId={patient.assignmentId} />
          </div>
        </div>
      )}
    </div>
  );
}

function IntakeOutputBalance({ admissionId }: { admissionId: string }) {
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBalance();
  }, [admissionId]);

  const loadBalance = async () => {
    try {
      const response = await nursingApi.getIOBalance(admissionId);
      setBalance(response.data.data);
    } catch (error) {
      console.error('Failed to load I&O balance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center text-gray-500">Loading...</div>;
  if (!balance) return <div className="text-center text-gray-500">No I&O data recorded</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-green-50 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-green-600">{balance.intake} mL</div>
        <div className="text-sm text-gray-600 mt-1">Total Intake</div>
      </div>
      <div className="bg-red-50 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-red-600">{balance.output} mL</div>
        <div className="text-sm text-gray-600 mt-1">Total Output</div>
      </div>
      <div className={clsx(
        'rounded-lg p-4 text-center',
        balance.balance >= 0 ? 'bg-blue-50' : 'bg-yellow-50'
      )}>
        <div className={clsx(
          'text-3xl font-bold',
          balance.balance >= 0 ? 'text-blue-600' : 'text-yellow-600'
        )}>
          {balance.balance > 0 ? '+' : ''}{balance.balance} mL
        </div>
        <div className="text-sm text-gray-600 mt-1">Balance</div>
      </div>
    </div>
  );
}

// ==================== TAB 4: ASSESSMENTS ====================

function AssessmentsTab({ patients }: { patients: Patient[] }) {
  return (
    <div className="text-center py-20">
      <ClipboardDocumentListIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500 text-lg">Nursing Assessments</p>
      <p className="text-gray-400 text-sm mt-2">Assessment forms coming soon</p>
      <p className="text-xs text-gray-400 mt-4">Pain, Fall Risk, Braden Scale, Head-to-Toe, etc.</p>
    </div>
  );
}

// ==================== TAB 5: TASKS ====================

function TasksTab() {
  return (
    <div className="text-center py-20">
      <CheckBadgeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500 text-lg">Task Management</p>
      <p className="text-gray-400 text-sm mt-2">Task list coming soon</p>
      <p className="text-xs text-gray-400 mt-4">Track medications due, vitals to record, assessments needed</p>
    </div>
  );
}

// ==================== TAB 6: HANDOFF ====================

function HandoffTab({ patients }: { patients: Patient[] }) {
  return (
    <div className="text-center py-20">
      <ArrowPathRoundedSquareIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500 text-lg">Shift Handoff (SBAR)</p>
      <p className="text-gray-400 text-sm mt-2">Handoff forms coming soon</p>
      <p className="text-xs text-gray-400 mt-4">Situation, Background, Assessment, Recommendation</p>
    </div>
  );
}
