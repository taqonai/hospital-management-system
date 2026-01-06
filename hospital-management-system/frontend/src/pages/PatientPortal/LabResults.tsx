import { useState, Fragment, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Dialog, Transition } from '@headlessui/react';
import {
  BeakerIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CalendarDaysIcon,
  UserIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  EyeIcon,
  PrinterIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import toast from 'react-hot-toast';

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

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string; icon: typeof CheckCircleIcon }> = {
  PENDING: { bg: 'bg-amber-100/80', text: 'text-amber-700', dot: 'bg-amber-500 animate-pulse', label: 'Pending', icon: ClockIcon },
  IN_PROGRESS: { bg: 'bg-blue-100/80', text: 'text-blue-700', dot: 'bg-blue-500 animate-pulse', label: 'In Progress', icon: ClockIcon },
  READY: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-500', label: 'Ready', icon: CheckCircleIcon },
  REVIEWED: { bg: 'bg-purple-100/80', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Reviewed', icon: CheckCircleIcon },
};

const resultStatusConfig: Record<string, { color: string; bgColor: string; icon: typeof CheckCircleIcon }> = {
  NORMAL: { color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircleIcon },
  HIGH: { color: 'text-red-600', bgColor: 'bg-red-50', icon: ArrowTrendingUpIcon },
  LOW: { color: 'text-red-600', bgColor: 'bg-red-50', icon: ArrowTrendingDownIcon },
  CRITICAL_HIGH: { color: 'text-red-700 font-bold', bgColor: 'bg-red-100', icon: ArrowTrendingUpIcon },
  CRITICAL_LOW: { color: 'text-red-700 font-bold', bgColor: 'bg-red-100', icon: ArrowTrendingDownIcon },
  BORDERLINE: { color: 'text-amber-600', bgColor: 'bg-amber-50', icon: MinusIcon },
};

// Mock data for demonstration
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
];

