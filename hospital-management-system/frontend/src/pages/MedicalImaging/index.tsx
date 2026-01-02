import { useState } from 'react';
import {
  PhotoIcon,
  SparklesIcon,
  DocumentMagnifyingGlassIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ArrowPathIcon,
  FolderOpenIcon,
} from '@heroicons/react/24/outline';
import MedicalImagingAI from '../../components/ai/MedicalImagingAI';

interface RecentStudy {
  id: string;
  patientName: string;
  patientId: string;
  modality: string;
  bodyPart: string;
  studyDate: string;
  status: 'pending' | 'analyzed' | 'urgent';
  urgency?: string;
  impression?: string;
}

const recentStudies: RecentStudy[] = [
  {
    id: 'STD001',
    patientName: 'John Smith',
    patientId: 'P-2024-001',
    modality: 'X-Ray',
    bodyPart: 'Chest',
    studyDate: '2024-01-15 09:30',
    status: 'urgent',
    urgency: 'URGENT',
    impression: 'Consolidation in right lower lobe concerning for pneumonia',
  },
  {
    id: 'STD002',
    patientName: 'Sarah Johnson',
    patientId: 'P-2024-042',
    modality: 'CT',
    bodyPart: 'Abdomen',
    studyDate: '2024-01-15 10:15',
    status: 'analyzed',
    urgency: 'ROUTINE',
    impression: 'No acute abdominal pathology identified',
  },
  {
    id: 'STD003',
    patientName: 'Michael Brown',
    patientId: 'P-2024-078',
    modality: 'MRI',
    bodyPart: 'Brain',
    studyDate: '2024-01-15 11:00',
    status: 'analyzed',
    urgency: 'SEMI-URGENT',
    impression: 'Small focus of signal abnormality in right frontal lobe, recommend follow-up',
  },
  {
    id: 'STD004',
    patientName: 'Emily Davis',
    patientId: 'P-2024-103',
    modality: 'Ultrasound',
    bodyPart: 'Abdomen',
    studyDate: '2024-01-15 14:20',
    status: 'pending',
  },
  {
    id: 'STD005',
    patientName: 'Robert Wilson',
    patientId: 'P-2024-156',
    modality: 'X-Ray',
    bodyPart: 'Spine',
    studyDate: '2024-01-15 15:45',
    status: 'pending',
  },
];

const statsCards = [
  {
    name: 'Studies Today',
    value: '47',
    change: '+12%',
    icon: PhotoIcon,
    color: 'blue',
  },
  {
    name: 'AI Analyzed',
    value: '42',
    change: '89%',
    icon: SparklesIcon,
    color: 'purple',
  },
  {
    name: 'Pending Review',
    value: '5',
    change: '-3',
    icon: ClockIcon,
    color: 'amber',
  },
  {
    name: 'Urgent Findings',
    value: '3',
    change: '+1',
    icon: ExclamationTriangleIcon,
    color: 'red',
  },
];

