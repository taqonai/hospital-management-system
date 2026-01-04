import { useState, useEffect } from 'react';
import {
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import PatientRiskPrediction from '../../components/ai/PatientRiskPrediction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const RISK_MODELS = [
  {
    name: 'LACE Index',
    description: 'Length of stay, Acuity, Comorbidity, ED visits',
    usage: '30-day readmission prediction',
    validated: true,
  },
  {
    name: 'NEWS2',
    description: 'National Early Warning Score',
    usage: 'Clinical deterioration detection',
    validated: true,
  },
  {
    name: 'Charlson Index',
    description: 'Comorbidity burden scoring',
    usage: 'Mortality risk estimation',
    validated: true,
  },
  {
    name: 'ML Ensemble',
    description: 'Gradient Boosting + Clinical Scores',
    usage: 'Enhanced risk prediction',
    validated: false,
  },
];

const STATS = [
  { name: 'Patients Analyzed', value: '2,847', change: '+12%', icon: UserGroupIcon },
  { name: 'High Risk Identified', value: '342', change: '+8%', icon: ExclamationTriangleIcon },
  { name: 'Readmissions Prevented', value: '89', change: '+23%', icon: CheckCircleIcon },
  { name: 'Model Accuracy', value: '94.2%', change: '+1.2%', icon: ChartBarIcon },
];

export default function PatientRisk() {
  const [activeTab, setActiveTab] = useState<'predictor' | 'dashboard' | 'models'>('predictor');
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    checkServiceStatus();
  }, []);

  const checkServiceStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ai/health`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        const isOnline = data.services?.predictive === 'active' ||
                        data.services?.predictive === true ||
                        data.status === 'connected';
        setServiceStatus(isOnline ? 'online' : 'offline');
      } else {
        setServiceStatus('offline');
      }
    } catch {
      setServiceStatus('offline');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Risk Prediction</h1>
          <p className="text-gray-600 mt-1">
            ML-powered clinical risk assessment with validated scoring systems
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
          serviceStatus === 'online'
            ? 'bg-green-50 text-green-700'
            : serviceStatus === 'offline'
            ? 'bg-red-50 text-red-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {serviceStatus === 'online' ? (
            <>
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              AI Service Active
            </>
          ) : serviceStatus === 'offline' ? (
            <>
              <ExclamationTriangleIcon className="h-4 w-4" />
              Service Offline
            </>
          ) : (
            <>
              <div className="h-4 w-4 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
              Checking...
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className="h-5 w-5 text-blue-600" />
              <span className="text-xs font-medium text-green-600">{stat.change}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.name}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'predictor', label: 'Risk Predictor', icon: ShieldExclamationIcon },
              { id: 'dashboard', label: 'Population Dashboard', icon: ChartBarIcon },
              { id: 'models', label: 'Scoring Models', icon: UserGroupIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'predictor' && (
            <PatientRiskPrediction />
          )}

          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk Distribution */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Population Risk Distribution</h3>
                <div className="space-y-4">
                  {[
                    { level: 'Low Risk', count: 1847, percent: 65, color: 'bg-green-500' },
                    { level: 'Moderate Risk', count: 658, percent: 23, color: 'bg-amber-500' },
                    { level: 'High Risk', count: 342, percent: 12, color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.level}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{item.level}</span>
                        <span className="text-gray-500">{item.count} ({item.percent}%)</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* High Risk Patients */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">High Risk Patients</h3>
                <div className="space-y-3">
                  {[
                    { name: 'John Smith', mrn: 'MRN-001', risk: 0.92, type: 'Readmission' },
                    { name: 'Mary Johnson', mrn: 'MRN-002', risk: 0.88, type: 'Deterioration' },
                    { name: 'Robert Davis', mrn: 'MRN-003', risk: 0.85, type: 'Readmission' },
                  ].map((patient) => (
                    <div key={patient.mrn} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">{patient.name}</p>
                        <p className="text-sm text-gray-500">{patient.mrn} - {patient.type}</p>
                      </div>
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                        {Math.round(patient.risk * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RISK_MODELS.map((model) => (
                <div key={model.name} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{model.name}</h4>
                    {model.validated ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                        Validated
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                        Experimental
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{model.description}</p>
                  <p className="text-xs text-gray-500">Use: {model.usage}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Clinical Decision Support</p>
            <p className="text-sm text-amber-700 mt-1">
              Risk predictions are for clinical decision support only. Always use clinical judgment
              when making patient care decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
