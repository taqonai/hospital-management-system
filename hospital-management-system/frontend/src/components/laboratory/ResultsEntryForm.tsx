import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { laboratoryApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ResultParameter {
  name: string;
  value: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceRange?: string;
  notes?: string;
}

interface ResultsEntryFormData {
  parameters: ResultParameter[];
  overallNotes?: string;
}

interface ResultsEntryFormProps {
  testId: string;
  testName: string;
  patientName?: string;
  onSuccess: () => void;
  onCancel: () => void;
  defaultParameters?: ResultParameter[];
}

type ResultStatus = 'normal' | 'abnormal' | 'critical';

const calculateResultStatus = (
  value: string,
  referenceMin?: number,
  referenceMax?: number
): ResultStatus => {
  const numericValue = parseFloat(value);

  if (isNaN(numericValue) || referenceMin === undefined || referenceMax === undefined) {
    return 'normal';
  }

  const range = referenceMax - referenceMin;
  const criticalLow = referenceMin - range * 0.5;
  const criticalHigh = referenceMax + range * 0.5;

  if (numericValue < criticalLow || numericValue > criticalHigh) {
    return 'critical';
  }

  if (numericValue < referenceMin || numericValue > referenceMax) {
    return 'abnormal';
  }

  return 'normal';
};

const getStatusConfig = (status: ResultStatus) => {
  switch (status) {
    case 'critical':
      return {
        bg: 'bg-rose-50 dark:bg-rose-900/20',
        border: 'border-rose-500',
        text: 'text-rose-700 dark:text-rose-300',
        icon: XCircleIcon,
        iconColor: 'text-rose-500',
        label: 'Critical',
      };
    case 'abnormal':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-500',
        text: 'text-amber-700 dark:text-amber-300',
        icon: ExclamationTriangleIcon,
        iconColor: 'text-amber-500',
        label: 'Abnormal',
      };
    case 'normal':
    default:
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        border: 'border-emerald-500',
        text: 'text-emerald-700 dark:text-emerald-300',
        icon: CheckCircleIcon,
        iconColor: 'text-emerald-500',
        label: 'Normal',
      };
  }
};

