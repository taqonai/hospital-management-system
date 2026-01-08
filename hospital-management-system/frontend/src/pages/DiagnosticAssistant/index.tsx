import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  SparklesIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import DiagnosticAssistant from '../../components/ai/DiagnosticAssistant';
import { appointmentApi } from '../../services/api';

export default function DiagnosticAssistantPage() {
  const [activeTab, setActiveTab] = useState<'assistant' | 'history' | 'analytics'>('assistant');

  // Fetch today's appointments for stats
  const { data: statsData } = useQuery({
    queryKey: ['diagnostic-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await appointmentApi.getAll({ date: today, limit: 100 });
      const appointments = response.data?.data || [];
      const completed = appointments.filter((a: any) => a.status === 'COMPLETED').length;
      return {
        todayConsultations: appointments.length,
        completedToday: completed,
      };
    },
  });

  const stats = [
    { label: 'Today\'s Consultations', value: statsData?.todayConsultations || 0 },
    { label: 'Completed Today', value: statsData?.completedToday || 0 },
  ];

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
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <span className="text-sm text-gray-500">{stat.label}</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
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
            <div className="text-center py-12">
              <DocumentMagnifyingGlassIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Recent Analyses</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Run a diagnosis using the AI Assistant tab to see your analysis history here.
                Diagnosis history is available within each patient's consultation record.
              </p>
              <button
                onClick={() => setActiveTab('assistant')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start New Analysis
              </button>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="text-center py-12">
              <ChartBarIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Analytics Coming Soon</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Diagnostic analytics and model performance metrics will be available here
                as the system collects more diagnosis data.
              </p>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg max-w-md mx-auto">
                <div className="flex items-center gap-2 justify-center">
                  <SparklesIcon className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-blue-800">DiagnosticAI v2.0</p>
                    <p className="text-sm text-blue-600">Sentence Transformers + Medical KB</p>
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
