import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  HeartIcon,
  FolderIcon,
  SparklesIcon,
  XMarkIcon,
  ArrowPathIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import toast from 'react-hot-toast';
import { AIAnalysis } from './medical-records/types';
import VisitHistoryTab from './medical-records/VisitHistoryTab';
import AllergiesTab from './medical-records/AllergiesTab';
import ImmunizationsTab from './medical-records/ImmunizationsTab';
import PastSurgeriesTab from './medical-records/PastSurgeriesTab';
import HealthProfileTab from './medical-records/HealthProfileTab';

const tabs = [
  { key: 'visits', label: 'Visit History', icon: FolderIcon },
  { key: 'allergies', label: 'Allergies', icon: ExclamationTriangleIcon },
  { key: 'immunizations', label: 'Immunizations', icon: ShieldExclamationIcon },
  { key: 'surgeries', label: 'Past Surgeries', icon: ClipboardDocumentListIcon },
  { key: 'profile', label: 'Health Profile', icon: HeartIcon },
];

export default function MedicalRecords() {
  const [activeTab, setActiveTab] = useState('visits');
  const [showAnalysis, setShowAnalysis] = useState(false);

  // AI Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: () => patientPortalApi.analyzeMedicalHistory(),
    onSuccess: () => {
      setShowAnalysis(true);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate analysis');
    },
  });

  const analysis: AIAnalysis | null = analysisMutation.data?.data?.data || analysisMutation.data?.data || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg">
                <ClipboardDocumentListIcon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Medical Records</h1>
                <p className="text-gray-500 mt-1">View and manage your complete medical history</p>
              </div>
            </div>
            <button
              onClick={() => analysisMutation.mutate()}
              disabled={analysisMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
            >
              {analysisMutation.isPending ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <SparklesIcon className="h-5 w-5" />
              )}
              AI Health Analysis
            </button>
          </div>
        </div>

        {/* AI Analysis Results */}
        {showAnalysis && analysis && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-900">AI Health Analysis</h2>
              </div>
              <button
                onClick={() => setShowAnalysis(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow">
                <p className="text-sm text-gray-500">Health Conditions</p>
                <p className="text-2xl font-bold text-gray-900">{analysis.summary.totalConditions}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow">
                <p className="text-sm text-gray-500">Allergies</p>
                <p className="text-2xl font-bold text-gray-900">{analysis.summary.totalAllergies}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow">
                <p className="text-sm text-gray-500">Risk Level</p>
                <p className={`text-2xl font-bold ${
                  analysis.summary.riskLevel === 'elevated' ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {analysis.summary.riskLevel === 'elevated' ? 'Elevated' : 'Normal'}
                </p>
              </div>
            </div>

            {analysis.recommendations.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <LightBulbIcon className="h-5 w-5 text-yellow-500" />
                  Recommendations
                </h3>
                <div className="space-y-3">
                  {analysis.recommendations.map((rec, idx) => (
                    <div key={idx} className={`bg-white rounded-xl p-4 border-l-4 ${
                      rec.priority === 'high' ? 'border-red-500' :
                      rec.priority === 'medium' ? 'border-yellow-500' : 'border-blue-500'
                    }`}>
                      <h4 className="font-medium text-gray-900">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.preventiveCare.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ShieldExclamationIcon className="h-5 w-5 text-blue-500" />
                  Recommended Preventive Care
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.preventiveCare.map((care, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-4 shadow-sm">
                      <h4 className="font-medium text-gray-900">{care.test}</h4>
                      <p className="text-sm text-blue-600">{care.frequency}</p>
                      <p className="text-xs text-gray-500 mt-1">{care.importance}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Bar */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-2 overflow-x-auto">
          <div className="flex space-x-1 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium leading-5 transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'visits' && <VisitHistoryTab />}
        {activeTab === 'allergies' && <AllergiesTab />}
        {activeTab === 'immunizations' && <ImmunizationsTab />}
        {activeTab === 'surgeries' && <PastSurgeriesTab />}
        {activeTab === 'profile' && <HealthProfileTab />}
      </div>
    </div>
  );
}
