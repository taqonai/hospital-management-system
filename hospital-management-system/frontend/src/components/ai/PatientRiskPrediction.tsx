import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  HeartIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CalendarIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldExclamationIcon,
  BeakerIcon,
  UserIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface RiskPrediction {
  riskScore: number;
  riskLevel: string;
  factors: string[];
  recommendations: string[];
  clinicalScores?: {
    lace?: {
      score: number;
      interpretation: string;
      components: string[];
    };
    news2?: {
      score: number;
      level: string;
      components: string[];
    };
    charlson?: {
      score: number;
      interpretation: string;
    };
  };
  vitalSigns?: {
    heartRate: number;
    systolicBP: number;
    respiratoryRate: number;
    oxygenSaturation: number;
    temperature: number;
  };
  prediction?: {
    expectedDays: number;
    range: { lower: number; upper: number };
  };
  confidenceInterval?: {
    lower: number;
    upper: number;
  };
  timeframe?: string;
  modelVersion: string;
}

const PREDICTION_TYPES = [
  {
    id: 'READMISSION',
    name: '30-Day Readmission',
    icon: ArrowTrendingUpIcon,
    color: 'blue',
    description: 'Risk of hospital readmission within 30 days',
  },
  {
    id: 'MORTALITY',
    name: 'Mortality Risk',
    icon: HeartIcon,
    color: 'red',
    description: 'In-hospital mortality risk assessment',
  },
  {
    id: 'DETERIORATION',
    name: 'Clinical Deterioration',
    icon: ExclamationTriangleIcon,
    color: 'amber',
    description: 'Risk of acute clinical deterioration (NEWS2)',
  },
  {
    id: 'LENGTH_OF_STAY',
    name: 'Length of Stay',
    icon: ClockIcon,
    color: 'purple',
    description: 'Predicted hospital length of stay',
  },
  {
    id: 'NO_SHOW',
    name: 'No-Show Risk',
    icon: CalendarIcon,
    color: 'orange',
    description: 'Appointment no-show prediction',
  },
  {
    id: 'DISEASE_PROGRESSION',
    name: 'Disease Progression',
    icon: ChartBarIcon,
    color: 'teal',
    description: 'Chronic disease progression risk',
  },
];

