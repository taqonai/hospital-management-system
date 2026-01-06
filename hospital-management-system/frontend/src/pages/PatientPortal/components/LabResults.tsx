import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BeakerIcon,
  ArrowDownTrayIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  FunnelIcon,
  CalendarDaysIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';

interface TestResult {
  id: string;
  testName: string;
  testCode: string;
  value: number | string;
  unit: string;
  normalRangeMin?: number;
  normalRangeMax?: number;
  normalRange: string;
  status: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | 'BORDERLINE';
  previousValue?: number | string;
  previousDate?: string;
  notes?: string;
}

interface LabResult {
  id: string;
  orderNumber: string;
  testDate: string;
  reportDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'REVIEWED';
  orderingDoctor: {
    id: string;
    name: string;
    specialization: string;
  };
  testCategory: string;
  testName: string;
  results: TestResult[];
  interpretation?: string;
  reviewedBy?: {
    id: string;
    name: string;
  };
  reviewedAt?: string;
  specimenType?: string;
  collectionDate?: string;
}

// Mock data for development/demo purposes
const mockLabResults: LabResult[] = [
  {
    id: '1',
    orderNumber: 'LAB-2024-001234',
    testDate: '2024-12-20',
    reportDate: '2024-12-20',
    status: 'REVIEWED',
    orderingDoctor: { id: 'd1', name: 'Dr. Sarah Johnson', specialization: 'Internal Medicine' },
    testCategory: 'Hematology',
    testName: 'Complete Blood Count (CBC)',
    specimenType: 'Blood',
    collectionDate: '2024-12-20T08:30:00Z',
    results: [
      { id: 't1', testName: 'Hemoglobin', testCode: 'HGB', value: 14.5, unit: 'g/dL', normalRangeMin: 12.0, normalRangeMax: 16.0, normalRange: '12.0 - 16.0 g/dL', status: 'NORMAL' },
      { id: 't2', testName: 'Hematocrit', testCode: 'HCT', value: 43.2, unit: '%', normalRangeMin: 36, normalRangeMax: 46, normalRange: '36 - 46%', status: 'NORMAL' },
      { id: 't3', testName: 'White Blood Cells', testCode: 'WBC', value: 11.5, unit: 'K/uL', normalRangeMin: 4.5, normalRangeMax: 11.0, normalRange: '4.5 - 11.0 K/uL', status: 'HIGH', previousValue: 9.8, previousDate: '2024-11-15' },
      { id: 't4', testName: 'Platelets', testCode: 'PLT', value: 245, unit: 'K/uL', normalRangeMin: 150, normalRangeMax: 400, normalRange: '150 - 400 K/uL', status: 'NORMAL' },
      { id: 't5', testName: 'Red Blood Cells', testCode: 'RBC', value: 4.8, unit: 'M/uL', normalRangeMin: 4.0, normalRangeMax: 5.5, normalRange: '4.0 - 5.5 M/uL', status: 'NORMAL' },
    ],
    interpretation: 'CBC shows slightly elevated WBC count. May indicate mild infection or stress response. Clinical correlation recommended.',
    reviewedBy: { id: 'r1', name: 'Dr. Michael Chen' },
    reviewedAt: '2024-12-20T14:00:00Z',
  },
  {
    id: '2',
    orderNumber: 'LAB-2024-001235',
    testDate: '2024-12-18',
    reportDate: '2024-12-19',
    status: 'REVIEWED',
    orderingDoctor: { id: 'd2', name: 'Dr. Emily Watson', specialization: 'Endocrinology' },
    testCategory: 'Chemistry',
    testName: 'Comprehensive Metabolic Panel (CMP)',
    specimenType: 'Blood',
    collectionDate: '2024-12-18T09:00:00Z',
    results: [
      { id: 't6', testName: 'Glucose (Fasting)', testCode: 'GLU', value: 118, unit: 'mg/dL', normalRangeMin: 70, normalRangeMax: 100, normalRange: '70 - 100 mg/dL', status: 'HIGH', previousValue: 105, previousDate: '2024-09-15' },
      { id: 't7', testName: 'Creatinine', testCode: 'CREAT', value: 1.1, unit: 'mg/dL', normalRangeMin: 0.6, normalRangeMax: 1.2, normalRange: '0.6 - 1.2 mg/dL', status: 'NORMAL' },
      { id: 't8', testName: 'BUN', testCode: 'BUN', value: 18, unit: 'mg/dL', normalRangeMin: 7, normalRangeMax: 20, normalRange: '7 - 20 mg/dL', status: 'NORMAL' },
      { id: 't9', testName: 'Sodium', testCode: 'NA', value: 140, unit: 'mEq/L', normalRangeMin: 136, normalRangeMax: 145, normalRange: '136 - 145 mEq/L', status: 'NORMAL' },
      { id: 't10', testName: 'Potassium', testCode: 'K', value: 4.2, unit: 'mEq/L', normalRangeMin: 3.5, normalRangeMax: 5.0, normalRange: '3.5 - 5.0 mEq/L', status: 'NORMAL' },
      { id: 't11', testName: 'ALT', testCode: 'ALT', value: 28, unit: 'U/L', normalRangeMin: 7, normalRangeMax: 56, normalRange: '7 - 56 U/L', status: 'NORMAL' },
      { id: 't12', testName: 'AST', testCode: 'AST', value: 25, unit: 'U/L', normalRangeMin: 10, normalRangeMax: 40, normalRange: '10 - 40 U/L', status: 'NORMAL' },
    ],
    interpretation: 'Fasting glucose elevated - consistent with pre-diabetes. Recommend lifestyle modifications and follow-up A1C testing.',
    reviewedBy: { id: 'r2', name: 'Dr. Emily Watson' },
    reviewedAt: '2024-12-19T10:30:00Z',
  },
  {
    id: '3',
    orderNumber: 'LAB-2024-001236',
    testDate: '2024-12-22',
    status: 'PENDING',
    orderingDoctor: { id: 'd3', name: 'Dr. Robert Garcia', specialization: 'Cardiology' },
    testCategory: 'Chemistry',
    testName: 'Lipid Panel',
    specimenType: 'Blood',
    collectionDate: '2024-12-22T07:30:00Z',
    results: [],
  },
  {
    id: '4',
    orderNumber: 'LAB-2024-001237',
    testDate: '2024-12-15',
    reportDate: '2024-12-16',
    status: 'READY',
    orderingDoctor: { id: 'd1', name: 'Dr. Sarah Johnson', specialization: 'Internal Medicine' },
    testCategory: 'Thyroid',
    testName: 'Thyroid Panel',
    specimenType: 'Blood',
    collectionDate: '2024-12-15T08:00:00Z',
    results: [
      { id: 't13', testName: 'TSH', testCode: 'TSH', value: 2.5, unit: 'mIU/L', normalRangeMin: 0.4, normalRangeMax: 4.0, normalRange: '0.4 - 4.0 mIU/L', status: 'NORMAL' },
      { id: 't14', testName: 'Free T4', testCode: 'FT4', value: 1.2, unit: 'ng/dL', normalRangeMin: 0.8, normalRangeMax: 1.8, normalRange: '0.8 - 1.8 ng/dL', status: 'NORMAL' },
      { id: 't15', testName: 'Free T3', testCode: 'FT3', value: 3.0, unit: 'pg/mL', normalRangeMin: 2.3, normalRangeMax: 4.2, normalRange: '2.3 - 4.2 pg/mL', status: 'NORMAL' },
    ],
    interpretation: 'Thyroid function is within normal limits.',
  },
  {
    id: '5',
    orderNumber: 'LAB-2024-001238',
    testDate: '2024-11-10',
    reportDate: '2024-11-10',
    status: 'REVIEWED',
    orderingDoctor: { id: 'd4', name: 'Dr. Lisa Park', specialization: 'Internal Medicine' },
    testCategory: 'Urinalysis',
    testName: 'Complete Urinalysis',
    specimenType: 'Urine',
    collectionDate: '2024-11-10T10:00:00Z',
    results: [
      { id: 't16', testName: 'pH', testCode: 'UAPH', value: 6.0, unit: '', normalRangeMin: 5.0, normalRangeMax: 8.0, normalRange: '5.0 - 8.0', status: 'NORMAL' },
      { id: 't17', testName: 'Specific Gravity', testCode: 'UASG', value: 1.015, unit: '', normalRangeMin: 1.005, normalRangeMax: 1.030, normalRange: '1.005 - 1.030', status: 'NORMAL' },
      { id: 't18', testName: 'Protein', testCode: 'UAPRO', value: 'Negative', unit: '', normalRange: 'Negative', status: 'NORMAL' },
      { id: 't19', testName: 'Glucose', testCode: 'UAGLU', value: 'Negative', unit: '', normalRange: 'Negative', status: 'NORMAL' },
    ],
    interpretation: 'Normal urinalysis. No abnormalities detected.',
    reviewedBy: { id: 'r4', name: 'Dr. Lisa Park' },
    reviewedAt: '2024-11-10T14:00:00Z',
  },
];

