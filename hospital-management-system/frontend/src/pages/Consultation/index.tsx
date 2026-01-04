import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserCircleIcon,
  BeakerIcon,
  DocumentTextIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import DiagnosticAssistant from '../../components/ai/DiagnosticAssistant';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  bloodGroup?: string;
  allergies?: { allergen: string; severity: string }[];
  medicalHistory?: { condition: string; diagnosedDate: string }[];
}

interface Vital {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  weight?: number;
  height?: number;
}

interface Appointment {
  id: string;
  reason?: string;
  notes?: string;
  status: string;
}

interface Diagnosis {
  icd10: string;
  name: string;
  confidence: number;
  category?: string;
  severity?: string;
}

export default function Consultation() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'diagnosis' | 'prescription' | 'notes'>('overview');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<Vital | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  // Consultation form state
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<Diagnosis | null>(null);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [prescriptions, setPrescriptions] = useState<Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>>([]);

  // Fetch real appointment and patient data from API
  useEffect(() => {
    const fetchConsultationData = async () => {
      setLoading(true);
      try {
        if (!appointmentId) {
          throw new Error('Appointment ID is required');
        }

        // Fetch appointment details (includes patient info)
        const appointmentRes = await fetch(`${API_URL}/appointments/${appointmentId}`, {
          headers: getAuthHeaders(),
        });

        if (!appointmentRes.ok) {
          throw new Error('Failed to fetch appointment');
        }

        const appointmentData = await appointmentRes.json();
        const apt = appointmentData.data;

        setAppointment({
          id: apt.id,
          reason: apt.reason || '',
          notes: apt.notes || '',
          status: apt.status,
        });

        if (apt.reason) {
          setChiefComplaint(apt.reason);
        }

        // Fetch patient details
        if (apt.patientId) {
          const patientRes = await fetch(`${API_URL}/patients/${apt.patientId}`, {
            headers: getAuthHeaders(),
          });

          if (patientRes.ok) {
            const patientData = await patientRes.json();
            const pt = patientData.data;
            setPatient({
              id: pt.id,
              firstName: pt.firstName,
              lastName: pt.lastName,
              mrn: pt.mrn,
              dateOfBirth: pt.dateOfBirth,
              gender: pt.gender,
              phone: pt.phone,
              bloodGroup: pt.bloodGroup,
              allergies: pt.allergies || [],
              medicalHistory: pt.medicalHistory || [],
            });

            // Fetch patient vitals
            try {
              const vitalsRes = await fetch(`${API_URL}/patients/${apt.patientId}/vitals?limit=1`, {
                headers: getAuthHeaders(),
              });
              if (vitalsRes.ok) {
                const vitalsData = await vitalsRes.json();
                if (vitalsData.data && vitalsData.data.length > 0) {
                  const v = vitalsData.data[0];
                  setVitals({
                    bloodPressure: v.bloodPressure,
                    heartRate: v.heartRate,
                    temperature: v.temperature,
                    oxygenSaturation: v.oxygenSaturation,
                    respiratoryRate: v.respiratoryRate,
                    weight: v.weight,
                    height: v.height,
                  });
                }
              }
            } catch (vitalsError) {
              console.warn('Could not fetch vitals:', vitalsError);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch consultation data:', error);
        toast.error('Failed to load consultation data');
      } finally {
        setLoading(false);
      }
    };

    fetchConsultationData();
  }, [appointmentId]);

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleDiagnosisSelect = (diagnosis: Diagnosis) => {
    setSelectedDiagnosis(diagnosis);
    toast.success(`Selected: ${diagnosis.name}`);
  };

  const handleTestSelect = (tests: string[]) => {
    setSelectedTests(tests);
    toast.success(`${tests.length} tests added to order`);
  };

  const addPrescription = () => {
    setPrescriptions([...prescriptions, {
      medication: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: '',
    }]);
  };

  const updatePrescription = (index: number, field: string, value: string) => {
    const updated = [...prescriptions];
    updated[index] = { ...updated[index], [field]: value };
    setPrescriptions(updated);
  };

  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const completeConsultation = async () => {
    try {
      toast.success('Consultation completed successfully');
      navigate('/opd');
    } catch (error) {
      toast.error('Failed to complete consultation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const patientAge = patient ? calculateAge(patient.dateOfBirth) : 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: UserCircleIcon },
    { id: 'diagnosis', label: 'AI Diagnosis', icon: SparklesIcon },
    { id: 'prescription', label: 'Prescription', icon: DocumentTextIcon },
    { id: 'notes', label: 'Notes & Orders', icon: BeakerIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Consultation
            </h1>
            <p className="text-sm text-gray-500">
              {patient?.firstName} {patient?.lastName} ({patient?.mrn})
            </p>
          </div>
        </div>
        <button
          onClick={completeConsultation}
          className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
        >
          <CheckCircleIcon className="h-5 w-5" />
          Complete Consultation
        </button>
      </div>

      {/* Patient Summary Card */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="grid md:grid-cols-4 gap-6">
          {/* Patient Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <span className="text-2xl font-bold">
                  {patient?.firstName[0]}{patient?.lastName[0]}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold">{patient?.firstName} {patient?.lastName}</h2>
                <p className="text-blue-100">
                  {patientAge} yrs • {patient?.gender} • {patient?.bloodGroup}
                </p>
                <p className="text-sm text-blue-200">{patient?.phone}</p>
              </div>
            </div>

            {/* Allergies Warning */}
            {patient?.allergies && patient.allergies.length > 0 && (
              <div className="mt-4 p-3 bg-red-500/20 backdrop-blur border border-red-300/30 rounded-xl">
                <div className="flex items-center gap-2 text-red-100">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  <span className="font-medium">Allergies:</span>
                  {patient.allergies.map(a => a.allergen).join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* Vitals */}
          <div className="md:col-span-2 grid grid-cols-3 gap-3">
            {vitals && (
              <>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-200">BP</p>
                  <p className="text-lg font-bold">{vitals.bloodPressure}</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-200">Heart Rate</p>
                  <p className="text-lg font-bold">{vitals.heartRate} bpm</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-200">SpO2</p>
                  <p className="text-lg font-bold">{vitals.oxygenSaturation}%</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-200">Temp</p>
                  <p className="text-lg font-bold">{vitals.temperature}°C</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-200">Resp Rate</p>
                  <p className="text-lg font-bold">{vitals.respiratoryRate}/min</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-200">Weight</p>
                  <p className="text-lg font-bold">{vitals.weight} kg</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl p-1.5 shadow-sm border border-gray-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className={clsx(
          'lg:col-span-2',
          activeTab === 'diagnosis' && 'lg:col-span-3'
        )}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Chief Complaint */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Chief Complaint</h3>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Enter patient's chief complaint..."
                  className="w-full h-24 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Medical History */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical History</h3>
                <div className="space-y-3">
                  {patient?.medicalHistory?.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <HeartIcon className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.condition}</p>
                        <p className="text-sm text-gray-500">
                          Since {new Date(item.diagnosedDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!patient?.medicalHistory || patient.medicalHistory.length === 0) && (
                    <p className="text-gray-500">No medical history recorded</p>
                  )}
                </div>
              </div>

              {/* Reason for Visit */}
              {appointment?.reason && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-amber-800 mb-2">
                    Reason for Visit
                  </h3>
                  <p className="text-amber-700">{appointment.reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Diagnosis Tab - Full Width */}
          {activeTab === 'diagnosis' && (
            <DiagnosticAssistant
              patient={{
                id: patient?.id,
                age: patientAge,
                gender: patient?.gender || 'unknown',
                medicalHistory: patient?.medicalHistory?.map(h => h.condition) || [],
                currentMedications: [],
                allergies: patient?.allergies?.map(a => a.allergen) || [],
                vitalSigns: vitals || undefined,
              }}
              onDiagnosisSelect={handleDiagnosisSelect}
              onTestSelect={handleTestSelect}
            />
          )}

          {/* Prescription Tab */}
          {activeTab === 'prescription' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Prescriptions</h3>
                <button
                  onClick={addPrescription}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Medication
                </button>
              </div>

              {prescriptions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <DocumentTextIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-3">No prescriptions added yet</p>
                  <button
                    onClick={addPrescription}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Add first prescription
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((rx, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                      <div className="grid md:grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Medication name"
                          value={rx.medication}
                          onChange={(e) => updatePrescription(idx, 'medication', e.target.value)}
                          className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Dosage (e.g., 500mg)"
                          value={rx.dosage}
                          onChange={(e) => updatePrescription(idx, 'dosage', e.target.value)}
                          className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Frequency (e.g., twice daily)"
                          value={rx.frequency}
                          onChange={(e) => updatePrescription(idx, 'frequency', e.target.value)}
                          className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Duration (e.g., 7 days)"
                          value={rx.duration}
                          onChange={(e) => updatePrescription(idx, 'duration', e.target.value)}
                          className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="mt-3 flex gap-3">
                        <input
                          type="text"
                          placeholder="Special instructions"
                          value={rx.instructions}
                          onChange={(e) => updatePrescription(idx, 'instructions', e.target.value)}
                          className="flex-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => removePrescription(idx)}
                          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Clinical Notes */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinical Notes</h3>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Enter clinical notes, observations, and findings..."
                  className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Lab Orders */}
              {selectedTests.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lab Orders</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTests.map((test) => (
                      <span
                        key={test}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium text-sm"
                      >
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Hidden on diagnosis tab */}
        {activeTab !== 'diagnosis' && (
          <div className="space-y-6">
            {/* Selected Diagnosis */}
            {selectedDiagnosis && (
              <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
                <h3 className="text-lg font-semibold text-purple-800 mb-3">
                  Selected Diagnosis
                </h3>
                <div className="p-4 bg-white rounded-xl border border-purple-100">
                  <p className="font-medium text-gray-900">{selectedDiagnosis.name}</p>
                  <p className="text-sm text-gray-500">ICD-10: {selectedDiagnosis.icd10}</p>
                  <div className="mt-2">
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      selectedDiagnosis.confidence >= 0.7 ? 'bg-green-100 text-green-700' :
                      selectedDiagnosis.confidence >= 0.4 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {Math.round(selectedDiagnosis.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('diagnosis')}
                  className="mt-3 text-sm text-purple-600 hover:underline font-medium"
                >
                  Change diagnosis →
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('diagnosis')}
                  className="w-full p-3 text-left rounded-xl hover:bg-purple-50 flex items-center gap-3 transition-colors group"
                >
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <SparklesIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="text-gray-700 font-medium">Run AI Diagnosis</span>
                </button>
                <button
                  onClick={() => setActiveTab('prescription')}
                  className="w-full p-3 text-left rounded-xl hover:bg-blue-50 flex items-center gap-3 transition-colors group"
                >
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-gray-700 font-medium">Write Prescription</span>
                </button>
                <button className="w-full p-3 text-left rounded-xl hover:bg-green-50 flex items-center gap-3 transition-colors group">
                  <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                    <BeakerIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-gray-700 font-medium">Order Lab Tests</span>
                </button>
              </div>
            </div>

            {/* Consultation Timer */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 text-center border border-gray-200">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                <ClockIcon className="h-6 w-6 text-gray-500" />
              </div>
              <p className="text-sm text-gray-500">Consultation Duration</p>
              <p className="text-2xl font-bold text-gray-800">12:45</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
