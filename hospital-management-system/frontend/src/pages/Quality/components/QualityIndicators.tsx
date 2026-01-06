import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  ChartBarIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  PencilSquareIcon,
  ClipboardDocumentCheckIcon,
  SparklesIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { qualityApi } from '../../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Types
interface QualityIndicator {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'PATIENT_SAFETY' | 'CLINICAL_OUTCOMES' | 'PROCESS' | 'EXPERIENCE';
  type: 'RATE' | 'COUNT' | 'PERCENTAGE' | 'SCORE';
  unit?: string;
  targetValue: number;
  thresholdValue: number;
  currentValue?: number;
  measurementFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  dataSource?: string;
  responsibleRole?: string;
  standardReference?: 'JCI' | 'NABH' | 'CMS' | 'OTHER';
  isActive: boolean;
  lastMeasuredAt?: string;
  trend?: 'UP' | 'DOWN' | 'STABLE';
  measurements?: Measurement[];
  createdAt: string;
  updatedAt: string;
}

interface Measurement {
  id: string;
  indicatorId: string;
  measurementDate: string;
  numerator?: number;
  denominator?: number;
  value: number;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

interface QualityIndicatorsProps {
  indicators?: QualityIndicator[];
  onRefresh?: () => void;
}

interface IndicatorFormData {
  code: string;
  name: string;
  description: string;
  category: QualityIndicator['category'];
  type: QualityIndicator['type'];
  unit: string;
  targetValue: number;
  thresholdValue: number;
  measurementFrequency: QualityIndicator['measurementFrequency'];
  dataSource: string;
  responsibleRole: string;
  standardReference: QualityIndicator['standardReference'];
}

interface MeasurementFormData {
  measurementDate: string;
  numerator: number;
  denominator: number;
  notes: string;
}

// Configuration
const categoryConfig: Record<QualityIndicator['category'], { label: string; color: string; bg: string; border: string }> = {
  PATIENT_SAFETY: { label: 'Patient Safety', color: 'text-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  CLINICAL_OUTCOMES: { label: 'Clinical Outcomes', color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  PROCESS: { label: 'Process', color: 'text-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  EXPERIENCE: { label: 'Experience', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
};

const typeConfig: Record<QualityIndicator['type'], { label: string; icon: React.ElementType }> = {
  RATE: { label: 'Rate', icon: ChartBarIcon },
  COUNT: { label: 'Count', icon: DocumentTextIcon },
  PERCENTAGE: { label: 'Percentage', icon: ChartBarIcon },
  SCORE: { label: 'Score', icon: ClipboardDocumentCheckIcon },
};

const frequencyConfig: Record<QualityIndicator['measurementFrequency'], string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
};

const standardConfig: Record<string, { label: string; color: string }> = {
  JCI: { label: 'JCI', color: 'text-blue-600 bg-blue-50' },
  NABH: { label: 'NABH', color: 'text-green-600 bg-green-50' },
  CMS: { label: 'CMS', color: 'text-purple-600 bg-purple-50' },
  OTHER: { label: 'Other', color: 'text-gray-600 bg-gray-50' },
};

// Performance status calculation
function getPerformanceStatus(current: number | undefined, target: number, threshold: number): { status: 'MET' | 'WARNING' | 'NOT_MET'; color: string; bg: string; border: string } {
  if (current === undefined) {
    return { status: 'NOT_MET', color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' };
  }
  if (current >= target) {
    return { status: 'MET', color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  }
  if (current >= threshold) {
    return { status: 'WARNING', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  }
  return { status: 'NOT_MET', color: 'text-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
}

// Add/Edit Indicator Modal Component
function IndicatorModal({
  isOpen,
  onClose,
  indicator,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  indicator?: QualityIndicator | null;
  onSuccess: () => void;
}) {
  const isEditing = !!indicator;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<IndicatorFormData>({
    defaultValues: {
      code: '',
      name: '',
      description: '',
      category: 'PATIENT_SAFETY',
      type: 'PERCENTAGE',
      unit: '%',
      targetValue: 95,
      thresholdValue: 85,
      measurementFrequency: 'MONTHLY',
      dataSource: '',
      responsibleRole: '',
      standardReference: 'JCI',
    },
  });

  useEffect(() => {
    if (indicator) {
      reset({
        code: indicator.code,
        name: indicator.name,
        description: indicator.description || '',
        category: indicator.category,
        type: indicator.type,
        unit: indicator.unit || '',
        targetValue: indicator.targetValue,
        thresholdValue: indicator.thresholdValue,
        measurementFrequency: indicator.measurementFrequency,
        dataSource: indicator.dataSource || '',
        responsibleRole: indicator.responsibleRole || '',
        standardReference: indicator.standardReference || 'OTHER',
      });
    } else {
      reset({
        code: '',
        name: '',
        description: '',
        category: 'PATIENT_SAFETY',
        type: 'PERCENTAGE',
        unit: '%',
        targetValue: 95,
        thresholdValue: 85,
        measurementFrequency: 'MONTHLY',
        dataSource: '',
        responsibleRole: '',
        standardReference: 'JCI',
      });
    }
  }, [indicator, reset]);

  const createMutation = useMutation({
    mutationFn: (data: IndicatorFormData) => qualityApi.createIndicator(data),
    onSuccess: () => {
      toast.success('Indicator created successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create indicator');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: IndicatorFormData) => qualityApi.updateIndicator(indicator!.id, data),
    onSuccess: () => {
      toast.success('Indicator updated successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update indicator');
    },
  });

  const onSubmit = (data: IndicatorFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isEditing ? 'Edit Indicator' : 'Add Quality Indicator'}
                </h2>
                <p className="text-white/80 text-sm">
                  {isEditing ? 'Update indicator details' : 'Create a new quality measurement indicator'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Code and Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('code', { required: 'Code is required' })}
                  className={clsx(
                    'w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500',
                    errors.code ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="e.g., QI-001"
                />
                {errors.code && (
                  <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  className={clsx(
                    'w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500',
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="Indicator name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none"
                placeholder="Describe the indicator and its purpose..."
              />
            </div>

            {/* Category and Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      {Object.entries(categoryConfig).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      {Object.entries(typeConfig).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
            </div>

            {/* Unit and Frequency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <input
                  {...register('unit')}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  placeholder="e.g., %, per 1000, score"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Measurement Frequency <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="measurementFrequency"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      {Object.entries(frequencyConfig).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
            </div>

            {/* Target and Threshold */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('targetValue', {
                    required: 'Target value is required',
                    valueAsNumber: true,
                  })}
                  className={clsx(
                    'w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500',
                    errors.targetValue ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="e.g., 95"
                />
                {errors.targetValue && (
                  <p className="mt-1 text-sm text-red-500">{errors.targetValue.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Threshold Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('thresholdValue', {
                    required: 'Threshold value is required',
                    valueAsNumber: true,
                  })}
                  className={clsx(
                    'w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500',
                    errors.thresholdValue ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="e.g., 85"
                />
                {errors.thresholdValue && (
                  <p className="mt-1 text-sm text-red-500">{errors.thresholdValue.message}</p>
                )}
              </div>
            </div>

            {/* Data Source and Responsible Role */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Source
                </label>
                <input
                  {...register('dataSource')}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  placeholder="e.g., EMR, Lab System"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsible Person/Role
                </label>
                <input
                  {...register('responsibleRole')}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  placeholder="e.g., Quality Manager"
                />
              </div>
            </div>

            {/* Standard Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standard Reference
              </label>
              <Controller
                name="standardReference"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(standardConfig).map(([key, config]) => (
                      <label
                        key={key}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all',
                          field.value === key
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <input
                          type="radio"
                          {...field}
                          value={key}
                          checked={field.value === key}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">{config.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    {isEditing ? <PencilSquareIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                    {isEditing ? 'Update Indicator' : 'Create Indicator'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Record Measurement Modal Component
function MeasurementModal({
  isOpen,
  onClose,
  indicator,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  indicator: QualityIndicator | null;
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<MeasurementFormData>({
    defaultValues: {
      measurementDate: new Date().toISOString().split('T')[0],
      numerator: 0,
      denominator: 100,
      notes: '',
    },
  });

  const numerator = watch('numerator');
  const denominator = watch('denominator');

  const calculatedValue = useMemo(() => {
    if (!denominator || denominator === 0) return 0;
    return Number(((numerator / denominator) * 100).toFixed(2));
  }, [numerator, denominator]);

  useEffect(() => {
    if (isOpen) {
      reset({
        measurementDate: new Date().toISOString().split('T')[0],
        numerator: 0,
        denominator: 100,
        notes: '',
      });
    }
  }, [isOpen, reset]);

  const recordMutation = useMutation({
    mutationFn: (data: { numerator?: number; denominator?: number; value: number; measurementDate: string; notes?: string }) =>
      qualityApi.recordMeasurement(indicator!.id, data),
    onSuccess: () => {
      toast.success('Measurement recorded successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to record measurement');
    },
  });

  const onSubmit = (data: MeasurementFormData) => {
    recordMutation.mutate({
      numerator: data.numerator,
      denominator: data.denominator,
      value: calculatedValue,
      measurementDate: data.measurementDate,
      notes: data.notes || undefined,
    });
  };

  if (!isOpen || !indicator) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Record Measurement</h2>
                <p className="text-white/80 text-sm">{indicator.name}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            {/* Measurement Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Measurement Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('measurementDate', { required: 'Date is required' })}
                className={clsx(
                  'w-full rounded-xl border px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500',
                  errors.measurementDate ? 'border-red-300' : 'border-gray-300'
                )}
              />
              {errors.measurementDate && (
                <p className="mt-1 text-sm text-red-500">{errors.measurementDate.message}</p>
              )}
            </div>

            {/* Numerator and Denominator */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numerator
                </label>
                <input
                  type="number"
                  step="1"
                  {...register('numerator', { valueAsNumber: true })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  placeholder="e.g., 95"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Denominator
                </label>
                <input
                  type="number"
                  step="1"
                  {...register('denominator', { valueAsNumber: true, min: 1 })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  placeholder="e.g., 100"
                />
              </div>
            </div>

            {/* Calculated Value Display */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Calculated Value</span>
                <span className="text-2xl font-bold text-emerald-600">
                  {calculatedValue}{indicator.unit || '%'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <InformationCircleIcon className="h-4 w-4" />
                <span>Target: {indicator.targetValue}{indicator.unit || '%'} | Threshold: {indicator.thresholdValue}{indicator.unit || '%'}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
                placeholder="Additional notes or context..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordMutation.isPending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {recordMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <ClipboardDocumentCheckIcon className="h-5 w-5" />
                    Record Measurement
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Indicator Detail Panel Component
function IndicatorDetailPanel({
  indicator,
  onClose,
  onAnalyzeTrend,
}: {
  indicator: QualityIndicator;
  onClose: () => void;
  onAnalyzeTrend: () => void;
}) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(true);

  useEffect(() => {
    const fetchMeasurements = async () => {
      try {
        setLoadingMeasurements(true);
        const response = await qualityApi.getMeasurements(indicator.id, { limit: 12 });
        setMeasurements(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch measurements:', error);
      } finally {
        setLoadingMeasurements(false);
      }
    };

    fetchMeasurements();
  }, [indicator.id]);

  // Chart configuration
  const chartData = useMemo(() => {
    const sortedMeasurements = [...measurements].sort(
      (a, b) => new Date(a.measurementDate).getTime() - new Date(b.measurementDate).getTime()
    );

    return {
      labels: sortedMeasurements.map((m) =>
        new Date(m.measurementDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      datasets: [
        {
          label: 'Value',
          data: sortedMeasurements.map((m) => m.value),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#6366f1',
        },
        {
          label: 'Target',
          data: sortedMeasurements.map(() => indicator.targetValue),
          borderColor: '#10b981',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Threshold',
          data: sortedMeasurements.map(() => indicator.thresholdValue),
          borderColor: '#f59e0b',
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [measurements, indicator.targetValue, indicator.thresholdValue]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const performanceStatus = getPerformanceStatus(
    indicator.currentValue,
    indicator.targetValue,
    indicator.thresholdValue
  );

  return (
    <div className="mt-4 p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-5">
      {/* Header with close button */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Indicator Details</h4>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ChevronUpIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Trend Chart */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h5 className="text-sm font-medium text-gray-700">Trend Analysis</h5>
          <button
            onClick={onAnalyzeTrend}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            AI Analysis
          </button>
        </div>
        <div className="h-48">
          {loadingMeasurements ? (
            <div className="flex items-center justify-center h-full">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : measurements.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ChartBarIcon className="h-8 w-8 mb-2" />
              <p className="text-sm">No measurement data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Measurement History Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h5 className="text-sm font-medium text-gray-700">Measurement History</h5>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {loadingMeasurements ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : measurements.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Value</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Numerator</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Denominator</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {measurements.map((measurement) => {
                  const status = getPerformanceStatus(
                    measurement.value,
                    indicator.targetValue,
                    indicator.thresholdValue
                  );
                  return (
                    <tr key={measurement.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        {new Date(measurement.measurementDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {Number(measurement.value).toFixed(2)}{indicator.unit || '%'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {measurement.numerator || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {measurement.denominator || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', status.bg, status.color)}>
                          {status.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <DocumentTextIcon className="h-8 w-8 mb-2" />
              <p className="text-sm">No measurements recorded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 rounded-xl bg-white border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <ClockIcon className="h-4 w-4" />
            <span className="text-xs">Frequency</span>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {frequencyConfig[indicator.measurementFrequency]}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <BuildingOfficeIcon className="h-4 w-4" />
            <span className="text-xs">Data Source</span>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {indicator.dataSource || 'Not specified'}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <UserIcon className="h-4 w-4" />
            <span className="text-xs">Responsible</span>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {indicator.responsibleRole || 'Not assigned'}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <DocumentTextIcon className="h-4 w-4" />
            <span className="text-xs">Standard</span>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {indicator.standardReference ? standardConfig[indicator.standardReference]?.label : 'Not specified'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Indicator Card Component
function IndicatorCard({
  indicator,
  onEdit,
  onRecordMeasurement,
  isExpanded,
  onToggleExpand,
  onAnalyzeTrend,
}: {
  indicator: QualityIndicator;
  onEdit: () => void;
  onRecordMeasurement: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAnalyzeTrend: () => void;
}) {
  const categoryConf = categoryConfig[indicator.category];
  const performanceStatus = getPerformanceStatus(
    indicator.currentValue,
    indicator.targetValue,
    indicator.thresholdValue
  );

  // Calculate progress percentage
  const progressPercent = indicator.currentValue !== undefined
    ? Math.min(100, (indicator.currentValue / indicator.targetValue) * 100)
    : 0;

  // Trend icon
  const TrendIcon = indicator.trend === 'UP'
    ? ArrowTrendingUpIcon
    : indicator.trend === 'DOWN'
      ? ArrowTrendingDownIcon
      : MinusIcon;

  const trendColor = indicator.trend === 'UP'
    ? 'text-emerald-500'
    : indicator.trend === 'DOWN'
      ? 'text-rose-500'
      : 'text-gray-400';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
                {indicator.code}
              </span>
              <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', categoryConf.bg, categoryConf.color, categoryConf.border, 'border')}>
                {categoryConf.label}
              </span>
              {indicator.standardReference && (
                <span className={clsx('px-2 py-1 rounded-lg text-xs font-medium', standardConfig[indicator.standardReference]?.color)}>
                  {standardConfig[indicator.standardReference]?.label}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">{indicator.name}</h3>
            {indicator.description && (
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{indicator.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Performance Status Badge */}
            <div className={clsx('px-3 py-1.5 rounded-xl font-semibold text-sm flex items-center gap-1.5', performanceStatus.bg, performanceStatus.color, performanceStatus.border, 'border')}>
              {performanceStatus.status === 'MET' && <CheckCircleIcon className="h-4 w-4" />}
              {performanceStatus.status === 'WARNING' && <ExclamationTriangleIcon className="h-4 w-4" />}
              {performanceStatus.status === 'NOT_MET' && <XCircleIcon className="h-4 w-4" />}
              {performanceStatus.status}
            </div>
          </div>
        </div>

        {/* Value and Progress */}
        <div className="mt-5 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {indicator.currentValue !== undefined ? Number(indicator.currentValue).toFixed(1) : '--'}
                </span>
                <span className="text-lg text-gray-400">{indicator.unit || '%'}</span>
                {indicator.trend && (
                  <TrendIcon className={clsx('h-5 w-5', trendColor)} />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Target: {indicator.targetValue}{indicator.unit || '%'} | Threshold: {indicator.thresholdValue}{indicator.unit || '%'}
              </p>
            </div>
            {indicator.lastMeasuredAt && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <CalendarDaysIcon className="h-3.5 w-3.5" />
                  Last measured
                </div>
                <p className="text-sm text-gray-600">
                  {new Date(indicator.lastMeasuredAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                performanceStatus.status === 'MET' ? 'bg-emerald-500' :
                performanceStatus.status === 'WARNING' ? 'bg-amber-500' : 'bg-rose-500'
              )}
              style={{ width: `${progressPercent}%` }}
            />
            {/* Target line */}
            <div
              className="absolute inset-y-0 w-0.5 bg-gray-400"
              style={{ left: '100%' }}
            />
            {/* Threshold line */}
            <div
              className="absolute inset-y-0 w-0.5 bg-amber-400"
              style={{ left: `${(indicator.thresholdValue / indicator.targetValue) * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onRecordMeasurement}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
              Record
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <PencilSquareIcon className="h-4 w-4" />
              Edit
            </button>
          </div>
          <button
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUpIcon className="h-4 w-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDownIcon className="h-4 w-4" />
                Details
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Detail Panel */}
      {isExpanded && (
        <IndicatorDetailPanel
          indicator={indicator}
          onClose={onToggleExpand}
          onAnalyzeTrend={onAnalyzeTrend}
        />
      )}
    </div>
  );
}

// Main Component
export default function QualityIndicators({ indicators: propIndicators, onRefresh }: QualityIndicatorsProps) {
  // State
  const [indicators, setIndicators] = useState<QualityIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [expandedIndicatorId, setExpandedIndicatorId] = useState<string | null>(null);

  // Modal state
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<QualityIndicator | null>(null);

  // Fetch indicators
  useEffect(() => {
    if (propIndicators) {
      setIndicators(propIndicators);
      setLoading(false);
      return;
    }

    const fetchIndicators = async () => {
      try {
        setLoading(true);
        const response = await qualityApi.getIndicators({
          category: categoryFilter || undefined,
          isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
          type: typeFilter || undefined,
          search: search || undefined,
        });
        setIndicators(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch indicators:', error);
        toast.error('Failed to load quality indicators');
      } finally {
        setLoading(false);
      }
    };

    fetchIndicators();
  }, [propIndicators, categoryFilter, statusFilter, typeFilter, search]);

  // Filter indicators based on search
  const filteredIndicators = useMemo(() => {
    if (!search) return indicators;
    const searchLower = search.toLowerCase();
    return indicators.filter(
      (ind) =>
        ind.name.toLowerCase().includes(searchLower) ||
        ind.code.toLowerCase().includes(searchLower) ||
        ind.description?.toLowerCase().includes(searchLower)
    );
  }, [indicators, search]);

  // Handlers
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      // Re-fetch indicators
      setLoading(true);
      qualityApi.getIndicators({
        category: categoryFilter || undefined,
        isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        type: typeFilter || undefined,
      })
        .then((response) => {
          setIndicators(response.data.data || []);
        })
        .catch((error) => {
          console.error('Failed to fetch indicators:', error);
          toast.error('Failed to refresh indicators');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const handleAddIndicator = () => {
    setSelectedIndicator(null);
    setShowIndicatorModal(true);
  };

  const handleEditIndicator = (indicator: QualityIndicator) => {
    setSelectedIndicator(indicator);
    setShowIndicatorModal(true);
  };

  const handleRecordMeasurement = (indicator: QualityIndicator) => {
    setSelectedIndicator(indicator);
    setShowMeasurementModal(true);
  };

  const handleToggleExpand = (indicatorId: string) => {
    setExpandedIndicatorId(expandedIndicatorId === indicatorId ? null : indicatorId);
  };

  const handleAnalyzeTrend = (indicator: QualityIndicator) => {
    toast.promise(
      qualityApi.analyzeTrends({ indicatorId: indicator.id }),
      {
        loading: 'Analyzing trends with AI...',
        success: (response) => {
          const data = response.data?.data;
          // Show analysis results
          return `AI Analysis Complete: ${data?.summary || 'Trend analysis generated'}`;
        },
        error: 'Failed to analyze trends',
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Quality Indicators</h2>
          <p className="text-sm text-gray-500">Monitor and track quality performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={clsx('h-5 w-5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={handleAddIndicator}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5"
          >
            <PlusIcon className="h-5 w-5" />
            Add Indicator
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search indicators by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 placeholder-gray-400 transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <FunnelIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none w-full lg:w-48 pl-12 pr-10 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 cursor-pointer transition-all"
            >
              <option value="">All Categories</option>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none w-full lg:w-36 px-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 cursor-pointer transition-all"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none w-full lg:w-36 px-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 cursor-pointer transition-all"
            >
              <option value="">All Types</option>
              {Object.entries(typeConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Indicators Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          </div>
          <p className="mt-4 text-gray-500 animate-pulse">Loading quality indicators...</p>
        </div>
      ) : filteredIndicators.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
            <ChartBarIcon className="h-10 w-10 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No indicators found</h3>
          <p className="text-gray-500 mb-6">
            {search || categoryFilter || statusFilter || typeFilter
              ? 'Try adjusting your filters'
              : 'Create your first quality indicator to get started'}
          </p>
          {!search && !categoryFilter && !statusFilter && !typeFilter && (
            <button
              onClick={handleAddIndicator}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
            >
              <PlusIcon className="h-5 w-5" />
              Add Indicator
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredIndicators.map((indicator) => (
            <IndicatorCard
              key={indicator.id}
              indicator={indicator}
              onEdit={() => handleEditIndicator(indicator)}
              onRecordMeasurement={() => handleRecordMeasurement(indicator)}
              isExpanded={expandedIndicatorId === indicator.id}
              onToggleExpand={() => handleToggleExpand(indicator.id)}
              onAnalyzeTrend={() => handleAnalyzeTrend(indicator)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <IndicatorModal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        indicator={selectedIndicator}
        onSuccess={handleRefresh}
      />

      <MeasurementModal
        isOpen={showMeasurementModal}
        onClose={() => setShowMeasurementModal(false)}
        indicator={selectedIndicator}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