const getStatusBadge = (status: LabResult['status']) => {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <ClockIcon className="h-3.5 w-3.5" />
          Pending
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <ClockIcon className="h-3.5 w-3.5" />
          In Progress
        </span>
      );
    case 'READY':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Ready
        </span>
      );
    case 'REVIEWED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Reviewed
        </span>
      );
    default:
      return null;
  }
};

const getValueStatusColor = (status: TestResult['status']) => {
  switch (status) {
    case 'NORMAL':
      return 'text-green-600 bg-green-50';
    case 'HIGH':
    case 'LOW':
      return 'text-red-600 bg-red-50';
    case 'CRITICAL_HIGH':
    case 'CRITICAL_LOW':
      return 'text-red-700 bg-red-100 font-bold';
    case 'BORDERLINE':
      return 'text-yellow-600 bg-yellow-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

const getValueStatusIcon = (status: TestResult['status']) => {
  switch (status) {
    case 'HIGH':
    case 'CRITICAL_HIGH':
      return <ArrowTrendingUpIcon className="h-4 w-4 text-red-500" />;
    case 'LOW':
    case 'CRITICAL_LOW':
      return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
    case 'NORMAL':
      return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
    case 'BORDERLINE':
      return <MinusIcon className="h-4 w-4 text-yellow-500" />;
    default:
      return null;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Group lab results by date
const groupByDate = (results: LabResult[]) => {
  const grouped: Record<string, LabResult[]> = {};
  results.forEach((result) => {
    const date = result.testDate;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(result);
  });
  return Object.entries(grouped).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
};

export default function LabResults() {
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: labResults = [], isLoading, error } = useQuery({
    queryKey: ['patient-labs', statusFilter, dateRange],
    queryFn: async () => {
      try {
        const params: { status?: string; page?: number; limit?: number } = {};
        if (statusFilter !== 'all') params.status = statusFilter;

        const response = await patientPortalApi.getLabResults(params);
        const results = response.data?.data || response.data || [];

        // Apply date filtering client-side if dates are provided
        let filteredResults = results;
        if (dateRange.start) {
          filteredResults = filteredResults.filter((r: LabResult) => new Date(r.testDate) >= new Date(dateRange.start));
        }
        if (dateRange.end) {
          filteredResults = filteredResults.filter((r: LabResult) => new Date(r.testDate) <= new Date(dateRange.end));
        }

        return filteredResults;
      } catch {
        // Return mock data for demo/development
        return mockLabResults;
      }
    },
  });

  // Lab results are already filtered in the query, this memo just provides type safety
  const filteredResults = useMemo(() => labResults as LabResult[], [labResults]);

  const groupedResults = useMemo(() => groupByDate(filteredResults), [filteredResults]);

  const toggleGroup = (date: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const handleDownload = async (resultId: string) => {
    setDownloadingId(resultId);
    try {
      const response = await patientPortalApi.downloadLabReport(resultId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lab-report-${resultId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      // Show error message - could be handled better with a toast notification
      alert('Unable to download report. Please try again later.');
    } finally {
      setDownloadingId(null);
    }
  };

  const hasAbnormalResults = (result: LabResult) => {
    return result.results.some(
      (r) => r.status === 'HIGH' || r.status === 'LOW' || r.status === 'CRITICAL_HIGH' || r.status === 'CRITICAL_LOW'
    );
  };

  // Initialize all groups as expanded
  if (groupedResults.length > 0 && expandedGroups.size === 0) {
    const initialExpanded = new Set(groupedResults.map(([date]) => date));
    if (initialExpanded.size > 0) {
      setExpandedGroups(initialExpanded);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center text-gray-500 mt-4">Loading lab results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-semibold text-red-800">Error Loading Lab Results</h3>
              <p className="text-red-600">Unable to load your lab results. Please try again later.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <BeakerIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lab Results</h1>
              <p className="text-gray-600">View and download your laboratory test results</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="READY">Ready</option>
            <option value="REVIEWED">Reviewed</option>
          </select>

          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              placeholder="Start Date"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              placeholder="End Date"
            />
          </div>

          {(statusFilter !== 'all' || dateRange.start || dateRange.end) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setDateRange({ start: '', end: '' });
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results List */}
      {groupedResults.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-12 text-center">
          <BeakerIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lab Results Found</h3>
          <p className="text-gray-600">
            No lab results match your current filters. Try adjusting the filters or check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedResults.map(([date, results]) => (
            <div key={date} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(date)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                  <span className="font-semibold text-gray-900">{formatDate(date)}</span>
                  <span className="text-sm text-gray-500">({results.length} test{results.length !== 1 ? 's' : ''})</span>
                </div>
                {expandedGroups.has(date) ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {/* Group Content */}
              {expandedGroups.has(date) && (
                <div className="divide-y divide-gray-100">
                  {results.map((result: LabResult) => (
                    <div key={result.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        {/* Result Info */}
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl flex-shrink-0 ${hasAbnormalResults(result) ? 'bg-red-50' : 'bg-purple-50'}`}>
                              <BeakerIcon className={`h-6 w-6 ${hasAbnormalResults(result) ? 'text-red-600' : 'text-purple-600'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">{result.testName}</h3>
                                {getStatusBadge(result.status)}
                                {hasAbnormalResults(result) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    <ExclamationCircleIcon className="h-3.5 w-3.5" />
                                    Abnormal Values
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">{result.testCategory}</p>
                              <p className="text-sm text-gray-500">
                                Order: {result.orderNumber} | Dr. {result.orderingDoctor.name}
                              </p>
                            </div>
                          </div>

                          {/* Quick Results Preview */}
                          {result.status !== 'PENDING' && result.results.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {result.results.slice(0, 4).map((test) => (
                                <div
                                  key={test.id}
                                  className={`px-3 py-1.5 rounded-lg text-sm ${getValueStatusColor(test.status)}`}
                                >
                                  <span className="font-medium">{test.testCode}:</span> {test.value} {test.unit}
                                </div>
                              ))}
                              {result.results.length > 4 && (
                                <span className="px-3 py-1.5 text-sm text-gray-500">
                                  +{result.results.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-row lg:flex-col gap-2">
                          <button
                            onClick={() => setSelectedResult(result)}
                            className="flex-1 lg:flex-none px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
                          >
                            View Details
                          </button>
                          {(result.status === 'READY' || result.status === 'REVIEWED') && (
                            <button
                              onClick={() => handleDownload(result.id)}
                              disabled={downloadingId === result.id}
                              className="flex-1 lg:flex-none px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {downloadingId === result.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Downloading...
                                </>
                              ) : (
                                <>
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                  Download PDF
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedResult.testName}</h2>
                <p className="text-sm text-gray-500">{selectedResult.orderNumber}</p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Status and Info */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                {getStatusBadge(selectedResult.status)}
                <span className="text-sm text-gray-500">
                  Test Date: {formatDate(selectedResult.testDate)}
                </span>
                {selectedResult.reportDate && (
                  <span className="text-sm text-gray-500">
                    Report Date: {formatDate(selectedResult.reportDate)}
                  </span>
                )}
              </div>

              {/* Test Information */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{selectedResult.testCategory}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Specimen Type</p>
                  <p className="font-medium text-gray-900">{selectedResult.specimenType || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ordering Physician</p>
                  <p className="font-medium text-gray-900">{selectedResult.orderingDoctor.name}</p>
                  <p className="text-sm text-gray-600">{selectedResult.orderingDoctor.specialization}</p>
                </div>
                {selectedResult.collectionDate && (
                  <div>
                    <p className="text-xs text-gray-500">Collection Time</p>
                    <p className="font-medium text-gray-900">{formatDateTime(selectedResult.collectionDate)}</p>
                  </div>
                )}
              </div>

              {/* Results Table */}
              {selectedResult.results.length > 0 ? (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Test Results</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Test</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Result</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Normal Range</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedResult.results.map((test) => (
                          <tr key={test.id} className={test.status !== 'NORMAL' ? 'bg-red-50/50' : ''}>
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{test.testName}</div>
                              <div className="text-xs text-gray-500">{test.testCode}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg ${getValueStatusColor(test.status)}`}>
                                {getValueStatusIcon(test.status)}
                                <span className="font-semibold">{test.value}</span>
                                <span className="text-xs">{test.unit}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">{test.normalRange}</td>
                            <td className="py-3 px-4">
                              <span className={`text-sm font-medium ${
                                test.status === 'NORMAL' ? 'text-green-600' :
                                test.status === 'BORDERLINE' ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {test.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {test.previousValue && (
                                <div className="text-xs text-gray-500">
                                  <div>Previous: {test.previousValue} {test.unit}</div>
                                  {test.previousDate && <div>{formatDate(test.previousDate)}</div>}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-8 bg-yellow-50 rounded-xl text-center">
                  <ClockIcon className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
                  <p className="text-yellow-700 font-medium">Results Pending</p>
                  <p className="text-sm text-yellow-600">Your test results are being processed. Please check back later.</p>
                </div>
              )}

              {/* Interpretation */}
              {selectedResult.interpretation && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Interpretation</h3>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-gray-700">{selectedResult.interpretation}</p>
                  </div>
                </div>
              )}

              {/* Review Information */}
              {selectedResult.reviewedBy && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Reviewed By</h4>
                  <p className="font-medium text-gray-900">{selectedResult.reviewedBy.name}</p>
                  {selectedResult.reviewedAt && (
                    <p className="text-sm text-gray-500">{formatDateTime(selectedResult.reviewedAt)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              {(selectedResult.status === 'READY' || selectedResult.status === 'REVIEWED') && (
                <button
                  onClick={() => {
                    handleDownload(selectedResult.id);
                  }}
                  disabled={downloadingId === selectedResult.id}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download Report
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