const DEMO_PATIENTS = [
  {
    name: 'High Risk Patient',
    data: {
      age: 78,
      gender: 'male',
      lengthOfStay: 8,
      admissionType: 'emergency',
      edVisits: 4,
      medicalHistory: {
        chronicConditions: ['heart failure', 'diabetes', 'chronic kidney disease', 'COPD'],
      },
      admissionHistory: [{}, {}, {}],
      medications: ['metformin', 'lisinopril', 'furosemide', 'atorvastatin', 'aspirin', 'metoprolol'],
      vitals: {
        heartRate: 102,
        bloodPressureSys: 88,
        respiratoryRate: 24,
        temperature: 38.2,
        oxygenSaturation: 91,
      },
      labResults: {
        hemoglobin: 10.5,
        creatinine: 2.8,
        sodium: 132,
        bnp: 850,
      },
    },
  },
  {
    name: 'Moderate Risk Patient',
    data: {
      age: 65,
      gender: 'female',
      lengthOfStay: 4,
      admissionType: 'urgent',
      edVisits: 1,
      medicalHistory: {
        chronicConditions: ['hypertension', 'diabetes'],
      },
      admissionHistory: [{}],
      medications: ['metformin', 'lisinopril', 'amlodipine'],
      vitals: {
        heartRate: 88,
        bloodPressureSys: 145,
        respiratoryRate: 18,
        temperature: 37.2,
        oxygenSaturation: 96,
      },
      labResults: {
        hemoglobin: 12.0,
        creatinine: 1.3,
        sodium: 138,
        bnp: 80,
      },
    },
  },
  {
    name: 'Low Risk Patient',
    data: {
      age: 45,
      gender: 'male',
      lengthOfStay: 2,
      admissionType: 'elective',
      edVisits: 0,
      medicalHistory: {
        chronicConditions: [],
      },
      admissionHistory: [],
      medications: [],
      vitals: {
        heartRate: 72,
        bloodPressureSys: 118,
        respiratoryRate: 14,
        temperature: 36.8,
        oxygenSaturation: 99,
      },
      labResults: {
        hemoglobin: 14.5,
        creatinine: 0.9,
        sodium: 140,
        bnp: 25,
      },
    },
  },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export default function PatientRiskPrediction() {
  const [selectedPrediction, setSelectedPrediction] = useState('READMISSION');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    demographics: true,
    vitals: true,
    labs: false,
    history: false,
  });

  // Patient data form
  const [patientData, setPatientData] = useState({
    age: 65,
    gender: 'male',
    lengthOfStay: 3,
    admissionType: 'emergency',
    edVisits: 2,
    chronicConditions: 'hypertension, diabetes, heart failure',
    priorAdmissions: 1,
    medications: 'metformin, lisinopril, furosemide, aspirin',
    // Vitals
    heartRate: 88,
    systolicBP: 130,
    diastolicBP: 82,
    respiratoryRate: 18,
    temperature: 37.0,
    oxygenSaturation: 96,
    // Labs
    hemoglobin: 12.5,
    wbc: 9.0,
    creatinine: 1.2,
    sodium: 138,
    potassium: 4.2,
    glucose: 145,
    bnp: 150,
    // No-show specific
    noShowHistory: 0,
    leadTimeDays: 7,
    appointmentDay: 'wednesday',
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const loadDemoPatient = (demo: typeof DEMO_PATIENTS[0]) => {
    const d = demo.data;
    setPatientData({
      age: d.age,
      gender: d.gender,
      lengthOfStay: d.lengthOfStay,
      admissionType: d.admissionType,
      edVisits: d.edVisits,
      chronicConditions: d.medicalHistory.chronicConditions.join(', '),
      priorAdmissions: d.admissionHistory.length,
      medications: d.medications.join(', '),
      heartRate: d.vitals.heartRate,
      systolicBP: d.vitals.bloodPressureSys,
      diastolicBP: 80,
      respiratoryRate: d.vitals.respiratoryRate,
      temperature: d.vitals.temperature,
      oxygenSaturation: d.vitals.oxygenSaturation,
      hemoglobin: d.labResults.hemoglobin,
      wbc: 9.0,
      creatinine: d.labResults.creatinine,
      sodium: d.labResults.sodium,
      potassium: 4.2,
      glucose: 145,
      bnp: d.labResults.bnp,
      noShowHistory: 0,
      leadTimeDays: 7,
      appointmentDay: 'wednesday',
    });
  };

  const handlePredict = async () => {
    setIsLoading(true);
    setError(null);
    setPrediction(null);

    try {
      const requestData = {
        patientId: 'demo-patient',
        predictionType: selectedPrediction,
        timeframe: '30 days',
        patientData: {
          age: patientData.age,
          gender: patientData.gender,
          lengthOfStay: patientData.lengthOfStay,
          admissionType: patientData.admissionType,
          edVisits: patientData.edVisits,
          medicalHistory: {
            chronicConditions: patientData.chronicConditions
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean),
          },
          admissionHistory: Array(patientData.priorAdmissions).fill({}),
          medications: patientData.medications
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean),
          vitals: {
            heartRate: patientData.heartRate,
            bloodPressureSys: patientData.systolicBP,
            bloodPressureDia: patientData.diastolicBP,
            respiratoryRate: patientData.respiratoryRate,
            temperature: patientData.temperature,
            oxygenSaturation: patientData.oxygenSaturation,
          },
          labResults: {
            hemoglobin: patientData.hemoglobin,
            wbc: patientData.wbc,
            creatinine: patientData.creatinine,
            sodium: patientData.sodium,
            potassium: patientData.potassium,
            glucose: patientData.glucose,
            bnp: patientData.bnp,
          },
          noShowHistory: patientData.noShowHistory,
          leadTimeDays: patientData.leadTimeDays,
          appointmentDay: patientData.appointmentDay,
        },
      };

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ai/predict-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      setPrediction(data);
    } catch (err) {
      setError('Failed to predict risk. Please check if AI services are running.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskGradient = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'LOW':
        return 'from-green-500 to-emerald-500';
      case 'MODERATE':
        return 'from-yellow-500 to-amber-500';
      case 'HIGH':
        return 'from-orange-500 to-red-500';
      case 'CRITICAL':
        return 'from-red-600 to-rose-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl">
          <ShieldExclamationIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Patient Risk Prediction
          </h2>
          <p className="text-sm text-gray-500">
            ML-powered clinical risk assessment using validated scoring systems
          </p>
        </div>
      </div>

      {/* Prediction Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Prediction Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PREDICTION_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedPrediction(type.id)}
              className={clsx(
                'p-3 rounded-xl border-2 transition-all text-center',
                selectedPrediction === type.id
                  ? `border-${type.color}-500 bg-${type.color}-50`
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <type.icon
                className={clsx(
                  'h-6 w-6 mx-auto mb-1',
                  selectedPrediction === type.id ? `text-${type.color}-600` : 'text-gray-400'
                )}
              />
              <span
                className={clsx(
                  'text-xs font-medium block',
                  selectedPrediction === type.id
                    ? `text-${type.color}-700`
                    : 'text-gray-600'
                )}
              >
                {type.name}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {PREDICTION_TYPES.find((t) => t.id === selectedPrediction)?.description}
        </p>
      </div>

      {/* Demo Patients */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-500">Quick load:</span>
        {DEMO_PATIENTS.map((demo, idx) => (
          <button
            key={idx}
            onClick={() => loadDemoPatient(demo)}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {demo.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Data Form */}
        <div className="space-y-4">
          {/* Demographics */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('demographics')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-blue-500" />
                <span className="font-medium text-gray-900">Demographics</span>
              </div>
              {expandedSections.demographics ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {expandedSections.demographics && (
              <div className="p-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Age</label>
                  <input
                    type="number"
                    value={patientData.age}
                    onChange={(e) =>
                      setPatientData({ ...patientData, age: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Gender</label>
                  <select
                    value={patientData.gender}
                    onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">LOS (days)</label>
                  <input
                    type="number"
                    value={patientData.lengthOfStay}
                    onChange={(e) =>
                      setPatientData({ ...patientData, lengthOfStay: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Admission</label>
                  <select
                    value={patientData.admissionType}
                    onChange={(e) =>
                      setPatientData({ ...patientData, admissionType: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  >
                    <option value="emergency">Emergency</option>
                    <option value="urgent">Urgent</option>
                    <option value="elective">Elective</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ED Visits (6mo)</label>
                  <input
                    type="number"
                    value={patientData.edVisits}
                    onChange={(e) =>
                      setPatientData({ ...patientData, edVisits: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prior Admits</label>
                  <input
                    type="number"
                    value={patientData.priorAdmissions}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        priorAdmissions: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Chronic Conditions</label>
                  <input
                    type="text"
                    value={patientData.chronicConditions}
                    onChange={(e) =>
                      setPatientData({ ...patientData, chronicConditions: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                    placeholder="e.g., diabetes, heart failure, COPD"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Vitals */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('vitals')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <HeartIcon className="h-5 w-5 text-red-500" />
                <span className="font-medium text-gray-900">Vital Signs</span>
              </div>
              {expandedSections.vitals ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {expandedSections.vitals && (
              <div className="p-4 border-t border-gray-200 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">HR (bpm)</label>
                  <input
                    type="number"
                    value={patientData.heartRate}
                    onChange={(e) =>
                      setPatientData({ ...patientData, heartRate: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">SBP (mmHg)</label>
                  <input
                    type="number"
                    value={patientData.systolicBP}
                    onChange={(e) =>
                      setPatientData({ ...patientData, systolicBP: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">RR (/min)</label>
                  <input
                    type="number"
                    value={patientData.respiratoryRate}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        respiratoryRate: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={patientData.temperature}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        temperature: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={patientData.oxygenSaturation}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        oxygenSaturation: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">DBP (mmHg)</label>
                  <input
                    type="number"
                    value={patientData.diastolicBP}
                    onChange={(e) =>
                      setPatientData({ ...patientData, diastolicBP: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Labs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('labs')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <BeakerIcon className="h-5 w-5 text-purple-500" />
                <span className="font-medium text-gray-900">Laboratory Values</span>
              </div>
              {expandedSections.labs ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {expandedSections.labs && (
              <div className="p-4 border-t border-gray-200 grid grid-cols-3 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hgb (g/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={patientData.hemoglobin}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        hemoglobin: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">WBC (K/uL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={patientData.wbc}
                    onChange={(e) =>
                      setPatientData({ ...patientData, wbc: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cr (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={patientData.creatinine}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        creatinine: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Na (mEq/L)</label>
                  <input
                    type="number"
                    value={patientData.sodium}
                    onChange={(e) =>
                      setPatientData({ ...patientData, sodium: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">K (mEq/L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={patientData.potassium}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        potassium: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Glucose</label>
                  <input
                    type="number"
                    value={patientData.glucose}
                    onChange={(e) =>
                      setPatientData({ ...patientData, glucose: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">BNP (pg/mL)</label>
                  <input
                    type="number"
                    value={patientData.bnp}
                    onChange={(e) =>
                      setPatientData({ ...patientData, bnp: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Predict Button */}
          <button
            onClick={handlePredict}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-medium rounded-xl hover:from-red-700 hover:to-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-red-500/25"
          >
            {isLoading ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Analyzing Risk...
              </>
            ) : (
              <>
                <ShieldExclamationIcon className="h-5 w-5" />
                Predict {PREDICTION_TYPES.find((t) => t.id === selectedPrediction)?.name}
              </>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          )}

          {prediction && (
            <>
              {/* Risk Score Card */}
              <div
                className={`bg-gradient-to-br ${getRiskGradient(
                  prediction.riskLevel
                )} rounded-xl p-6 text-white`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/80 text-sm font-medium">Risk Level</p>
                    <p className="text-3xl font-bold">{prediction.riskLevel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/80 text-sm font-medium">Risk Score</p>
                    <p className="text-3xl font-bold">{(prediction.riskScore * 100).toFixed(1)}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/80 rounded-full transition-all duration-500"
                      style={{ width: `${prediction.riskScore * 100}%` }}
                    />
                  </div>
                </div>

                {prediction.confidenceInterval && (
                  <p className="mt-2 text-sm text-white/70">
                    95% CI: {(prediction.confidenceInterval.lower * 100).toFixed(1)}% -{' '}
                    {(prediction.confidenceInterval.upper * 100).toFixed(1)}%
                  </p>
                )}

                {prediction.prediction && (
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-sm text-white/80">Expected Length of Stay</p>
                    <p className="text-2xl font-bold">
                      {prediction.prediction.expectedDays.toFixed(0)} days
                    </p>
                    <p className="text-sm text-white/70">
                      Range: {prediction.prediction.range.lower}-{prediction.prediction.range.upper}{' '}
                      days
                    </p>
                  </div>
                )}
              </div>

              {/* Clinical Scores */}
              {prediction.clinicalScores && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3">
                    Clinical Scoring Systems
                  </h3>
                  <div className="space-y-3">
                    {prediction.clinicalScores.lace && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">
                            LACE Index
                          </span>
                          <span className="text-lg font-bold text-blue-800">
                            {prediction.clinicalScores.lace.score}
                          </span>
                        </div>
                        <p className="text-xs text-blue-600">
                          {prediction.clinicalScores.lace.interpretation} readmission risk
                        </p>
                      </div>
                    )}

                    {prediction.clinicalScores.news2 && (
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-amber-700">
                            NEWS2 Score
                          </span>
                          <span className="text-lg font-bold text-amber-800">
                            {prediction.clinicalScores.news2.score}
                          </span>
                        </div>
                        <p className="text-xs text-amber-600">
                          {prediction.clinicalScores.news2.level} - Clinical deterioration risk
                        </p>
                      </div>
                    )}

                    {prediction.clinicalScores.charlson && (
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-purple-700">
                            Charlson Index
                          </span>
                          <span className="text-lg font-bold text-purple-800">
                            {prediction.clinicalScores.charlson.score}
                          </span>
                        </div>
                        <p className="text-xs text-purple-600">
                          {prediction.clinicalScores.charlson.interpretation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Risk Factors */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900 mb-3">
                  Contributing Risk Factors
                </h3>
                <div className="space-y-2">
                  {prediction.factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <ExclamationTriangleIcon
                        className={`h-5 w-5 flex-shrink-0 ${
                          factor.includes('high')
                            ? 'text-red-500'
                            : factor.includes('moderate')
                            ? 'text-amber-500'
                            : 'text-blue-500'
                        }`}
                      />
                      <span className="text-sm text-gray-700">{factor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900 mb-3">
                  Recommended Interventions
                </h3>
                <div className="space-y-2">
                  {prediction.recommendations
                    .filter((r) => r.trim())
                    .map((rec, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 bg-green-50 rounded-lg"
                      >
                        <div className="w-5 h-5 flex-shrink-0 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </div>
                        <span className="text-sm text-green-800">{rec}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Model Info */}
              <div className="text-center text-xs text-gray-400">
                Model Version: {prediction.modelVersion}
                {prediction.timeframe && ` | Timeframe: ${prediction.timeframe}`}
              </div>
            </>
          )}

          {!prediction && !error && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <ShieldExclamationIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                Enter patient data and click predict to generate risk assessment
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