export default function LabResults() {
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const itemsPerPage = 10;

  // Fetch lab results
  const { data: labResultsData, isLoading, error } = useQuery({
    queryKey: ['patient-lab-results-page', statusFilter, categoryFilter, dateRange],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getLabResults({
          status: statusFilter || undefined,
        });
        return response.data?.data || response.data || [];
      } catch {
        return mockLabResults;
      }
    },
  });

  const labResults: LabResult[] = Array.isArray(labResultsData) ? labResultsData : [];

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(labResults.map(r => r.testCategory));
    return Array.from(cats).sort();
  }, [labResults]);

  // Filter results
  const filteredResults = useMemo(() => {
    return labResults.filter((result) => {
      // Status filter
      if (statusFilter && result.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter && result.testCategory !== categoryFilter) return false;

      // Date range filter
      if (dateRange.startDate) {
        const testDate = new Date(result.testDate);
        if (testDate < new Date(dateRange.startDate)) return false;
      }
      if (dateRange.endDate) {
        const testDate = new Date(result.testDate);
        if (testDate > new Date(dateRange.endDate)) return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const testName = result.testName.toLowerCase();
        const category = result.testCategory.toLowerCase();
        const orderNumber = result.orderNumber.toLowerCase();
        const doctorName = result.orderingDoctor.name.toLowerCase();

        if (!testName.includes(searchLower) &&
            !category.includes(searchLower) &&
            !orderNumber.includes(searchLower) &&
            !doctorName.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [labResults, statusFilter, categoryFilter, dateRange, searchTerm]);

  // Group by date
  const groupedResults = useMemo(() => {
    const grouped: Record<string, LabResult[]> = {};
    filteredResults.forEach(result => {
      const date = result.testDate;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(result);
    });
    return Object.entries(grouped).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredResults]);

  // Pagination
  const totalPages = Math.ceil(groupedResults.length / itemsPerPage);
  const paginatedGroups = groupedResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Auto-expand groups
  useMemo(() => {
    if (paginatedGroups.length > 0 && expandedGroups.size === 0) {
      const initialExpanded = new Set(paginatedGroups.map(([date]) => date));
      setExpandedGroups(initialExpanded);
    }
  }, [paginatedGroups]);

  const toggleGroup = (date: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const handleViewResult = (result: LabResult) => {
    setSelectedResult(result);
    setShowDetailModal(true);
  };

  const handleDownloadResult = async (result: LabResult) => {
    setIsDownloading(result.id);
    try {
      await patientPortalApi.downloadLabReport(result.id);
      toast.success('Lab report downloaded successfully');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download lab report');
    } finally {
      setIsDownloading(null);
    }
  };

  const hasAbnormalResults = (result: LabResult) => {
    return result.results.some(r =>
      ['HIGH', 'LOW', 'CRITICAL_HIGH', 'CRITICAL_LOW'].includes(r.status)
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCategoryFilter('');
    setDateRange({ startDate: '', endDate: '' });
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter || categoryFilter || dateRange.startDate || dateRange.endDate;

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  const renderResultCard = (result: LabResult) => {
    const status = statusConfig[result.status] || statusConfig.PENDING;
    const StatusIcon = status.icon;
    const abnormal = hasAbnormalResults(result);

    return (
      <div
        key={result.id}
        className={`p-5 hover:bg-gray-50 transition-colors ${abnormal ? 'border-l-4 border-l-red-500' : ''}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Icon */}
            <div className={`flex-shrink-0 p-3 rounded-xl ${abnormal ? 'bg-red-100' : 'bg-purple-100'}`}>
              <BeakerIcon className={`h-6 w-6 ${abnormal ? 'text-red-600' : 'text-purple-600'}`} />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h4 className="font-semibold text-gray-900">{result.testName}</h4>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
                {abnormal && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    <ExclamationCircleIcon className="h-3.5 w-3.5" />
                    Abnormal Values
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                <span className="flex items-center gap-1.5">
                  <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                  {result.orderNumber}
                </span>
                <span className="flex items-center gap-1.5">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  {result.orderingDoctor.name}
                </span>
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{result.testCategory}</span>
              </div>

              {/* Quick Results Preview */}
              {result.status !== 'PENDING' && result.results.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.results.slice(0, 4).map(test => {
                    const resConfig = resultStatusConfig[test.status] || resultStatusConfig.NORMAL;
                    return (
                      <div key={test.id} className={`px-3 py-1.5 rounded-lg text-sm ${resConfig.bgColor}`}>
                        <span className={`font-medium ${resConfig.color}`}>{test.testCode}:</span>{' '}
                        <span className={resConfig.color}>{test.value} {test.unit}</span>
                      </div>
                    );
                  })}
                  {result.results.length > 4 && (
                    <span className="px-3 py-1.5 text-sm text-gray-500">+{result.results.length - 4} more</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 lg:flex-shrink-0">
            <button
              onClick={() => handleViewResult(result)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <EyeIcon className="h-4 w-4" />
              Details
            </button>
            {(result.status === 'READY' || result.status === 'REVIEWED') && (
              <button
                onClick={() => handleDownloadResult(result)}
                disabled={isDownloading === result.id}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md disabled:opacity-50"
              >
                {isDownloading === result.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <ArrowDownTrayIcon className="h-4 w-4" />
                )}
                PDF
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white shadow-lg">
                <BeakerIcon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Lab Results</h1>
                <p className="text-gray-500 mt-1">View and download your laboratory test results</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search by test name, category, or order number..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-gray-500">
                <FunnelIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="READY">Ready</option>
                <option value="REVIEWED">Reviewed</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm min-w-[160px]"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => { setDateRange({ ...dateRange, startDate: e.target.value }); setCurrentPage(1); }}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => { setDateRange({ ...dateRange, endDate: e.target.value }); setCurrentPage(1); }}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
                <p className="mt-4 text-gray-500">Loading lab results...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
                <div>
                  <h3 className="font-semibold text-red-800">Error Loading Lab Results</h3>
                  <p className="text-red-600">Unable to load your lab results. Please try again later.</p>
                </div>
              </div>
            </div>
          ) : paginatedGroups.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
              <div className="text-center">
                <BeakerIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Lab Results Found</h3>
                <p className="text-gray-500 mb-4">
                  {hasActiveFilters
                    ? 'No results match your current filters. Try adjusting or clearing the filters.'
                    : 'You do not have any lab results yet.'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 px-1">
                Showing {filteredResults.length} results in {paginatedGroups.length} date groups
              </p>

              {paginatedGroups.map(([date, results]) => (
                <div key={date} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(date)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CalendarDaysIcon className="h-5 w-5 text-gray-500" />
                      <span className="font-semibold text-gray-900">{formatDate(date)}</span>
                      <span className="text-sm text-gray-500">({results.length} test{results.length !== 1 ? 's' : ''})</span>
                    </div>
                    {expandedGroups.has(date) ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {/* Group Content */}
                  {expandedGroups.has(date) && (
                    <div className="divide-y divide-gray-100">
                      {results.map(result => renderResultCard(result))}
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Modal */}
        <Transition appear show={showDetailModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowDetailModal(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all max-h-[90vh] flex flex-col">
                    {selectedResult && (
                      <>
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-white">{selectedResult.testName}</h3>
                              <p className="text-purple-100 text-sm mt-1">{selectedResult.orderNumber}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => window.print()}
                                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                                title="Print"
                              >
                                <PrinterIcon className="h-5 w-5" />
                              </button>
                              {(selectedResult.status === 'READY' || selectedResult.status === 'REVIEWED') && (
                                <button
                                  onClick={() => handleDownloadResult(selectedResult)}
                                  disabled={isDownloading === selectedResult.id}
                                  className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                                  title="Download PDF"
                                >
                                  {isDownloading === selectedResult.id ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                  ) : (
                                    <ArrowDownTrayIcon className="h-5 w-5" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                              >
                                <XMarkIcon className="h-6 w-6" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Modal Content */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-6">
                          {/* Status and Info */}
                          <div className="flex flex-wrap items-center gap-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                              statusConfig[selectedResult.status]?.bg || 'bg-gray-100'
                            } ${statusConfig[selectedResult.status]?.text || 'text-gray-700'}`}>
                              <span className={`w-2 h-2 rounded-full ${statusConfig[selectedResult.status]?.dot || 'bg-gray-400'}`} />
                              {statusConfig[selectedResult.status]?.label || selectedResult.status}
                            </span>
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
                          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Category</p>
                              <p className="font-medium text-gray-900">{selectedResult.testCategory}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Specimen Type</p>
                              <p className="font-medium text-gray-900">{selectedResult.specimenType || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Ordering Physician</p>
                              <p className="font-medium text-gray-900">{selectedResult.orderingDoctor.name}</p>
                              <p className="text-sm text-gray-600">{selectedResult.orderingDoctor.specialization}</p>
                            </div>
                            {selectedResult.collectionDate && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Collection Time</p>
                                <p className="font-medium text-gray-900">{formatDateTime(selectedResult.collectionDate)}</p>
                              </div>
                            )}
                          </div>

                          {/* Results Table */}
                          {selectedResult.results.length > 0 ? (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-3">Test Results</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Test</th>
                                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Result</th>
                                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Normal Range</th>
                                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Previous</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {selectedResult.results.map(test => {
                                      const resConfig = resultStatusConfig[test.status] || resultStatusConfig.NORMAL;
                                      const ResIcon = resConfig.icon;
                                      return (
                                        <tr key={test.id} className={test.status !== 'NORMAL' ? 'bg-red-50/50' : ''}>
                                          <td className="py-3 px-4">
                                            <div className="font-medium text-gray-900">{test.testName}</div>
                                            <div className="text-xs text-gray-500">{test.testCode}</div>
                                          </td>
                                          <td className="py-3 px-4">
                                            <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg ${resConfig.bgColor}`}>
                                              <ResIcon className={`h-4 w-4 ${resConfig.color}`} />
                                              <span className={`font-semibold ${resConfig.color}`}>{test.value}</span>
                                              <span className="text-xs text-gray-500">{test.unit}</span>
                                            </span>
                                          </td>
                                          <td className="py-3 px-4 text-sm text-gray-600">{test.normalRange}</td>
                                          <td className="py-3 px-4">
                                            <span className={`text-sm font-medium ${
                                              test.status === 'NORMAL' ? 'text-green-600' :
                                              test.status === 'BORDERLINE' ? 'text-amber-600' : 'text-red-600'
                                            }`}>
                                              {test.status.replace('_', ' ')}
                                            </span>
                                          </td>
                                          <td className="py-3 px-4">
                                            {test.previousValue && (
                                              <div className="text-xs text-gray-500">
                                                <div>{test.previousValue} {test.unit}</div>
                                                {test.previousDate && <div>{formatDate(test.previousDate)}</div>}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="p-8 bg-amber-50 rounded-xl text-center">
                              <ClockIcon className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                              <p className="text-amber-700 font-medium">Results Pending</p>
                              <p className="text-sm text-amber-600">Your test results are being processed. Please check back later.</p>
                            </div>
                          )}

                          {/* Interpretation */}
                          {selectedResult.interpretation && (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-3">Interpretation</h4>
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
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                          <button
                            onClick={() => setShowDetailModal(false)}
                            className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                          >
                            Close
                          </button>
                          {(selectedResult.status === 'READY' || selectedResult.status === 'REVIEWED') && (
                            <button
                              onClick={() => handleDownloadResult(selectedResult)}
                              disabled={isDownloading === selectedResult.id}
                              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {isDownloading === selectedResult.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                  Downloading...
                                </>
                              ) : (
                                <>
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                  Download Report
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
}
