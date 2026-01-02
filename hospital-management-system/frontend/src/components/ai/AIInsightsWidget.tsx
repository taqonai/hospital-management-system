import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CpuChipIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  HeartIcon,
  PhotoIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth, getRiskLevelColor } from '../../hooks/useAI';
import { symptomCheckerApi } from '../../services/api';
import { useMutation } from '@tanstack/react-query';
import LoadingSpinner from '../common/LoadingSpinner';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface QuickTriageResult {
  triageLevel: string;
  urgencyScore: number;
  recommendedDepartment: string;
  recommendedAction: string;
  redFlagsDetected: boolean;
}

export default function AIInsightsWidget() {
  const { data: healthStatus, isLoading: healthLoading } = useAIHealth();

  const [quickSymptoms, setQuickSymptoms] = useState('');
  const [quickResult, setQuickResult] = useState<QuickTriageResult | null>(null);
  const [showQuickAnalysis, setShowQuickAnalysis] = useState(false);

  // Use symptom checker API (production endpoint)
  const quickCheckMutation = useMutation({
    mutationFn: async (data: { symptoms: string[]; patientAge: number }) => {
      const response = await symptomCheckerApi.quickCheck(data.symptoms, data.patientAge);
      return response.data.data;
    },
    onSuccess: (data) => {
      setQuickResult({
        triageLevel: data.triageLevel,
        urgencyScore: data.urgencyScore,
        recommendedDepartment: data.recommendedDepartment,
        recommendedAction: data.recommendedAction,
        redFlagsDetected: data.redFlagsDetected,
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Analysis failed');
    },
  });

  const handleQuickAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSymptoms.trim()) return;

    const symptoms = quickSymptoms.split(',').map(s => s.trim()).filter(Boolean);

    quickCheckMutation.mutate({
      symptoms,
      patientAge: 45,
    });
  };

  const isAIOnline = healthStatus?.status === 'connected';

  const mockInsights = {
    highRiskPatients: 3,
    pendingAnalyses: 5,
    completedToday: 12,
    criticalAlerts: 1,
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-xl h-full animate-fade-in-up opacity-0"
      style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}
    >
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

      {/* Floating glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />

      {/* Header */}
      <div className="relative p-6 border-b border-gray-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                <CpuChipIcon className="h-5 w-5 text-white" />
              </div>
              {/* Pulse ring when online */}
              {isAIOnline && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900">AI Insights</h2>
          </div>
          <div className="flex items-center gap-2">
            {healthLoading ? (
              <LoadingSpinner size="sm" />
            ) : isAIOnline ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">
                <XCircleIcon className="h-3.5 w-3.5" />
                Offline
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative p-6 space-y-5">
        {/* AI Stats Row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { value: mockInsights.criticalAlerts, label: 'Critical', color: 'from-rose-500 to-pink-600', bg: 'bg-rose-500/10' },
            { value: mockInsights.highRiskPatients, label: 'High Risk', color: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10' },
            { value: mockInsights.pendingAnalyses, label: 'Pending', color: 'from-blue-500 to-cyan-600', bg: 'bg-blue-500/10' },
            { value: mockInsights.completedToday, label: 'Today', color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500/10' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`relative text-center p-3 rounded-xl ${stat.bg} backdrop-blur-sm border border-white/10 group hover:scale-105 transition-transform duration-300`}
            >
              <p className={`text-xl font-bold bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}>
                {stat.value}
              </p>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          {mockInsights.criticalAlerts > 0 && (
            <div className="group flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-500/20 hover:border-rose-500/40 transition-colors">
              <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg group-hover:scale-110 transition-transform">
                <ExclamationTriangleIcon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-rose-700">Critical Alert</p>
                <p className="text-xs text-rose-600/80 mt-0.5">
                  Chest X-ray analysis detected potential abnormality
                </p>
              </div>
              <span className={clsx('px-2 py-1 text-[10px] font-bold rounded-full uppercase', getRiskLevelColor('CRITICAL'))}>
                Critical
              </span>
            </div>
          )}

          <div className="group flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg group-hover:scale-110 transition-transform">
              <HeartIcon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-700">Readmission Risk</p>
              <p className="text-xs text-amber-600/80 mt-0.5">
                {mockInsights.highRiskPatients} patients with elevated 30-day risk
              </p>
            </div>
          </div>

          <div className="group flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg group-hover:scale-110 transition-transform">
              <ArrowTrendingUpIcon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-700">Pattern Detected</p>
              <p className="text-xs text-blue-600/80 mt-0.5">
                Similar symptom patterns in {mockInsights.pendingAnalyses} cases
              </p>
            </div>
          </div>
        </div>

        {/* Quick Analysis Toggle */}
        <button
          onClick={() => setShowQuickAnalysis(!showQuickAnalysis)}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 hover:from-purple-500/15 hover:to-pink-500/15 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg group-hover:scale-110 transition-transform">
              <SparklesIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-purple-700">Quick Symptom Analysis</span>
          </div>
          <ArrowRightIcon className={clsx(
            'h-4 w-4 text-purple-500 transition-transform duration-300',
            showQuickAnalysis && 'rotate-90'
          )} />
        </button>

        {/* Quick Analysis Form */}
        {showQuickAnalysis && (
          <form onSubmit={handleQuickAnalysis} className="space-y-3 p-4 rounded-xl bg-gray-100/50 border border-gray-200/50">
            <div>
              <input
                type="text"
                value={quickSymptoms}
                onChange={(e) => setQuickSymptoms(e.target.value)}
                placeholder="Enter symptoms (e.g., headache, fever, nausea)"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white/80 border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 placeholder-gray-400 transition-all"
                disabled={!isAIOnline || quickCheckMutation.isPending}
              />
            </div>
            <button
              type="submit"
              disabled={!isAIOnline || quickCheckMutation.isPending || !quickSymptoms.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              {quickCheckMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  <span>Analyze Symptoms</span>
                </>
              )}
            </button>

            {/* Quick Triage Result */}
            {quickResult && (
              <div className={clsx(
                'p-4 rounded-xl border shadow-lg',
                quickResult.triageLevel === 'EMERGENCY' ? 'bg-red-50 border-red-200' :
                quickResult.triageLevel === 'URGENT' ? 'bg-orange-50 border-orange-200' :
                quickResult.triageLevel === 'ROUTINE' ? 'bg-blue-50 border-blue-200' :
                'bg-green-50 border-green-200'
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Triage Assessment</span>
                  <span className={clsx(
                    'text-xs font-bold px-2 py-0.5 rounded-full',
                    quickResult.triageLevel === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                    quickResult.triageLevel === 'URGENT' ? 'bg-orange-100 text-orange-700' :
                    quickResult.triageLevel === 'ROUTINE' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  )}>
                    {quickResult.triageLevel}
                  </span>
                </div>
                <p className="font-bold text-gray-900">{quickResult.recommendedDepartment}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-500',
                        quickResult.triageLevel === 'EMERGENCY' ? 'bg-red-500' :
                        quickResult.triageLevel === 'URGENT' ? 'bg-orange-500' :
                        quickResult.triageLevel === 'ROUTINE' ? 'bg-blue-500' :
                        'bg-green-500'
                      )}
                      style={{ width: `${quickResult.urgencyScore * 10}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">
                    {quickResult.urgencyScore}/10
                  </span>
                </div>
                {quickResult.redFlagsDetected && (
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    Red flags detected
                  </div>
                )}
                <Link
                  to="/ai-assistant"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  View full analysis
                  <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </div>
            )}
          </form>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200/50">
          {[
            { href: '/ai-assistant', icon: SparklesIcon, label: 'Diagnosis', color: 'from-purple-500 to-pink-600' },
            { href: '/ai-assistant', icon: HeartIcon, label: 'Risk', color: 'from-rose-500 to-pink-600' },
            { href: '/ai-assistant', icon: PhotoIcon, label: 'Imaging', color: 'from-blue-500 to-cyan-600' },
          ].map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-100/50 transition-all group"
            >
              <div className={`p-2 rounded-lg bg-gradient-to-br ${link.color} shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all mb-2`}>
                <link.icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                {link.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
