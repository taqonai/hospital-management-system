import { useState, useEffect } from 'react';
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

interface TestResult {
  testId: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  comments: string;
  labTestInfo?: any; // Lab test metadata (unit, normalRange from labTest)
}

interface ResultsEntryFormProps {
  orderId: string;
  testId: string; // Kept for compatibility, but we'll load all tests
  testName: string;
  patientName?: string;
  onSuccess: () => void;
  onCancel: () => void;
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

const getStatusConfig = (status: ResultStatus) => {
  switch (status) {
    case 'critical':
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-500',
        text: 'text-rose-700',
        icon: XCircleIcon,
        iconColor: 'text-rose-500',
        label: 'Critical',
      };
    case 'abnormal':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-500',
        text: 'text-amber-700',
        icon: ExclamationTriangleIcon,
        iconColor: 'text-amber-500',
        label: 'Abnormal',
      };
    case 'normal':
    default:
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-500',
        text: 'text-emerald-700',
        icon: CheckCircleIcon,
        iconColor: 'text-emerald-500',
        label: 'Normal',
      };
  }
};

export default function ResultsEntryForm({
  orderId,
  patientName,
  onSuccess,
  onCancel,
}: ResultsEntryFormProps) {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allSaved, setAllSaved] = useState(false);

  // Load all tests from the order
  useEffect(() => {
    const loadTests = async () => {
      try {
        setLoading(true);
        const response = await laboratoryApi.getOrderById(orderId);
        const order = response.data.data;

        // Map all tests to our test result structure
        const testResults: TestResult[] = (order.tests || []).map((test: any) => ({
          testId: test.id,
          testName: test.labTest?.name || 'Unknown Test',
          value: test.resultValue?.toString() || test.result || '',
          unit: test.unit || test.labTest?.unit || '',
          referenceRange: test.normalRange || test.labTest?.normalRange || '',
          comments: test.comments || '',
          labTestInfo: test.labTest,
        }));

        setTests(testResults);

        // Check if all tests already have results
        const allHaveResults = testResults.every(t => t.value);
        setAllSaved(allHaveResults);
      } catch (error) {
        console.error('Failed to load tests:', error);
        toast.error('Failed to load test information');
      } finally {
        setLoading(false);
      }
    };

    loadTests();
  }, [orderId]);

  const updateTestValue = (index: number, field: keyof TestResult, value: string) => {
    const updated = [...tests];
    updated[index] = { ...updated[index], [field]: value };
    setTests(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least one test has a value
    const testsWithValues = tests.filter(t => t.value.trim());
    if (testsWithValues.length === 0) {
      toast.error('Please enter results for at least one test');
      return;
    }

    setSaving(true);
    try {
      // Save each test result
      const savePromises = testsWithValues.map(async (test) => {
        const { min, max } = parseReferenceRange(test.referenceRange);
        const status = calculateResultStatus(test.value, min, max);

        return laboratoryApi.enterResult(test.testId, {
          result: test.value,
          resultValue: parseFloat(test.value) || undefined,
          unit: test.unit || undefined,
          normalRange: test.referenceRange || undefined,
          isAbnormal: status === 'abnormal' || status === 'critical',
          isCritical: status === 'critical',
          comments: test.comments || undefined,
        });
      });

      await Promise.all(savePromises);

      // Check for critical or abnormal values
      const hasCritical = testsWithValues.some(test => {
        const { min, max } = parseReferenceRange(test.referenceRange);
        return calculateResultStatus(test.value, min, max) === 'critical';
      });

      const hasAbnormal = testsWithValues.some(test => {
        const { min, max } = parseReferenceRange(test.referenceRange);
        const status = calculateResultStatus(test.value, min, max);
        return status === 'abnormal' || status === 'critical';
      });

      if (hasCritical) {
        toast.error(`Results saved! ${testsWithValues.length} test(s) with CRITICAL values flagged for immediate review.`);
      } else if (hasAbnormal) {
        toast((t) => (
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
            <span>Results saved! {testsWithValues.length} test(s) with abnormal values detected.</span>
          </div>
        ));
      } else {
        toast.success(`All ${testsWithValues.length} test results saved successfully!`);
      }

      setAllSaved(true);
    } catch (error: any) {
      console.error('Failed to save results:', error);
      toast.error(error.response?.data?.message || 'Failed to save results');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <ArrowPathIcon className="h-12 w-12 animate-spin text-blue-500" />
          <p className="text-gray-500">Loading tests...</p>
        </div>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden p-12">
        <div className="text-center">
          <BeakerIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No tests found in this order</p>
          <button
            onClick={onCancel}
            className="mt-4 px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
            <BeakerIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Enter Lab Results - {tests.length} Test{tests.length !== 1 ? 's' : ''}
            </h2>
            <p className="text-white/80 text-sm">
              {patientName && `Patient: ${patientName}`}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Test Results Section */}
          {tests.map((test, index) => {
            const { min, max } = parseReferenceRange(test.referenceRange);
            const status = test.value ? calculateResultStatus(test.value, min, max) : 'normal';
            const statusConfig = getStatusConfig(status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={test.testId}
                className={clsx(
                  'border-2 rounded-xl p-5 space-y-4 transition-all',
                  test.value && status !== 'normal' ? statusConfig.border : 'border-gray-200'
                )}
              >
                {/* Test Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {index + 1}. {test.testName}
                  </h3>
                  {test.value && status !== 'normal' && (
                    <div className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg', statusConfig.bg)}>
                      <StatusIcon className={clsx('h-5 w-5', statusConfig.iconColor)} />
                      <span className={clsx('text-sm font-semibold', statusConfig.text)}>
                        {statusConfig.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Result Value and Unit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Result Value <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={test.value}
                        onChange={(e) => updateTestValue(index, 'value', e.target.value)}
                        placeholder="e.g., 14.5"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={test.unit}
                        onChange={(e) => updateTestValue(index, 'unit', e.target.value)}
                        placeholder="Unit"
                        className="w-28 px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Reference Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reference Range
                    </label>
                    <input
                      type="text"
                      value={test.referenceRange}
                      onChange={(e) => updateTestValue(index, 'referenceRange', e.target.value)}
                      placeholder="e.g., 12.0 - 16.0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Comments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comments (Optional)
                  </label>
                  <textarea
                    value={test.comments}
                    onChange={(e) => updateTestValue(index, 'comments', e.target.value)}
                    placeholder="Any observations or notes for this test..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Status Warning */}
                {test.value && status !== 'normal' && (
                  <div className={clsx('flex items-start gap-3 p-3 rounded-lg', statusConfig.bg)}>
                    <StatusIcon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', statusConfig.iconColor)} />
                    <p className={clsx('text-sm font-medium', statusConfig.text)}>
                      {status === 'critical'
                        ? 'CRITICAL value detected! This result will be flagged for immediate physician review.'
                        : 'Result is outside the normal reference range.'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Summary */}
          {tests.some(t => {
            if (!t.value) return false;
            const { min, max } = parseReferenceRange(t.referenceRange);
            return calculateResultStatus(t.value, min, max) !== 'normal';
          }) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-800 mb-2">Summary of Abnormal Results</h4>
                  <ul className="space-y-1.5 text-sm text-amber-700">
                    {tests.map((test, index) => {
                      if (!test.value) return null;
                      const { min, max } = parseReferenceRange(test.referenceRange);
                      const status = calculateResultStatus(test.value, min, max);
                      if (status === 'normal') return null;

                      return (
                        <li key={index} className="flex items-center gap-2">
                          <span className="font-medium">{test.testName}:</span>
                          <span>{test.value} {test.unit}</span>
                          {status === 'critical' && (
                            <span className="px-2 py-0.5 text-xs font-bold text-rose-700 bg-rose-100 rounded-full">
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
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={allSaved ? onSuccess : onCancel}
            className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            {allSaved ? 'Done' : 'Cancel'}
          </button>
          {!allSaved || tests.some(t => t.value) ? (
            <button
              type="submit"
              disabled={saving || tests.every(t => !t.value.trim())}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  {allSaved ? 'Update Results' : 'Save All Results'}
                </>
              )}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
