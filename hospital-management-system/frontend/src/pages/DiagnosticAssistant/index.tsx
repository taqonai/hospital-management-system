import { useState } from 'react';
import {
  SparklesIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import DiagnosticAssistant from '../../components/ai/DiagnosticAssistant';

const STATS = [
  { label: 'Analyses Today', value: 47, change: '+12%', positive: true },
  { label: 'Avg Confidence', value: '84%', change: '+3%', positive: true },
  { label: 'Tests Recommended', value: 156, change: '+8%', positive: true },
  { label: 'Diagnoses Confirmed', value: 38, change: '+15%', positive: true },
];

const RECENT_DIAGNOSES = [
  {
    id: 1,
    patientName: 'John Smith',
    mrn: 'MRN-001234',
    symptoms: ['chest pain', 'shortness of breath', 'fatigue'],
    topDiagnosis: 'Acute Coronary Syndrome',
    confidence: 0.82,
    status: 'confirmed',
  },
  {
    id: 2,
    patientName: 'Sarah Johnson',
    mrn: 'MRN-001235',
    symptoms: ['fever', 'cough', 'sore throat'],
    topDiagnosis: 'Upper Respiratory Infection',
    confidence: 0.91,
    status: 'confirmed',
  },
  {
    id: 3,
    patientName: 'Michael Chen',
    mrn: 'MRN-001236',
    symptoms: ['abdominal pain', 'nausea', 'fever'],
    topDiagnosis: 'Acute Appendicitis',
    confidence: 0.76,
    status: 'pending',
  },
];

export default function DiagnosticAssistantPage() {
  const [activeTab, setActiveTab] = useState<'assistant' | 'history' | 'analytics'>('assistant');

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-700 bg-green-100';
    if (confidence >= 0.6) return 'text-amber-700 bg-amber-100';
    return 'text-red-700 bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Diagnostic Assistant</h1>
          <p className="text-gray-600 mt-1">
            ML-powered differential diagnosis and clinical decision support
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">AI Service Active</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{stat.label}</span>
              <span className={`text-xs font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'assistant', label: 'AI Assistant', icon: SparklesIcon },
              { id: 'history', label: 'Recent Analyses', icon: ClipboardDocumentListIcon },
              { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'assistant' && (
            <DiagnosticAssistant className="max-w-4xl mx-auto" />
          )}

          {activeTab === 'history' && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Recent AI Analyses</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Patient</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Symptoms</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Diagnosis</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Confidence</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_DIAGNOSES.map((d) => (
                      <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900">{d.patientName}</p>
                          <p className="text-sm text-gray-500">{d.mrn}</p>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {d.symptoms.map((s) => (
                              <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-medium text-gray-900">{d.topDiagnosis}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded text-sm font-medium ${getConfidenceColor(d.confidence)}`}>
                            {Math.round(d.confidence * 100)}%
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {d.status === 'confirmed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                              <CheckCircleIcon className="h-4 w-4" />
                              Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-sm">
                              <ExclamationTriangleIcon className="h-4 w-4" />
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Diagnosis Categories */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Diagnosis Categories (30 days)</h3>
                <div className="space-y-4">
                  {[
                    { category: 'Respiratory', count: 145, percentage: 32 },
                    { category: 'Cardiovascular', count: 98, percentage: 22 },
                    { category: 'Gastrointestinal', count: 76, percentage: 17 },
                    { category: 'Musculoskeletal', count: 54, percentage: 12 },
                    { category: 'Neurological', count: 43, percentage: 10 },
                  ].map((item) => (
                    <div key={item.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{item.category}</span>
                        <span className="text-gray-500">{item.count} ({item.percentage}%)</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Model Performance */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Model Performance</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Accuracy', value: '84%', color: 'text-blue-600' },
                    { label: 'Sensitivity', value: '92%', color: 'text-green-600' },
                    { label: 'Specificity', value: '88%', color: 'text-purple-600' },
                    { label: 'Avg Response', value: '1.2s', color: 'text-amber-600' },
                  ].map((metric) => (
                    <div key={metric.label} className="bg-white rounded-lg p-4 text-center">
                      <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                      <p className="text-sm text-gray-500">{metric.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-800">DiagnosticAI v2.0</p>
                      <p className="text-sm text-blue-600">Sentence Transformers + Medical KB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Clinical Decision Support Tool</p>
            <p className="text-sm text-amber-700 mt-1">
              This AI assistant supports clinical decision-making but does not replace professional medical judgment.
              All diagnoses should be verified by qualified healthcare providers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
