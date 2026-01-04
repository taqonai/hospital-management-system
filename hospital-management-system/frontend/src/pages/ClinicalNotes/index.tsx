import { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  SparklesIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  BeakerIcon,
  MicrophoneIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import ClinicalNotesAI from '../../components/ai/ClinicalNotesAI';

interface NoteTemplate {
  name: string;
  description: string;
  requiredFields: string[];
}

interface TemplatesResponse {
  templates: Record<string, NoteTemplate>;
  modelVersion: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const FEATURES = [
  {
    icon: SparklesIcon,
    title: 'AI Note Generation',
    description: 'Generate comprehensive clinical notes from structured data',
    color: 'blue',
  },
  {
    icon: ArrowPathIcon,
    title: 'Note Enhancement',
    description: 'Improve clarity, expand details, or restructure existing notes',
    color: 'purple',
  },
  {
    icon: BeakerIcon,
    title: 'Entity Extraction',
    description: 'Extract diagnoses, medications, procedures from text',
    color: 'teal',
  },
  {
    icon: MicrophoneIcon,
    title: 'Voice to Note',
    description: 'Convert voice dictation to structured clinical notes',
    color: 'indigo',
  },
];

const RECENT_NOTES = [
  {
    id: 1,
    type: 'SOAP Note',
    patient: 'John D.',
    date: '2024-01-15',
    status: 'completed',
  },
  {
    id: 2,
    type: 'Discharge Summary',
    patient: 'Mary S.',
    date: '2024-01-15',
    status: 'draft',
  },
  {
    id: 3,
    type: 'Progress Note',
    patient: 'Robert K.',
    date: '2024-01-14',
    status: 'completed',
  },
  {
    id: 4,
    type: 'Procedure Note',
    patient: 'Sarah L.',
    date: '2024-01-14',
    status: 'completed',
  },
];

export default function ClinicalNotes() {
  const [activeTab, setActiveTab] = useState<'ai' | 'templates' | 'recent'>('ai');
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    checkServiceStatus();
    fetchTemplates();
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
        const isOnline = data.services?.clinical_notes === 'active' ||
                        data.services?.clinical_notes === true ||
                        data.status === 'connected';
        setServiceStatus(isOnline ? 'online' : 'offline');
      } else {
        setServiceStatus('offline');
      }
    } catch {
      setServiceStatus('offline');
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ai/clinical-notes/templates`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        setTemplates(data);
      }
    } catch {
      // Templates will show as unavailable
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Clinical Notes AI
          </h1>
          <p className="text-gray-500 mt-1">
            AI-powered clinical documentation assistant
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Service Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              serviceStatus === 'online'
                ? 'bg-green-100 text-green-700'
                : serviceStatus === 'offline'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {serviceStatus === 'online' ? (
              <CheckCircleIcon className="h-4 w-4" />
            ) : serviceStatus === 'offline' ? (
              <ExclamationCircleIcon className="h-4 w-4" />
            ) : (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            )}
            {serviceStatus === 'online'
              ? 'AI Service Online'
              : serviceStatus === 'offline'
              ? 'AI Service Offline'
              : 'Checking...'}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">6</p>
              <p className="text-sm text-gray-500">Note Templates</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <SparklesIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">156</p>
              <p className="text-sm text-gray-500">AI Generated</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ClockIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">3.2m</p>
              <p className="text-sm text-gray-500">Avg. Time Saved</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ChartBarIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">98%</p>
              <p className="text-sm text-gray-500">Accuracy Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'ai'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              AI Notes Assistant
            </div>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'templates'
                ? 'bg-purple-50 text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <DocumentDuplicateIcon className="h-5 w-5" />
              Templates
            </div>
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'recent'
                ? 'bg-green-50 text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Recent Notes
            </div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'ai' && <ClinicalNotesAI />}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Available Note Templates
                </h3>
                {templates && (
                  <span className="text-sm text-gray-500">
                    Version: {templates.modelVersion}
                  </span>
                )}
              </div>

              {templates ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(templates.templates).map(([key, template]) => (
                    <div
                      key={key}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <DocumentTextIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {template.name}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            {template.description}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1">
                            {template.requiredFields.slice(0, 3).map((field) => (
                              <span
                                key={field}
                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                              >
                                {field}
                              </span>
                            ))}
                            {template.requiredFields.length > 3 && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                +{template.requiredFields.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Unable to load templates</p>
                  <p className="text-sm">Please check if AI services are running</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'recent' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Recent Notes
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Patient
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Status
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_NOTES.map((note) => (
                      <tr
                        key={note.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {note.type}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {note.patient}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {note.date}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              note.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {note.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Features Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((feature, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`p-2 bg-${feature.color}-100 rounded-lg w-fit mb-3`}>
              <feature.icon className={`h-5 w-5 text-${feature.color}-600`} />
            </div>
            <h3 className="font-medium text-gray-900">{feature.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
