import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  CpuChipIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  LightBulbIcon,
  CurrencyDollarIcon,
  ArrowTrendingDownIcon,
  BoltIcon,
  ShieldCheckIcon,
  CubeIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { assetApi } from '../../services/api';

// Types
interface PredictFailureInput {
  assetAge: number;
  usageHours: number;
  lastMaintenanceDate: string;
  currentCondition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  category: string;
}

interface PredictFailureResult {
  failureProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  predictedFailureWindow: string;
  contributingFactors: string[];
  recommendations: string[];
  urgency: 'ROUTINE' | 'SOON' | 'URGENT' | 'IMMEDIATE';
}

interface LifecycleInput {
  age: number;
  usefulLife: number;
  purchasePrice: number;
  depreciationRate: number;
}

interface LifecycleResult {
  currentPhase: 'NEW' | 'MATURE' | 'AGING' | 'END_OF_LIFE';
  remainingLifePercentage: number;
  depreciatedValue: number;
  recommendations: string[];
  replacementTimeframe: string;
}

interface AssetForSchedule {
  id: string;
  name: string;
  category: string;
  lastMaintenance: string;
  maintenanceInterval: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface ScheduleOptimizationResult {
  schedule: Array<{
    assetId: string;
    assetName: string;
    suggestedDate: string;
    maintenanceType: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
  }>;
  weeklyAllocation: Array<{
    week: string;
    count: number;
    hours: number;
  }>;
  recommendations: string[];
}

// Risk Level Colors
const RISK_COLORS = {
  LOW: {
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500',
  },
  MEDIUM: {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500',
  },
  HIGH: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-500',
  },
  CRITICAL: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500',
  },
};

const PHASE_COLORS = {
  NEW: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'New',
  },
  MATURE: {
    bg: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'Mature',
  },
  AGING: {
    bg: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Aging',
  },
  END_OF_LIFE: {
    bg: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    label: 'End of Life',
  },
};

const PRIORITY_COLORS = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const CONDITION_OPTIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'] as const;

const CATEGORY_OPTIONS = [
  'Medical Equipment',
  'IT Equipment',
  'Facility Equipment',
  'Laboratory Equipment',
  'Imaging Equipment',
  'Surgical Equipment',
  'Patient Monitoring',
  'HVAC',
  'Electrical',
  'Plumbing',
  'Other',
];

