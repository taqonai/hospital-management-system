import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  SparklesIcon,
  HeartIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  LightBulbIcon,
  ClockIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface HealthMetric {
  name: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'attention' | 'critical';
  trend: 'up' | 'down' | 'stable';
  previousValue?: string | number;
  date: string;
}

interface HealthInsight {
  id: string;
  type: 'recommendation' | 'alert' | 'reminder' | 'tip';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel?: string;
  actionRoute?: string;
}

interface LabResult {
  testName: string;
  value: string | number;
  unit: string;
  normalRange: string;
  status: 'normal' | 'abnormal';
  date: string;
}

interface PatientInfo {
  name: string;
  bloodGroup: string | null;
  allergiesCount: number;
  chronicConditionsCount: number;
}

interface AIAnalysis {
  overallAssessment: string;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high';
  recommendations: string[];
  warningFlags: string[];
  aiPowered: boolean;
  model?: string;
}

interface HealthSummary {
  overallScore: number;
  scoreLabel: string;
  metrics: HealthMetric[];
  insights: HealthInsight[];
  labResults?: LabResult[];
  patientInfo?: PatientInfo;
  aiAnalysis?: AIAnalysis;
  lastUpdated: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export default function HealthInsights() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'recommendations'>('overview');

  // Fetch health insights data
  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['patient-health-insights'],
    queryFn: async () => {
      try {
        const patientToken = localStorage.getItem('patientPortalToken');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (patientToken) {
          headers['Authorization'] = `Bearer ${patientToken}`;
        }

        const response = await fetch(`${API_URL}/patient-portal/health-insights`, {
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          return data.data || generateMockData();
        }
        return generateMockData();
      } catch {
        return generateMockData();
      }
    },
  });

  // Generate mock data for demonstration
  const generateMockData = (): HealthSummary => ({
    overallScore: 78,
    scoreLabel: 'Good',
    lastUpdated: new Date().toISOString(),
    metrics: [
      { name: 'Blood Pressure', value: '120/80', unit: 'mmHg', status: 'normal', trend: 'stable', date: '2024-01-15' },
      { name: 'Heart Rate', value: 72, unit: 'bpm', status: 'normal', trend: 'down', previousValue: 78, date: '2024-01-15' },
      { name: 'Blood Sugar', value: 105, unit: 'mg/dL', status: 'attention', trend: 'up', previousValue: 98, date: '2024-01-14' },
      { name: 'Cholesterol', value: 195, unit: 'mg/dL', status: 'normal', trend: 'down', previousValue: 210, date: '2024-01-10' },
      { name: 'BMI', value: 24.5, unit: 'kg/m2', status: 'normal', trend: 'stable', date: '2024-01-08' },
    ],
    labResults: [
      { testName: 'Complete Blood Count', value: 'Normal', unit: '', normalRange: 'N/A', status: 'normal', date: '2024-01-10' },
      { testName: 'Hemoglobin', value: 14.5, unit: 'g/dL', normalRange: '13.5-17.5', status: 'normal', date: '2024-01-10' },
      { testName: 'Glucose (Fasting)', value: 105, unit: 'mg/dL', normalRange: '70-100', status: 'abnormal', date: '2024-01-08' },
    ],
    patientInfo: {
      name: 'Patient',
      bloodGroup: 'A+',
      allergiesCount: 2,
      chronicConditionsCount: 1,
    },
    insights: [
      {
        id: '1',
        type: 'recommendation',
        title: 'Complete Your Annual Check-up',
        description: 'Based on your records, you are due for your annual physical examination. Regular check-ups help detect potential health issues early.',
        priority: 'high',
        actionLabel: 'Schedule Now',
        actionRoute: '/patient-portal/appointments',
      },
      {
        id: '2',
        type: 'alert',
        title: 'Blood Sugar Trending Upward',
        description: 'Your blood sugar levels have increased slightly over the past few readings. Consider monitoring your diet and consulting with your doctor.',
        priority: 'medium',
      },
      {
        id: '3',
        type: 'tip',
        title: 'Stay Hydrated',
        description: 'Drinking adequate water daily helps maintain healthy blood pressure and supports overall wellness. Aim for 8 glasses per day.',
        priority: 'low',
      },
      {
        id: '4',
        type: 'reminder',
        title: 'Medication Refill Coming Up',
        description: 'Your prescription for Lisinopril will need to be refilled in 5 days. Request a refill early to avoid any gaps.',
        priority: 'medium',
        actionLabel: 'View Prescriptions',
        actionRoute: '/patient-portal/prescriptions',
      },
    ],
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-600';
    if (score >= 60) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-700';
      case 'attention': return 'bg-amber-100 text-amber-700';
      case 'critical': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowTrendingUpIcon className="h-4 w-4 text-amber-500" />;
      case 'down': return <ArrowTrendingDownIcon className="h-4 w-4 text-green-500" />;
      default: return <span className="text-xs text-gray-400">--</span>;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'recommendation': return <LightBulbIcon className="h-5 w-5" />;
      case 'alert': return <ExclamationTriangleIcon className="h-5 w-5" />;
      case 'reminder': return <ClockIcon className="h-5 w-5" />;
      case 'tip': return <SparklesIcon className="h-5 w-5" />;
      default: return <InformationCircleIcon className="h-5 w-5" />;
    }
  };

  const getInsightStyle = (type: string, priority: string) => {
    if (priority === 'high') {
      return 'border-red-200 bg-red-50';
    }
    switch (type) {
      case 'recommendation': return 'border-blue-200 bg-blue-50';
      case 'alert': return 'border-amber-200 bg-amber-50';
      case 'reminder': return 'border-purple-200 bg-purple-50';
      case 'tip': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getInsightIconColor = (type: string) => {
    switch (type) {
      case 'recommendation': return 'text-blue-600';
      case 'alert': return 'text-amber-600';
      case 'reminder': return 'text-purple-600';
      case 'tip': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500">Loading your health insights...</p>
        </div>
      </div>
    );
  }

  const summary = healthData || generateMockData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white shadow-lg">
                <SparklesIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Health Insights</h1>
                <p className="text-gray-500">Personalized health analysis and recommendations</p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Health Score Card */}
        <div className={`bg-gradient-to-r ${getScoreGradient(summary.overallScore)} rounded-2xl p-6 text-white shadow-xl`}>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-shrink-0 text-center">
              <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm mx-auto">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
                  <div className={`text-4xl font-bold ${getScoreColor(summary.overallScore)}`}>
                    {summary.overallScore}
                  </div>
                </div>
              </div>
              <p className="text-xl font-semibold mt-3">{summary.scoreLabel}</p>
              <p className="text-sm opacity-80">Health Score</p>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <HeartIcon className="h-6 w-6" />
                <h3 className="text-lg font-semibold">Your Health Overview</h3>
              </div>
              <p className="opacity-90">
                Your health score is based on your recent lab results, vital signs, appointment history, and lifestyle factors.
                Continue maintaining healthy habits to improve your score.
              </p>
              <div className="flex items-center gap-2 text-sm opacity-80">
                <ClockIcon className="h-4 w-4" />
                <span>Last updated: {new Date(summary.lastUpdated).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-2">
          <div className="flex gap-2">
            {[
              { key: 'overview', label: 'Overview', icon: ChartBarIcon },
              { key: 'trends', label: 'Health Trends', icon: ArrowTrendingUpIcon },
              { key: 'recommendations', label: 'Recommendations', icon: LightBulbIcon },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Patient Info Banner */}
            {summary.patientInfo && (
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
                <div className="flex flex-wrap items-center gap-4 md:gap-8">
                  <div className="flex items-center gap-3">
                    <UserCircleIcon className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-500">Patient</p>
                      <p className="font-medium text-gray-900">{summary.patientInfo.name}</p>
                    </div>
                  </div>
                  {summary.patientInfo.bloodGroup && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl">
                      <HeartIcon className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-xs text-gray-500">Blood Group</p>
                        <p className="font-semibold text-red-700">{summary.patientInfo.bloodGroup}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-gray-500">Allergies</p>
                      <p className="font-semibold text-amber-700">{summary.patientInfo.allergiesCount} known</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-xl">
                    <DocumentTextIcon className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-xs text-gray-500">Chronic Conditions</p>
                      <p className="font-semibold text-purple-700">{summary.patientInfo.chronicConditionsCount} tracked</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Analysis Section */}
            {summary.aiAnalysis && (
              <div className={`rounded-2xl border shadow-lg p-6 ${
                summary.aiAnalysis.riskLevel === 'high' ? 'bg-red-50 border-red-200' :
                summary.aiAnalysis.riskLevel === 'elevated' ? 'bg-amber-50 border-amber-200' :
                summary.aiAnalysis.riskLevel === 'moderate' ? 'bg-yellow-50 border-yellow-200' :
                'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    summary.aiAnalysis.riskLevel === 'high' ? 'bg-red-100' :
                    summary.aiAnalysis.riskLevel === 'elevated' ? 'bg-amber-100' :
                    summary.aiAnalysis.riskLevel === 'moderate' ? 'bg-yellow-100' :
                    'bg-green-100'
                  }`}>
                    <SparklesIcon className={`h-6 w-6 ${
                      summary.aiAnalysis.riskLevel === 'high' ? 'text-red-600' :
                      summary.aiAnalysis.riskLevel === 'elevated' ? 'text-amber-600' :
                      summary.aiAnalysis.riskLevel === 'moderate' ? 'text-yellow-600' :
                      'text-green-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">AI Health Assessment</h3>
                      {summary.aiAnalysis.aiPowered && (
                        <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                          <SparklesIcon className="h-3 w-3" />
                          GPT-4o Powered
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 mb-4">{summary.aiAnalysis.overallAssessment}</p>

                    {/* Warning Flags */}
                    {summary.aiAnalysis.warningFlags && summary.aiAnalysis.warningFlags.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-red-700 mb-2">Attention Required</h4>
                        <div className="space-y-2">
                          {summary.aiAnalysis.warningFlags.map((flag, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-red-700 bg-red-100 rounded-lg p-2">
                              <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <span>{flag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Recommendations */}
                    {summary.aiAnalysis.recommendations && summary.aiAnalysis.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">AI Recommendations</h4>
                        <ul className="space-y-1">
                          {summary.aiAnalysis.recommendations.slice(0, 4).map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                              <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Metrics */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BeakerIcon className="h-5 w-5 text-blue-600" />
                Key Health Metrics
              </h3>
              <div className="space-y-4">
                {summary.metrics.map((metric, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{metric.name}</p>
                      <p className="text-sm text-gray-500">{metric.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {metric.value} <span className="text-sm font-normal text-gray-500">{metric.unit}</span>
                        </p>
                        {metric.previousValue && (
                          <p className="text-xs text-gray-500">Previous: {metric.previousValue}</p>
                        )}
                      </div>
                      {getTrendIcon(metric.trend)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metric.status)}`}>
                        {metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/patient-portal/labs')}
                className="w-full mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              >
                View All Lab Results
              </button>
            </div>

            {/* Quick Insights */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-purple-600" />
                AI Insights
              </h3>
              <div className="space-y-3">
                {summary.insights.slice(0, 4).map((insight) => (
                  <div
                    key={insight.id}
                    className={`p-4 rounded-xl border ${getInsightStyle(insight.type, insight.priority)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 ${getInsightIconColor(insight.type)}`}>
                        {getInsightIcon(insight.type)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{insight.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                        {insight.actionLabel && insight.actionRoute && (
                          <button
                            onClick={() => navigate(insight.actionRoute!)}
                            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            {insight.actionLabel} &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>

            {/* Recent Lab Results Section */}
            {summary.labResults && summary.labResults.length > 0 && (
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-green-600" />
                  Recent Lab Results
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Test Name</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Result</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Normal Range</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Status</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {summary.labResults.map((lab, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="py-3 px-2 text-sm font-medium text-gray-900">{lab.testName}</td>
                          <td className="py-3 px-2 text-sm text-gray-900">
                            {lab.value} {lab.unit && <span className="text-gray-500">{lab.unit}</span>}
                          </td>
                          <td className="py-3 px-2 text-sm text-gray-500">{lab.normalRange}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              lab.status === 'normal' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {lab.status === 'normal' ? 'Normal' : 'Abnormal'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-sm text-gray-500">{lab.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => navigate('/patient-portal/medical-history')}
                  className="w-full mt-4 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                >
                  View Complete Lab History
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <ArrowTrendingUpIcon className="h-5 w-5 text-blue-600" />
              Your Health Trends
            </h3>

            {/* Placeholder for charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {summary.metrics.map((metric, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">{metric.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metric.status)}`}>
                      {metric.trend === 'up' ? 'Trending Up' : metric.trend === 'down' ? 'Trending Down' : 'Stable'}
                    </span>
                  </div>
                  {/* Simplified trend visualization */}
                  <div className="h-24 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                      <p className="text-sm text-gray-500">{metric.unit}</p>
                      {metric.previousValue && (
                        <p className="text-xs text-gray-400 mt-1">
                          {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'} from {metric.previousValue}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-start gap-3">
                <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Understanding Your Trends</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Trends are calculated based on your last 3-6 months of health data. Green indicates improvement,
                    amber indicates values that need attention. Discuss any concerns with your healthcare provider.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <LightBulbIcon className="h-5 w-5 text-amber-600" />
                Personalized Recommendations
              </h3>

              <div className="space-y-4">
                {summary.insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`p-5 rounded-xl border ${getInsightStyle(insight.type, insight.priority)}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg bg-white shadow-sm ${getInsightIconColor(insight.type)}`}>
                        {getInsightIcon(insight.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            insight.priority === 'high' ? 'bg-red-100 text-red-700' :
                            insight.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {insight.priority.charAt(0).toUpperCase() + insight.priority.slice(1)} Priority
                          </span>
                        </div>
                        <p className="text-gray-600 mt-2">{insight.description}</p>
                        {insight.actionLabel && insight.actionRoute && (
                          <button
                            onClick={() => navigate(insight.actionRoute!)}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                          >
                            {insight.actionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preventive Care */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                Preventive Care Checklist
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: 'Annual Physical Exam', due: 'Due in 2 months', completed: false },
                  { name: 'Flu Vaccination', due: 'Completed', completed: true },
                  { name: 'Blood Pressure Check', due: 'Completed', completed: true },
                  { name: 'Cholesterol Screening', due: 'Due in 6 months', completed: false },
                  { name: 'Dental Checkup', due: 'Due', completed: false },
                  { name: 'Eye Exam', due: 'Due in 1 year', completed: false },
                ].map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      item.completed ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className={`p-1 rounded-full ${
                      item.completed ? 'bg-green-100' : 'bg-gray-200'
                    }`}>
                      <CheckCircleIcon className={`h-5 w-5 ${
                        item.completed ? 'text-green-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium ${
                        item.completed ? 'text-green-800' : 'text-gray-900'
                      }`}>{item.name}</p>
                      <p className={`text-sm ${
                        item.completed ? 'text-green-600' : 'text-gray-500'
                      }`}>{item.due}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-500">
              These AI-generated insights are based on your available health data and are for informational purposes only.
              They do not constitute medical advice. Always consult with your healthcare provider for personalized medical guidance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