export default function MedicalImaging() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'worklist' | 'history'>('analyze');
  const [selectedStudy, setSelectedStudy] = useState<RecentStudy | null>(null);

  const getStatusBadge = (status: string, urgency?: string) => {
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          <ClockIcon className="h-3 w-3" />
          Pending
        </span>
      );
    }
    if (urgency === 'URGENT' || urgency === 'STAT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <ExclamationTriangleIcon className="h-3 w-3" />
          {urgency}
        </span>
      );
    }
    if (urgency === 'SEMI-URGENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <ExclamationTriangleIcon className="h-3 w-3" />
          Semi-Urgent
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircleIcon className="h-3 w-3" />
        Routine
      </span>
    );
  };

  const getModalityColor = (modality: string) => {
    const colors: Record<string, string> = {
      'X-Ray': 'bg-blue-100 text-blue-700',
      'CT': 'bg-purple-100 text-purple-700',
      'MRI': 'bg-indigo-100 text-indigo-700',
      'Ultrasound': 'bg-cyan-100 text-cyan-700',
    };
    return colors[modality] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
              <PhotoIcon className="h-6 w-6" />
            </div>
            Medical Imaging AI
          </h1>
          <p className="mt-1 text-gray-500">
            CNN-powered diagnostic imaging analysis with automated findings detection
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
            <ArrowPathIcon className="h-4 w-4" />
            Sync PACS
          </button>
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 transition-colors shadow-lg shadow-violet-500/30 flex items-center gap-2">
            <FolderOpenIcon className="h-4 w-4" />
            Import DICOM
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <div
            key={stat.name}
            className="p-4 rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  stat.color === 'blue'
                    ? 'bg-blue-100 text-blue-600'
                    : stat.color === 'purple'
                    ? 'bg-purple-100 text-purple-600'
                    : stat.color === 'amber'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-2">
              <span
                className={`text-sm font-medium ${
                  stat.change.startsWith('+') && stat.color !== 'red'
                    ? 'text-green-600'
                    : stat.change.startsWith('-')
                    ? 'text-green-600'
                    : stat.color === 'red' && stat.change.startsWith('+')
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}
              >
                {stat.change}
              </span>
              <span className="text-sm text-gray-400 ml-1">vs yesterday</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'analyze', name: 'Analyze Image', icon: SparklesIcon },
            { id: 'worklist', name: 'Worklist', icon: ClockIcon },
            { id: 'history', name: 'Analysis History', icon: ChartBarIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'analyze' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* AI Analysis Panel - Takes 2 columns */}
          <div className="xl:col-span-2">
            <MedicalImagingAI />
          </div>

          {/* Recent Studies - Takes 1 column */}
          <div className="rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DocumentMagnifyingGlassIcon className="h-5 w-5 text-violet-500" />
                Recent Studies
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Click to load for analysis
              </p>
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {recentStudies.map((study) => (
                <button
                  key={study.id}
                  onClick={() => setSelectedStudy(study)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedStudy?.id === study.id ? 'bg-violet-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {study.patientName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {study.patientId}
                      </p>
                    </div>
                    {getStatusBadge(study.status, study.urgency)}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getModalityColor(
                        study.modality
                      )}`}
                    >
                      {study.modality}
                    </span>
                    <span className="text-xs text-gray-500">
                      {study.bodyPart}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{study.studyDate}</p>
                  {study.impression && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                      {study.impression}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'worklist' && (
        <div className="rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Study
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentStudies
                  .filter((s) => s.status === 'pending')
                  .map((study) => (
                    <tr key={study.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {study.patientName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {study.patientId}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getModalityColor(
                              study.modality
                            )}`}
                          >
                            {study.modality}
                          </span>
                          <span className="text-sm text-gray-600">
                            {study.bodyPart}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {study.studyDate}
                      </td>
                      <td className="px-4 py-4">{getStatusBadge(study.status)}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => {
                            setSelectedStudy(study);
                            setActiveTab('analyze');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-sm font-medium hover:bg-violet-200 transition-colors flex items-center gap-1"
                        >
                          <SparklesIcon className="h-4 w-4" />
                          Analyze
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {recentStudies.filter((s) => s.status === 'pending').length === 0 && (
            <div className="p-8 text-center">
              <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">All studies have been analyzed</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Study
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Urgency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Impression
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentStudies
                  .filter((s) => s.status === 'analyzed' || s.status === 'urgent')
                  .map((study) => (
                    <tr key={study.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {study.patientName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {study.patientId}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getModalityColor(
                              study.modality
                            )}`}
                          >
                            {study.modality}
                          </span>
                          <span className="text-sm text-gray-600">
                            {study.bodyPart}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {study.studyDate}
                      </td>
                      <td className="px-4 py-4">{getStatusBadge(study.status, study.urgency)}</td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-600 max-w-md truncate">
                          {study.impression}
                        </p>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Capabilities Info */}
      <div className="rounded-2xl backdrop-blur-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-violet-500" />
          AI Imaging Analysis Capabilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/50">
            <h4 className="font-medium text-blue-700 mb-2">X-Ray Analysis</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Pneumonia detection</li>
              <li>Cardiomegaly assessment</li>
              <li>Fracture identification</li>
              <li>Nodule screening</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-white/50">
            <h4 className="font-medium text-purple-700 mb-2">CT Analysis</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Stroke detection</li>
              <li>Tumor identification</li>
              <li>Pulmonary embolism</li>
              <li>Hemorrhage detection</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-white/50">
            <h4 className="font-medium text-indigo-700 mb-2">MRI Analysis</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Brain lesion detection</li>
              <li>Spine pathology</li>
              <li>Soft tissue masses</li>
              <li>Demyelination detection</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-white/50">
            <h4 className="font-medium text-cyan-700 mb-2">Ultrasound Analysis</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Gallstone detection</li>
              <li>Liver assessment</li>
              <li>Thyroid nodules</li>
              <li>Cardiac function</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