export default function AIAssetAnalytics() {
  const [activeTab, setActiveTab] = useState<'failure' | 'lifecycle' | 'schedule'>('failure');
  const [scheduleAssets, setScheduleAssets] = useState<AssetForSchedule[]>([
    {
      id: '1',
      name: 'MRI Scanner',
      category: 'Imaging Equipment',
      lastMaintenance: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      maintenanceInterval: 90,
      priority: 'HIGH',
    },
    {
      id: '2',
      name: 'X-Ray Machine',
      category: 'Imaging Equipment',
      lastMaintenance: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      maintenanceInterval: 60,
      priority: 'MEDIUM',
    },
    {
      id: '3',
      name: 'Patient Monitor',
      category: 'Patient Monitoring',
      lastMaintenance: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      maintenanceInterval: 45,
      priority: 'HIGH',
    },
  ]);

  // Failure prediction form and mutation
  const failureForm = useForm<PredictFailureInput>({
    defaultValues: {
      assetAge: 3,
      usageHours: 5000,
      lastMaintenanceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currentCondition: 'GOOD',
      category: 'Medical Equipment',
    },
  });

  const failureMutation = useMutation({
    mutationFn: (data: PredictFailureInput) => assetApi.predictFailure(data),
  });

  // Lifecycle analysis form and mutation
  const lifecycleForm = useForm<LifecycleInput>({
    defaultValues: {
      age: 5,
      usefulLife: 10,
      purchasePrice: 50000,
      depreciationRate: 15,
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: (data: LifecycleInput) => assetApi.analyzeLifecycle(data),
  });

  // Schedule optimization mutation
  const scheduleMutation = useMutation({
    mutationFn: (assets: AssetForSchedule[]) => assetApi.optimizeSchedule({ assets }),
  });

  const onFailureSubmit = (data: PredictFailureInput) => {
    failureMutation.mutate(data);
  };

  const onLifecycleSubmit = (data: LifecycleInput) => {
    lifecycleMutation.mutate(data);
  };

  const onScheduleOptimize = () => {
    scheduleMutation.mutate(scheduleAssets);
  };

  const addAssetToSchedule = () => {
    const newAsset: AssetForSchedule = {
      id: `${Date.now()}`,
      name: '',
      category: 'Medical Equipment',
      lastMaintenance: new Date().toISOString().split('T')[0],
      maintenanceInterval: 30,
      priority: 'MEDIUM',
    };
    setScheduleAssets([...scheduleAssets, newAsset]);
  };

  const updateScheduleAsset = (index: number, field: keyof AssetForSchedule, value: any) => {
    const updated = [...scheduleAssets];
    updated[index] = { ...updated[index], [field]: value };
    setScheduleAssets(updated);
  };

  const removeScheduleAsset = (index: number) => {
    setScheduleAssets(scheduleAssets.filter((_, i) => i !== index));
  };

  // Get failure result
  const failureResult = failureMutation.data?.data as PredictFailureResult | undefined;
  const lifecycleResult = lifecycleMutation.data?.data as LifecycleResult | undefined;
  const scheduleResult = scheduleMutation.data?.data as ScheduleOptimizationResult | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CpuChipIcon className="h-7 w-7 text-purple-500" />
            AI Asset Analytics
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            AI-powered predictive maintenance and lifecycle analysis for hospital assets
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('failure')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all',
            activeTab === 'failure'
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
              : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 text-slate-600 dark:text-slate-300'
          )}
        >
          <ExclamationTriangleIcon className="h-5 w-5" />
          Predictive Failure Analysis
        </button>
        <button
          onClick={() => setActiveTab('lifecycle')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all',
            activeTab === 'lifecycle'
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
              : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 text-slate-600 dark:text-slate-300'
          )}
        >
          <ChartBarIcon className="h-5 w-5" />
          Lifecycle Analysis
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all',
            activeTab === 'schedule'
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
              : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 text-slate-600 dark:text-slate-300'
          )}
        >
          <CalendarDaysIcon className="h-5 w-5" />
          Schedule Optimization
        </button>
      </div>

      {/* Predictive Failure Analysis Tab */}
      {activeTab === 'failure' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <WrenchScrewdriverIcon className="h-5 w-5 text-orange-500" />
              Asset Information
            </h3>
            <form onSubmit={failureForm.handleSubmit(onFailureSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Asset Age (years)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...failureForm.register('assetAge', { valueAsNumber: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Usage Hours
                  </label>
                  <input
                    type="number"
                    {...failureForm.register('usageHours', { valueAsNumber: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Last Maintenance Date
                </label>
                <input
                  type="date"
                  {...failureForm.register('lastMaintenanceDate')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current Condition
                </label>
                <select
                  {...failureForm.register('currentCondition')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {CONDITION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  {...failureForm.register('category')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={failureMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
              >
                {failureMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BoltIcon className="h-5 w-5" />
                    Predict Failure Risk
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {failureMutation.isError && (
              <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400">Failed to analyze failure risk. Please try again.</p>
              </div>
            )}

            {failureResult && (
              <>
                {/* Risk Meter */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                    Failure Risk Assessment
                  </h3>

                  {/* Visual Risk Meter */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Failure Probability</span>
                      <span className={clsx('text-2xl font-bold', RISK_COLORS[failureResult.riskLevel].text)}>
                        {Number(failureResult.failureProbability || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-500',
                          RISK_COLORS[failureResult.riskLevel].bg
                        )}
                        style={{ width: `${Math.min(Number(failureResult.failureProbability || 0), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Risk Level Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={clsx(
                          'px-4 py-2 rounded-full text-sm font-semibold',
                          RISK_COLORS[failureResult.riskLevel].bgLight,
                          RISK_COLORS[failureResult.riskLevel].text
                        )}
                      >
                        {failureResult.riskLevel} RISK
                      </span>
                      <span
                        className={clsx(
                          'px-3 py-1 rounded-full text-xs font-medium',
                          failureResult.urgency === 'IMMEDIATE'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : failureResult.urgency === 'URGENT'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : failureResult.urgency === 'SOON'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        )}
                      >
                        {failureResult.urgency}
                      </span>
                    </div>
                  </div>

                  {/* Predicted Failure Window */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ClockIcon className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-500 dark:text-slate-400">Predicted Failure Window</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {failureResult.predictedFailureWindow}
                    </p>
                  </div>
                </div>

                {/* Contributing Factors */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <BeakerIcon className="h-5 w-5 text-blue-500" />
                    Contributing Factors
                  </h3>
                  <div className="space-y-2">
                    {failureResult.contributingFactors.map((factor, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <LightBulbIcon className="h-5 w-5 text-emerald-500" />
                    Recommendations
                  </h3>
                  <div className="space-y-2">
                    {failureResult.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!failureResult && !failureMutation.isPending && (
              <div className="rounded-2xl p-8 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg text-center">
                <CubeIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                  Enter asset information and click "Predict Failure Risk" to get AI analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lifecycle Analysis Tab */}
      {activeTab === 'lifecycle' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-blue-500" />
              Lifecycle Parameters
            </h3>
            <form onSubmit={lifecycleForm.handleSubmit(onLifecycleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Asset Age (years)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...lifecycleForm.register('age', { valueAsNumber: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Useful Life (years)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...lifecycleForm.register('usefulLife', { valueAsNumber: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...lifecycleForm.register('purchasePrice', { valueAsNumber: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Depreciation Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...lifecycleForm.register('depreciationRate', { valueAsNumber: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={lifecycleMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50"
              >
                {lifecycleMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ChartBarIcon className="h-5 w-5" />
                    Analyze Lifecycle
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {lifecycleMutation.isError && (
              <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400">Failed to analyze lifecycle. Please try again.</p>
              </div>
            )}

            {lifecycleResult && (
              <>
                {/* Lifecycle Progress */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ArrowTrendingDownIcon className="h-5 w-5 text-purple-500" />
                    Lifecycle Status
                  </h3>

                  {/* Current Phase */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Current Phase</span>
                    <span
                      className={clsx(
                        'px-4 py-2 rounded-full text-sm font-semibold',
                        PHASE_COLORS[lifecycleResult.currentPhase]?.text,
                        lifecycleResult.currentPhase === 'NEW'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : lifecycleResult.currentPhase === 'MATURE'
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : lifecycleResult.currentPhase === 'AGING'
                          ? 'bg-amber-100 dark:bg-amber-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      )}
                    >
                      {PHASE_COLORS[lifecycleResult.currentPhase]?.label}
                    </span>
                  </div>

                  {/* Remaining Life Progress Bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Remaining Useful Life</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {Number(lifecycleResult.remainingLifePercentage || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-500',
                          Number(lifecycleResult.remainingLifePercentage) > 50
                            ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                            : Number(lifecycleResult.remainingLifePercentage) > 25
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            : 'bg-gradient-to-r from-red-500 to-orange-400'
                        )}
                        style={{ width: `${Math.max(Number(lifecycleResult.remainingLifePercentage || 0), 0)}%` }}
                      />
                      {/* Phase markers */}
                      <div className="absolute top-0 left-1/4 w-px h-full bg-slate-300 dark:bg-slate-600" />
                      <div className="absolute top-0 left-1/2 w-px h-full bg-slate-300 dark:bg-slate-600" />
                      <div className="absolute top-0 left-3/4 w-px h-full bg-slate-300 dark:bg-slate-600" />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                      <span>End of Life</span>
                      <span>Aging</span>
                      <span>Mature</span>
                      <span>New</span>
                    </div>
                  </div>

                  {/* Value & Timeframe */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="flex items-center gap-2 mb-1">
                        <CurrencyDollarIcon className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-slate-500 dark:text-slate-400">Depreciated Value</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        ${Number(lifecycleResult.depreciatedValue || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="flex items-center gap-2 mb-1">
                        <ClockIcon className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-slate-500 dark:text-slate-400">Replace By</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {lifecycleResult.replacementTimeframe}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <LightBulbIcon className="h-5 w-5 text-emerald-500" />
                    Lifecycle Recommendations
                  </h3>
                  <div className="space-y-2">
                    {lifecycleResult.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!lifecycleResult && !lifecycleMutation.isPending && (
              <div className="rounded-2xl p-8 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg text-center">
                <ChartBarIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                  Enter lifecycle parameters and click "Analyze Lifecycle" to get AI analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Optimization Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* Assets Input */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CubeIcon className="h-5 w-5 text-cyan-500" />
                Assets for Scheduling
              </h3>
              <button
                onClick={addAssetToSchedule}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-900/50 transition-colors text-sm"
              >
                + Add Asset
              </button>
            </div>

            <div className="space-y-3">
              {scheduleAssets.map((asset, index) => (
                <div
                  key={asset.id}
                  className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                >
                  <div className="col-span-3">
                    <input
                      type="text"
                      placeholder="Asset Name"
                      value={asset.name}
                      onChange={(e) => updateScheduleAsset(index, 'name', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={asset.category}
                      onChange={(e) => updateScheduleAsset(index, 'category', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="date"
                      value={asset.lastMaintenance}
                      onChange={(e) => updateScheduleAsset(index, 'lastMaintenance', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Interval (days)"
                      value={asset.maintenanceInterval}
                      onChange={(e) => updateScheduleAsset(index, 'maintenanceInterval', parseInt(e.target.value) || 30)}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={asset.priority}
                      onChange={(e) => updateScheduleAsset(index, 'priority', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeScheduleAsset(index)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onScheduleOptimize}
              disabled={scheduleMutation.isPending || scheduleAssets.length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50"
            >
              {scheduleMutation.isPending ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Optimizing Schedule...
                </>
              ) : (
                <>
                  <CalendarDaysIcon className="h-5 w-5" />
                  Optimize Maintenance Schedule
                </>
              )}
            </button>
          </div>

          {scheduleMutation.isError && (
            <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
              <p className="text-red-600 dark:text-red-400">Failed to optimize schedule. Please try again.</p>
            </div>
          )}

          {scheduleResult && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Optimized Schedule */}
              <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <CalendarDaysIcon className="h-5 w-5 text-blue-500" />
                  Optimized Schedule
                </h3>
                <div className="space-y-3">
                  {scheduleResult.schedule.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border-l-4"
                      style={{
                        borderLeftColor:
                          item.priority === 'CRITICAL'
                            ? '#ef4444'
                            : item.priority === 'HIGH'
                            ? '#f97316'
                            : item.priority === 'MEDIUM'
                            ? '#3b82f6'
                            : '#64748b',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{item.assetName}</span>
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[item.priority])}>
                          {item.priority}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Date: </span>
                          <span className="text-slate-700 dark:text-slate-300">{item.suggestedDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Type: </span>
                          <span className="text-slate-700 dark:text-slate-300">{item.maintenanceType}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Allocation Chart */}
              <div className="space-y-4">
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5 text-purple-500" />
                    Weekly Resource Allocation
                  </h3>
                  <div className="space-y-3">
                    {scheduleResult.weeklyAllocation.map((week, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">{week.week}</span>
                          <span className="text-slate-900 dark:text-white font-medium">
                            {week.count} tasks / {week.hours}h
                          </span>
                        </div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min((week.hours / 40) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Schedule Recommendations */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShieldCheckIcon className="h-5 w-5 text-emerald-500" />
                    Scheduling Recommendations
                  </h3>
                  <div className="space-y-2">
                    {scheduleResult.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!scheduleResult && !scheduleMutation.isPending && (
            <div className="rounded-2xl p-8 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg text-center">
              <CalendarDaysIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                Add assets above and click "Optimize Maintenance Schedule" to get AI-powered scheduling.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
