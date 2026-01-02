import { useState } from 'react';
import {
  ChartBarIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ShieldCheckIcon,
  UsersIcon,
  DocumentChartBarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import PredictiveRiskAnalytics from '../../components/ai/PredictiveRiskAnalytics';
import clsx from 'clsx';

// Demo patient data for testing
const DEMO_PATIENTS = [
  {
    id: '1',
    name: 'John Martinez',
    age: 72,
    gender: 'male',
    mrn: 'MRN-001234',
    admissionType: 'emergency',
    lengthOfStay: 5,
    edVisits: 3,
    medicalHistory: {
      chronicConditions: ['Hypertension', 'Type 2 Diabetes', 'Heart Failure', 'COPD'],
    },
    medications: ['Metformin', 'Lisinopril', 'Furosemide', 'Aspirin', 'Metoprolol', 'Atorvastatin'],
    vitals: {
      heartRate: 98,
      bloodPressureSys: 148,
      bloodPressureDia: 92,
      respiratoryRate: 22,
      temperature: 37.2,
      oxygenSaturation: 93,
    },
    labResults: {
      hemoglobin: 10.5,
      creatinine: 1.8,
      sodium: 132,
      potassium: 4.2,
      bnp: 450,
    },
    admissionHistory: [
      { date: '2024-10-15', reason: 'Heart Failure Exacerbation' },
      { date: '2024-08-20', reason: 'COPD Exacerbation' },
    ],
    riskSummary: { readmission: 'HIGH', mortality: 'MODERATE', deterioration: 'MODERATE' },
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    age: 45,
    gender: 'female',
    mrn: 'MRN-002345',
    admissionType: 'elective',
    lengthOfStay: 2,
    edVisits: 0,
    medicalHistory: {
      chronicConditions: ['Hypertension'],
    },
    medications: ['Amlodipine'],
    vitals: {
      heartRate: 72,
      bloodPressureSys: 128,
      bloodPressureDia: 82,
      respiratoryRate: 16,
      temperature: 36.8,
      oxygenSaturation: 98,
    },
    labResults: {
      hemoglobin: 13.2,
      creatinine: 0.9,
      sodium: 140,
      potassium: 4.0,
    },
    riskSummary: { readmission: 'LOW', mortality: 'LOW', deterioration: 'LOW' },
  },
  {
    id: '3',
    name: 'Robert Chen',
    age: 65,
    gender: 'male',
    mrn: 'MRN-003456',
    admissionType: 'urgent',
    lengthOfStay: 7,
    edVisits: 2,
    medicalHistory: {
      chronicConditions: ['Type 2 Diabetes', 'Chronic Kidney Disease', 'Coronary Artery Disease'],
    },
    medications: ['Insulin', 'Metoprolol', 'Aspirin', 'Clopidogrel'],
    vitals: {
      heartRate: 88,
      bloodPressureSys: 135,
      bloodPressureDia: 88,
      respiratoryRate: 18,
      temperature: 37.5,
      oxygenSaturation: 95,
    },
    labResults: {
      hemoglobin: 11.0,
      creatinine: 2.2,
      sodium: 136,
      potassium: 5.1,
      glucose: 220,
    },
    admissionHistory: [{ date: '2024-09-10', reason: 'Chest Pain' }],
    riskSummary: { readmission: 'HIGH', mortality: 'MODERATE', deterioration: 'MODERATE' },
  },
  {
    id: '4',
    name: 'Maria Garcia',
    age: 58,
    gender: 'female',
    mrn: 'MRN-004567',
    admissionType: 'emergency',
    lengthOfStay: 3,
    edVisits: 1,
    medicalHistory: {
      chronicConditions: ['Asthma', 'Obesity'],
    },
    medications: ['Albuterol', 'Fluticasone'],
    vitals: {
      heartRate: 92,
      bloodPressureSys: 142,
      bloodPressureDia: 90,
      respiratoryRate: 24,
      temperature: 38.1,
      oxygenSaturation: 91,
    },
    labResults: {
      hemoglobin: 12.5,
      creatinine: 1.0,
      wbc: 12.5,
    },
    riskSummary: { readmission: 'MODERATE', mortality: 'LOW', deterioration: 'HIGH' },
  },
  {
    id: '5',
    name: 'James Wilson',
    age: 82,
    gender: 'male',
    mrn: 'MRN-005678',
    admissionType: 'emergency',
    lengthOfStay: 10,
    edVisits: 4,
    medicalHistory: {
      chronicConditions: [
        'Heart Failure',
        'Atrial Fibrillation',
        'Chronic Kidney Disease',
        'Dementia',
        'Type 2 Diabetes',
      ],
    },
    medications: [
      'Warfarin',
      'Digoxin',
      'Furosemide',
      'Lisinopril',
      'Metformin',
      'Amlodipine',
      'Metoprolol',
      'Donepezil',
    ],
    vitals: {
      heartRate: 105,
      bloodPressureSys: 95,
      bloodPressureDia: 60,
      respiratoryRate: 26,
      temperature: 37.8,
      oxygenSaturation: 89,
    },
    labResults: {
      hemoglobin: 9.2,
      creatinine: 3.1,
      sodium: 128,
      potassium: 5.8,
      bnp: 1200,
    },
    admissionHistory: [
      { date: '2024-11-01', reason: 'Acute on Chronic Heart Failure' },
      { date: '2024-09-15', reason: 'Fall' },
      { date: '2024-07-20', reason: 'Pneumonia' },
    ],
    riskSummary: { readmission: 'CRITICAL', mortality: 'HIGH', deterioration: 'CRITICAL' },
  },
];

const RISK_LEVEL_COLORS = {
  LOW: 'text-emerald-600 bg-emerald-100',
  MODERATE: 'text-amber-600 bg-amber-100',
  HIGH: 'text-orange-600 bg-orange-100',
  CRITICAL: 'text-red-600 bg-red-100',
};

export default function RiskAnalytics() {
  const [selectedPatient, setSelectedPatient] = useState<(typeof DEMO_PATIENTS)[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [view, setView] = useState<'list' | 'dashboard'>('list');

  // Filter patients
  const filteredPatients = DEMO_PATIENTS.filter(patient => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.mrn.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRisk =
      filterRisk === 'all' ||
      Object.values(patient.riskSummary).some(
        risk => risk.toLowerCase() === filterRisk.toLowerCase()
      );

    return matchesSearch && matchesRisk;
  });

  // Calculate summary stats
  const riskStats = {
    critical: DEMO_PATIENTS.filter(p =>
      Object.values(p.riskSummary).includes('CRITICAL')
    ).length,
    high: DEMO_PATIENTS.filter(
      p =>
        Object.values(p.riskSummary).includes('HIGH') &&
        !Object.values(p.riskSummary).includes('CRITICAL')
    ).length,
    moderate: DEMO_PATIENTS.filter(
      p =>
        Object.values(p.riskSummary).includes('MODERATE') &&
        !Object.values(p.riskSummary).includes('HIGH') &&
        !Object.values(p.riskSummary).includes('CRITICAL')
    ).length,
    low: DEMO_PATIENTS.filter(p =>
      Object.values(p.riskSummary).every(risk => risk === 'LOW')
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
              <ChartBarIcon className="h-6 w-6" />
            </div>
            Predictive Risk Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            ML-powered patient risk stratification using validated clinical scoring systems
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('list')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              view === 'list'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <UsersIcon className="h-4 w-4 inline mr-2" />
            Patient List
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              view === 'dashboard'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <DocumentChartBarIcon className="h-4 w-4 inline mr-2" />
            Analysis
          </button>
        </div>
      </div>

      {/* Risk Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={clsx(
            'rounded-xl p-4 backdrop-blur-xl border cursor-pointer transition-all hover:scale-105',
            filterRisk === 'critical'
              ? 'bg-red-100 border-red-500'
              : 'bg-white border-gray-200'
          )}
          onClick={() => setFilterRisk(filterRisk === 'critical' ? 'all' : 'critical')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Critical Risk</p>
              <p className="text-3xl font-bold text-red-700">{riskStats.critical}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
            </div>
          </div>
          <p className="text-xs text-red-500/70 mt-2">Requires immediate attention</p>
        </div>

        <div
          className={clsx(
            'rounded-xl p-4 backdrop-blur-xl border cursor-pointer transition-all hover:scale-105',
            filterRisk === 'high'
              ? 'bg-orange-100 border-orange-500'
              : 'bg-white border-gray-200'
          )}
          onClick={() => setFilterRisk(filterRisk === 'high' ? 'all' : 'high')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">High Risk</p>
              <p className="text-3xl font-bold text-orange-700">{riskStats.high}</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-100">
              <ArrowTrendingUpIcon className="h-6 w-6 text-orange-500" />
            </div>
          </div>
          <p className="text-xs text-orange-500/70 mt-2">Close monitoring needed</p>
        </div>

        <div
          className={clsx(
            'rounded-xl p-4 backdrop-blur-xl border cursor-pointer transition-all hover:scale-105',
            filterRisk === 'moderate'
              ? 'bg-amber-100 border-amber-500'
              : 'bg-white border-gray-200'
          )}
          onClick={() => setFilterRisk(filterRisk === 'moderate' ? 'all' : 'moderate')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 font-medium">Moderate Risk</p>
              <p className="text-3xl font-bold text-amber-700">{riskStats.moderate}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100">
              <ClockIcon className="h-6 w-6 text-amber-500" />
            </div>
          </div>
          <p className="text-xs text-amber-500/70 mt-2">Enhanced surveillance</p>
        </div>

        <div
          className={clsx(
            'rounded-xl p-4 backdrop-blur-xl border cursor-pointer transition-all hover:scale-105',
            filterRisk === 'low'
              ? 'bg-emerald-100 border-emerald-500'
              : 'bg-white border-gray-200'
          )}
          onClick={() => setFilterRisk(filterRisk === 'low' ? 'all' : 'low')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 font-medium">Low Risk</p>
              <p className="text-3xl font-bold text-emerald-700">{riskStats.low}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100">
              <ShieldCheckIcon className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
          <p className="text-xs text-emerald-500/70 mt-2">Standard care pathway</p>
        </div>
      </div>

      {view === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Search & Filter */}
            <div className="rounded-xl p-4 backdrop-blur-xl bg-white border border-gray-200">
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-4 w-4 text-gray-400" />
                <select
                  value={filterRisk}
                  onChange={e => setFilterRisk(e.target.value)}
                  className="flex-1 text-sm rounded-lg bg-gray-50 border border-gray-200 py-1.5 px-2"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Patient Cards */}
            <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
              {filteredPatients.map(patient => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={clsx(
                    'rounded-xl p-4 cursor-pointer transition-all border',
                    selectedPatient?.id === patient.id
                      ? 'bg-purple-50 border-purple-500'
                      : 'backdrop-blur-xl bg-white border-gray-200 hover:border-purple-300'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                        {patient.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {patient.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {patient.mrn} | {patient.age}y {patient.gender}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        RISK_LEVEL_COLORS[patient.riskSummary.readmission as keyof typeof RISK_LEVEL_COLORS]
                      )}
                    >
                      Readmit: {patient.riskSummary.readmission}
                    </span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        RISK_LEVEL_COLORS[patient.riskSummary.deterioration as keyof typeof RISK_LEVEL_COLORS]
                      )}
                    >
                      Deter: {patient.riskSummary.deterioration}
                    </span>
                  </div>

                  {patient.medicalHistory.chronicConditions && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 truncate">
                        {patient.medicalHistory.chronicConditions.slice(0, 3).join(', ')}
                        {patient.medicalHistory.chronicConditions.length > 3 && '...'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Risk Analysis Panel */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
              <PredictiveRiskAnalytics
                patient={selectedPatient}
                predictionTypes={[
                  'READMISSION',
                  'MORTALITY',
                  'DETERIORATION',
                  'LENGTH_OF_STAY',
                  'NO_SHOW',
                  'DISEASE_PROGRESSION',
                ]}
              />
            ) : (
              <div className="rounded-xl p-12 backdrop-blur-xl bg-white border border-gray-200 flex flex-col items-center justify-center">
                <UserIcon className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600">
                  Select a Patient
                </h3>
                <p className="text-sm text-gray-500 mt-1 text-center max-w-md">
                  Choose a patient from the list to view comprehensive risk analysis using
                  ML-powered predictive models and validated clinical scoring systems.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Dashboard View */
        <div className="space-y-6">
          {/* High Risk Patient Summary */}
          <div className="rounded-xl p-6 backdrop-blur-xl bg-white border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              High Risk Patients Requiring Attention
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 font-medium">Patient</th>
                    <th className="pb-3 font-medium">Readmission</th>
                    <th className="pb-3 font-medium">Mortality</th>
                    <th className="pb-3 font-medium">Deterioration</th>
                    <th className="pb-3 font-medium">Key Factors</th>
                    <th className="pb-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {DEMO_PATIENTS.filter(
                    p =>
                      Object.values(p.riskSummary).includes('HIGH') ||
                      Object.values(p.riskSummary).includes('CRITICAL')
                  ).map(patient => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold">
                            {patient.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {patient.name}
                            </p>
                            <p className="text-xs text-gray-500">{patient.mrn}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            RISK_LEVEL_COLORS[patient.riskSummary.readmission as keyof typeof RISK_LEVEL_COLORS]
                          )}
                        >
                          {patient.riskSummary.readmission}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            RISK_LEVEL_COLORS[patient.riskSummary.mortality as keyof typeof RISK_LEVEL_COLORS]
                          )}
                        >
                          {patient.riskSummary.mortality}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            RISK_LEVEL_COLORS[patient.riskSummary.deterioration as keyof typeof RISK_LEVEL_COLORS]
                          )}
                        >
                          {patient.riskSummary.deterioration}
                        </span>
                      </td>
                      <td className="py-3">
                        <p className="text-xs text-gray-600 max-w-xs truncate">
                          {patient.medicalHistory.chronicConditions?.slice(0, 2).join(', ')}
                        </p>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => {
                            setSelectedPatient(patient);
                            setView('list');
                          }}
                          className="text-xs text-purple-600 hover:underline font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk Distribution & Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk by Category */}
            <div className="rounded-xl p-6 backdrop-blur-xl bg-white border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Risk Distribution by Category
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Readmission Risk', icon: ArrowTrendingUpIcon, color: 'blue' },
                  { label: 'Mortality Risk', icon: HeartIcon, color: 'red' },
                  { label: 'Deterioration Risk', icon: ExclamationTriangleIcon, color: 'orange' },
                ].map(category => {
                  const criticalCount = DEMO_PATIENTS.filter(
                    p => p.riskSummary[category.label.split(' ')[0].toLowerCase() as keyof typeof p.riskSummary] === 'CRITICAL'
                  ).length;
                  const highCount = DEMO_PATIENTS.filter(
                    p => p.riskSummary[category.label.split(' ')[0].toLowerCase() as keyof typeof p.riskSummary] === 'HIGH'
                  ).length;
                  const total = DEMO_PATIENTS.length;

                  return (
                    <div key={category.label}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <category.icon className={`h-4 w-4 text-${category.color}-500`} />
                          <span className="text-sm font-medium text-gray-700">
                            {category.label}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {criticalCount + highCount} at-risk / {total}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                        <div
                          className="bg-red-500 h-full"
                          style={{ width: `${(criticalCount / total) * 100}%` }}
                        />
                        <div
                          className="bg-orange-500 h-full"
                          style={{ width: `${(highCount / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Common Risk Factors */}
            <div className="rounded-xl p-6 backdrop-blur-xl bg-white border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Most Common Risk Factors
              </h3>
              <div className="space-y-3">
                {[
                  { factor: 'Multiple Comorbidities', count: 4, percentage: 80 },
                  { factor: 'Age > 65', count: 3, percentage: 60 },
                  { factor: 'Recent ED Visits', count: 3, percentage: 60 },
                  { factor: 'Polypharmacy', count: 2, percentage: 40 },
                  { factor: 'Abnormal Vitals', count: 2, percentage: 40 },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">
                          {item.factor}
                        </span>
                        <span className="text-xs text-gray-500">{item.count} patients</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-500 h-full rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scoring Systems Info */}
          <div className="rounded-xl p-6 backdrop-blur-xl bg-white border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Clinical Scoring Systems Used
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <h4 className="font-semibold text-blue-800">LACE Index</h4>
                <p className="text-sm text-blue-600 mt-1">
                  Length of stay, Acuity, Comorbidities, ED visits - validated for 30-day
                  readmission prediction
                </p>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                <h4 className="font-semibold text-orange-800">NEWS2</h4>
                <p className="text-sm text-orange-600 mt-1">
                  National Early Warning Score 2 - standardized assessment of clinical
                  deterioration risk
                </p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                <h4 className="font-semibold text-purple-800">Charlson Index</h4>
                <p className="text-sm text-purple-600 mt-1">
                  Comorbidity index predicting 10-year mortality based on chronic conditions
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