export default function ResultsEntryForm({
  testId,
  testName,
  patientName,
  onSuccess,
  onCancel,
  defaultParameters = [
    { name: '', value: '', unit: '', referenceRange: '' },
  ],
}: ResultsEntryFormProps) {
  const [parameters, setParameters] = useState<ResultParameter[]>(
    // Initialize with test name pre-filled
    [{ name: testName, value: '', unit: '', referenceRange: '' }]
  );
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [overallNotes, setOverallNotes] = useState('');
  const [clinicalContext, setClinicalContext] = useState<any>(null);
  const [existingResult, setExistingResult] = useState<any>(null);

  // Load existing result data if available
  useEffect(() => {
    const loadExistingResult = async () => {
      try {
        const orders = await laboratoryApi.getOrders({ limit: 100 });
        // Find the test in the orders
        for (const order of orders.data.data || []) {
          const test = order.tests?.find((t: any) => t.id === testId);
          if (test && test.result) {
            setExistingResult(test);
            // Pre-fill form with existing data
            setParameters([{
              name: testName,
              value: test.resultValue?.toString() || test.result || '',
              unit: test.unit || '',
              referenceRange: test.normalRange || '',
              notes: test.comments || '',
            }]);
            setOverallNotes(test.comments || '');
            break;
          }
        }
      } catch (error) {
        console.error('Failed to load existing result:', error);
      }
    };

    loadExistingResult();
  }, [testId, testName]);

  const {
    formState: { errors },
  } = useForm<ResultsEntryFormData>();

  const addParameter = () => {
    setParameters([
      ...parameters,
      { name: '', value: '', unit: '', referenceRange: '' },
    ]);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, field: keyof ResultParameter, value: string | number) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  const parseReferenceRange = (rangeString: string): { min?: number; max?: number } => {
    const match = rangeString.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    if (match) {
      return {
        min: parseFloat(match[1]),
        max: parseFloat(match[2]),
      };
    }
    return {};
  };

  const handleGenerateContext = async () => {
    if (!existingResult) {
      toast.error('Please save results first before generating clinical context');
      return;
    }

    setLoadingContext(true);
    try {
      const response = await laboratoryApi.getClinicalContext(testId);
      if (response.data.success) {
        setClinicalContext(response.data);
        toast.success('Clinical context generated');
      } else {
        toast.error(response.data.error || 'Failed to generate context');
      }
    } catch (error: any) {
      console.error('Failed to generate clinical context:', error);
      toast.error('Failed to generate clinical context');
    } finally {
      setLoadingContext(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For simplicity, use the first parameter as the main result
    const mainParam = parameters[0];
    if (!mainParam || !mainParam.value) {
      toast.error('Please enter a result value');
      return;
    }

    setLoading(true);
    try {
      // Calculate flags based on reference range
      const { min, max } = parseReferenceRange(mainParam.referenceRange || '');
      const status = calculateResultStatus(mainParam.value, min, max);

      await laboratoryApi.enterResult(testId, {
        result: mainParam.value,
        resultValue: parseFloat(mainParam.value) || undefined,
        unit: mainParam.unit || undefined,
        normalRange: mainParam.referenceRange || undefined,
        isAbnormal: status === 'abnormal' || status === 'critical',
        isCritical: status === 'critical',
        comments: overallNotes || mainParam.notes || undefined,
      });

      const hasCritical = status === 'critical';
      const hasAbnormal = status === 'abnormal';

      if (hasCritical) {
        toast.error('Critical values detected! Results submitted and flagged for immediate review.');
      } else if (hasAbnormal) {
        toast((t) => (
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
            <span>Abnormal values detected. Results submitted successfully.</span>
          </div>
        ));
      } else {
        toast.success('Results entered successfully');
      }

      // Reload to get the saved result
      setExistingResult({ result: mainParam.value, resultValue: parseFloat(mainParam.value), unit: mainParam.unit });

      // Don't close immediately - allow viewing/generating context
      // onSuccess();
    } catch (error: any) {
      console.error('Failed to enter results:', error);
      toast.error(error.response?.data?.message || 'Failed to enter results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
            <BeakerIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Enter Test Results</h2>
            <p className="text-white/80 text-sm">
              {testName} {patientName && `for ${patientName}`}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Parameters */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Test Parameters <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={addParameter}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add Parameter
            </button>
          </div>

          {parameters.map((param, index) => {
            const { min, max } = parseReferenceRange(param.referenceRange || '');
            const status = param.value ? calculateResultStatus(param.value, min, max) : 'normal';
            const statusConfig = getStatusConfig(status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={index}
                className={clsx(
                  'border-2 rounded-xl p-4 space-y-3 transition-all',
                  param.value && status !== 'normal' ? statusConfig.border : 'border-gray-200'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Parameter Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Parameter Name
                      </label>
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) => updateParameter(index, 'name', e.target.value)}
                        placeholder="e.g., Hemoglobin"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                    </div>

                    {/* Result Value */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Result Value
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={param.value}
                          onChange={(e) => updateParameter(index, 'value', e.target.value)}
                          placeholder="e.g., 14.5"
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={param.unit}
                          onChange={(e) => updateParameter(index, 'unit', e.target.value)}
                          placeholder="Unit"
                          className="w-24 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Reference Range */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Reference Range
                      </label>
                      <input
                        type="text"
                        value={param.referenceRange || ''}
                        onChange={(e) => updateParameter(index, 'referenceRange', e.target.value)}
                        placeholder="e.g., 12.0 - 16.0"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={param.notes || ''}
                        onChange={(e) => updateParameter(index, 'notes', e.target.value)}
                        placeholder="Additional notes"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  {parameters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeParameter(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove parameter"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Status Indicator */}
                {param.value && status !== 'normal' && (
                  <div className={clsx('flex items-center gap-2 p-2 rounded-lg', statusConfig.bg)}>
                    <StatusIcon className={clsx('h-5 w-5', statusConfig.iconColor)} />
                    <span className={clsx('text-sm font-semibold', statusConfig.text)}>
                      {statusConfig.label} - {status === 'critical' ? 'Immediate attention required' : 'Out of reference range'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Overall Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Notes (Optional)
          </label>
          <textarea
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            placeholder="General observations, test conditions, or interpretation notes..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Summary of Abnormalities */}
        {parameters.some(p => {
          if (!p.value) return false;
          const { min, max } = parseReferenceRange(p.referenceRange || '');
          const status = calculateResultStatus(p.value, min, max);
          return status !== 'normal';
        }) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-800 mb-2">Abnormal Values Detected</h4>
                <ul className="space-y-1 text-sm text-amber-700">
                  {parameters.map((param, index) => {
                    if (!param.value) return null;
                    const { min, max } = parseReferenceRange(param.referenceRange || '');
                    const status = calculateResultStatus(param.value, min, max);
                    if (status === 'normal') return null;

                    return (
                      <li key={index}>
                        <span className="font-medium">{param.name}:</span> {param.value} {param.unit}
                        {status === 'critical' && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-bold text-rose-700 bg-rose-100 rounded-full">
                            CRITICAL
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Clinical Context Section (for doctors/nurses) */}
        {existingResult && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-purple-900">AI Clinical Context</h4>
              </div>
              <button
                type="button"
                onClick={handleGenerateContext}
                disabled={loadingContext}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingContext ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4" />
                    Generate Context
                  </>
                )}
              </button>
            </div>

            {clinicalContext ? (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Clinical Interpretation</h5>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {clinicalContext.clinicalContext}
                  </p>
                </div>

                {clinicalContext.recommendations && clinicalContext.recommendations.length > 0 && (
                  <div className="bg-white rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Recommendations</h5>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-900">
                      {clinicalContext.recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {clinicalContext.concerns && clinicalContext.concerns.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      Clinical Concerns
                    </h5>
                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-900">
                      {clinicalContext.concerns.map((concern: string, idx: number) => (
                        <li key={idx}>{concern}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {clinicalContext.followUpNeeded && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                    <strong>Follow-up Recommended:</strong> This result requires additional monitoring or testing.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">
                Click "Generate Context" to get AI-powered clinical interpretation for doctors and nurses.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            {existingResult ? 'Close' : 'Cancel'}
          </button>
          {!existingResult || parameters[0]?.value !== existingResult.resultValue?.toString() ? (
            <button
              type="submit"
              disabled={loading || parameters.filter(p => p.name && p.value).length === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  {existingResult ? 'Update Results' : 'Submit Results'}
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSuccess}
              className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-all flex items-center gap-2"
            >
              <CheckCircleIcon className="h-5 w-5" />
              Done
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
