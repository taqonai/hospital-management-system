import { useState, useEffect, useCallback } from 'react';
import {
  BeakerIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  SparklesIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  QrCodeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { laboratoryApi } from '../../services/api';
import { useBookingData } from '../../hooks/useBookingData';
import { BookingTicket } from '../../components/booking';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';
import SampleTracker from '../../components/laboratory/SampleTracker';

interface LabOrder {
  id: string;
  orderNumber: string;
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
  };
  orderedBy: {
    firstName: string;
    lastName: string;
  };
  tests: Array<{
    id: string;
    test: {
      name: string;
      code: string;
    };
    status: string;
  }>;
  status: string;
  priority: string;
  createdAt: string;
  completedAt?: string;
  consultation?: {
    id: string;
    appointmentId?: string;
  };
}

interface CriticalResult {
  id: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  test: {
    name: string;
  };
  value: string;
  unit: string;
  referenceRange: string;
  isCritical: boolean;
  createdAt: string;
}

interface LabStats {
  pendingOrders: number;
  inProgressOrders: number;
  criticalResults: number;
  completedToday: number;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  SAMPLE_COLLECTED: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  IN_PROGRESS: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20', dot: 'bg-purple-500 animate-pulse' },
  COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  CRITICAL: { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/20', dot: 'bg-rose-500 animate-pulse' },
  CANCELLED: { bg: 'bg-gray-500/10', text: 'text-gray-600', border: 'border-gray-500/20', dot: 'bg-gray-400' },
};

const priorityConfig: Record<string, { bg: string; text: string }> = {
  ROUTINE: { bg: 'bg-gray-500/10', text: 'text-gray-600' },
  URGENT: { bg: 'bg-orange-500/10', text: 'text-orange-600' },
  STAT: { bg: 'bg-rose-500/10', text: 'text-rose-600' },
};

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

interface LabTest {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
}

function NewLabOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [availableTests, setAvailableTests] = useState<LabTest[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [priority, setPriority] = useState<'ROUTINE' | 'URGENT' | 'STAT'>('ROUTINE');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [loadingTests, setLoadingTests] = useState(true);

  // Fetch available tests
  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoadingTests(true);
        const response = await laboratoryApi.getTests({ limit: 100 });
        setAvailableTests(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch lab tests:', error);
        toast.error('Failed to load available tests');
      } finally {
        setLoadingTests(false);
      }
    };
    fetchTests();
  }, []);

  // Search patients
  const searchPatients = async (query: string) => {
    if (!query.trim()) {
      setPatients([]);
      return;
    }
    setSearching(true);
    try {
      const { patientApi } = await import('../../services/api');
      const response = await patientApi.getAll({ search: query, limit: 10 });
      setPatients(response.data.data || []);
    } catch (error) {
      console.error('Failed to search patients:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchPatients(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const toggleTestSelection = (testId: string) => {
    setSelectedTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (selectedTests.length === 0) {
      toast.error('Please select at least one test');
      return;
    }

    setLoading(true);
    try {
      await laboratoryApi.createOrder({
        patientId: selectedPatient.id,
        testIds: selectedTests,
        priority,
        clinicalNotes: clinicalNotes || undefined,
      });
      toast.success('Lab order created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create lab order:', error);
      toast.error(error.response?.data?.message || 'Failed to create lab order');
    } finally {
      setLoading(false);
    }
  };

  // Group tests by category
  const testsByCategory = availableTests.reduce((acc, test) => {
    const category = test.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(test);
    return acc;
  }, {} as Record<string, LabTest[]>);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Create New Lab Order</h2>
            <p className="text-white/80 text-sm">Order laboratory tests for a patient</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Patient Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Patient <span className="text-red-500">*</span>
              </label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div>
                    <span className="font-medium text-gray-900">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">MRN: {selectedPatient.mrn}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or MRN..."
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  />
                  {searching && (
                    <div className="absolute right-3 top-3">
                      <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  )}
                  {patients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {patients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setSearchQuery('');
                            setPatients([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                        >
                          <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                          <span className="ml-2 text-sm text-gray-500">MRN: {patient.mrn}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex gap-3">
                {(['ROUTINE', 'URGENT', 'STAT'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={clsx(
                      'flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border',
                      priority === p
                        ? p === 'STAT'
                          ? 'bg-rose-500 text-white border-rose-500'
                          : p === 'URGENT'
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-amber-500 text-white border-amber-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Tests <span className="text-red-500">*</span>
                {selectedTests.length > 0 && (
                  <span className="ml-2 text-amber-600">({selectedTests.length} selected)</span>
                )}
              </label>
              {loadingTests ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="h-6 w-6 animate-spin text-amber-500" />
                  <span className="ml-2 text-gray-500">Loading tests...</span>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl">
                  {Object.entries(testsByCategory).map(([category, tests]) => (
                    <div key={category} className="border-b border-gray-200 last:border-b-0">
                      <div className="px-4 py-2 bg-gray-50 font-medium text-sm text-gray-600">
                        {category}
                      </div>
                      <div className="divide-y divide-gray-100">
                        {tests.map((test) => (
                          <label
                            key={test.id}
                            className={clsx(
                              'flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                              selectedTests.includes(test.id) && 'bg-amber-50'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedTests.includes(test.id)}
                                onChange={() => toggleTestSelection(test.id)}
                                className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                              />
                              <div>
                                <span className="font-medium text-gray-900">{test.name}</span>
                                <span className="ml-2 text-xs text-gray-500">({test.code})</span>
                              </div>
                            </div>
                            <span className="text-sm text-gray-500">{formatCurrency(test.price)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(testsByCategory).length === 0 && (
                    <div className="p-4 text-center text-gray-500">No tests available</div>
                  )}
                </div>
              )}
            </div>

            {/* Clinical Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Clinical Notes (Optional)</label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Reason for ordering, relevant symptoms, or special instructions..."
                rows={3}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
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
                disabled={loading || !selectedPatient || selectedTests.length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <BeakerIcon className="h-5 w-5" />
                    Create Order
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

export default function Laboratory() {
  const [activeTab, setActiveTab] = useState<'orders' | 'results' | 'critical' | 'sample-tracking'>('orders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [criticalResults, setCriticalResults] = useState<CriticalResult[]>([]);
  const [stats, setStats] = useState<LabStats>({
    pendingOrders: 0,
    inProgressOrders: 0,
    criticalResults: 0,
    completedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const { data: healthStatus } = useAIHealth();

  const isAIOnline = healthStatus?.status === 'connected';

  // Fetch booking ticket data for selected appointment
  const { data: bookingTicketData, isLoading: loadingBookingTicket, refetch: refetchBookingTicket } = useBookingData(
    selectedBookingId,
    15000, // Poll every 15 seconds
    !!selectedBookingId
  );

  // Fetch orders function with polling support
  const fetchOrders = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await laboratoryApi.getOrders({
        page,
        limit: 20,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setLabOrders(response.data.data || []);
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch lab orders:', error);
      if (showLoading) toast.error('Failed to load lab orders');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, statusFilter, search]);

  // Initial fetch and polling for orders
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders(false); // Silent refresh
    }, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Fetch critical results with polling
  useEffect(() => {
    const fetchCritical = async () => {
      try {
        const response = await laboratoryApi.getCriticalResults();
        setCriticalResults(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch critical results:', error);
      }
    };

    fetchCritical();
    const interval = setInterval(fetchCritical, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch stats with polling
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await laboratoryApi.getStats();
        setStats(response.data.data || {
          pendingOrders: 0,
          inProgressOrders: 0,
          criticalResults: 0,
          completedToday: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const handleAISuggestTests = () => {
    toast.success('AI is analyzing patient history to suggest appropriate tests...');
  };

  const handleInterpretResults = (_orderId: string) => {
    toast.success('AI is interpreting lab results...');
  };

  const statCards = [
    { label: 'Pending Orders', value: stats.pendingOrders, icon: ClockIcon, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/10' },
    { label: 'In Progress', value: stats.inProgressOrders, icon: ArrowPathIcon, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10' },
    { label: 'Critical Values', value: stats.criticalResults, icon: ExclamationTriangleIcon, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-500/10' },
    { label: 'Completed Today', value: stats.completedToday, icon: CheckCircleIcon, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-500/10' },
  ];

  const tabs = [
    { id: 'orders', label: 'Lab Orders', count: labOrders.length, icon: ClipboardDocumentCheckIcon },
    { id: 'results', label: 'Results Entry', count: stats.inProgressOrders, icon: ChartBarIcon },
    { id: 'critical', label: 'Critical Values', count: criticalResults.length, icon: ExclamationTriangleIcon, alert: criticalResults.length > 0 },
    { id: 'sample-tracking', label: 'Sample Tracking', count: stats.pendingOrders, icon: QrCodeIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-yellow-300/20 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 mb-3">
              <BeakerIcon className="h-4 w-4 text-white/80" />
              <span className="text-xs font-medium text-white/90">Laboratory Information System</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Laboratory</h1>
            <p className="mt-1 text-white/70">Manage lab orders, results, and critical values</p>
          </div>
          <div className="flex items-center gap-3">
            {isAIOnline && (
              <button onClick={handleAISuggestTests} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white font-medium hover:bg-white/20 transition-all">
                <SparklesIcon className="h-5 w-5" />
                AI Suggest Tests
              </button>
            )}
            <button
              onClick={() => setShowNewOrderModal(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white font-semibold hover:bg-white/20 transition-all hover:scale-105 group"
            >
              <PlusIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
              New Order
            </button>
          </div>
        </div>
      </div>

      {/* Critical Alert */}
      {criticalResults.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-500/30 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-rose-500/20 animate-pulse">
              <ExclamationTriangleIcon className="h-6 w-6 text-rose-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-rose-700">{criticalResults.length} Critical Values Require Attention</h3>
              <div className="mt-2 space-y-1">
                {criticalResults.slice(0, 2).map(cv => (
                  <p key={cv.id} className="text-sm text-rose-600">
                    {cv.patient?.firstName} {cv.patient?.lastName}: {cv.test?.name} = {cv.value} {cv.unit} (Ref: {cv.referenceRange})
                  </p>
                ))}
              </div>
              <button onClick={() => setActiveTab('critical')} className="mt-3 text-sm font-semibold text-rose-600 hover:text-rose-700">
                View All Critical Values →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-2xl p-5 backdrop-blur-xl bg-white border border-gray-200 shadow-lg group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fade-in-up opacity-0"
            style={{ animationDelay: `${200 + idx * 100}ms`, animationFillMode: 'forwards' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                <stat.icon className="h-6 w-6 text-gray-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg animate-fade-in-up opacity-0" style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
              <input
                type="text"
                placeholder="Search by patient name or order number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 placeholder-gray-400 transition-all"
              />
            </div>
            <div className="relative">
              <FunnelIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none w-full sm:w-44 pl-12 pr-10 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-gray-700 cursor-pointer transition-all"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="SAMPLE_COLLECTED">Sample Collected</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                tab.alert
                  ? 'bg-rose-500/10 text-rose-600 animate-pulse'
                  : activeTab === tab.id
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-0">
          {activeTab === 'orders' && (
            loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                </div>
                <p className="text-gray-500 animate-pulse">Loading lab orders...</p>
              </div>
            ) : labOrders.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
                  <BeakerIcon className="h-10 w-10 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No lab orders found</h3>
                <p className="text-gray-500">Create a new lab order to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {labOrders.map((order, idx) => {
                  const status = statusConfig[order.status] || statusConfig.PENDING;
                  const priority = priorityConfig[order.priority] || priorityConfig.ROUTINE;
                  return (
                    <div
                      key={order.id}
                      className={clsx(
                        'p-5 hover:bg-gray-50 transition-all animate-fade-in-up opacity-0',
                        order.status === 'CRITICAL' && 'bg-rose-50'
                      )}
                      style={{ animationDelay: `${700 + idx * 50}ms`, animationFillMode: 'forwards' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-mono text-sm px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">
                              {order.orderNumber}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text} border ${status.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                              {order.status?.replace('_', ' ')}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priority.bg} ${priority.text}`}>
                              {order.priority}
                            </span>
                          </div>
                          <h3 className="mt-3 font-semibold text-gray-900">
                            {order.patient?.firstName || ''} {order.patient?.lastName || ''}
                          </h3>
                          <p className="text-sm text-gray-500">MRN: {order.patient?.mrn}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {order.tests?.map((test) => (
                              <span key={test.id} className="px-2.5 py-1 bg-amber-500/10 text-amber-700 text-xs rounded-lg font-medium">
                                {test.test?.name || 'Unknown Test'}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right text-sm space-y-2">
                          <p className="text-gray-500">
                            Dr. {order.orderedBy?.firstName || ''} {order.orderedBy?.lastName || ''}
                          </p>
                          <p className="text-gray-400">{new Date(order.createdAt).toLocaleString()}</p>
                          <div className="flex gap-2 justify-end mt-3">
                            {order.status === 'COMPLETED' && isAIOnline && (
                              <button
                                onClick={() => handleInterpretResults(order.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-600 bg-purple-500/10 hover:bg-purple-500/20 transition-all"
                              >
                                <SparklesIcon className="h-3.5 w-3.5" />
                                AI Interpret
                              </button>
                            )}
                            {order.consultation?.appointmentId && (
                              <button
                                onClick={() => setSelectedBookingId(order.consultation!.appointmentId!)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 transition-all"
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                View Booking
                              </button>
                            )}
                            <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'results' && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
                <ChartBarIcon className="h-10 w-10 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Results Entry</h3>
              <p className="text-gray-500 mb-6">Enter and validate lab test results</p>
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                Start Results Entry
              </button>
            </div>
          )}

          {activeTab === 'critical' && (
            criticalResults.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 flex items-center justify-center">
                  <CheckCircleIcon className="h-10 w-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Critical Values</h3>
                <p className="text-gray-500">All results are within normal ranges.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {criticalResults.map((cv, idx) => (
                  <div
                    key={cv.id}
                    className="p-5 bg-rose-50 animate-fade-in-up opacity-0"
                    style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'forwards' }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-rose-800">
                          {cv.patient?.firstName} {cv.patient?.lastName}
                        </h3>
                        <p className="mt-1 text-rose-700">
                          <span className="font-medium">{cv.test?.name}:</span> {cv.value} {cv.unit}
                        </p>
                        <p className="text-sm text-rose-600">Reference: {cv.referenceRange}</p>
                        <p className="text-xs text-rose-500 mt-2">{new Date(cv.createdAt).toLocaleString()}</p>
                      </div>
                      <button className="px-4 py-2 rounded-xl text-sm font-semibold text-rose-600 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all">
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'sample-tracking' && (
            <div className="p-6">
              {/* Sample Barcode Tracker */}
              <SampleTracker />
            </div>
          )}
        </div>

        {/* Pagination */}
        {activeTab === 'orders' && totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-200">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 disabled:opacity-50 transition-all"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 disabled:opacity-50 transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* New Order Modal */}
      {showNewOrderModal && (
        <NewLabOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={() => {
            setShowNewOrderModal(false);
            // Refresh orders
            const fetchOrders = async () => {
              try {
                const response = await laboratoryApi.getOrders({
                  page,
                  limit: 20,
                  status: statusFilter || undefined,
                  search: search || undefined,
                });
                setLabOrders(response.data.data || []);
              } catch (error) {
                console.error('Failed to fetch lab orders:', error);
              }
            };
            fetchOrders();
          }}
        />
      )}

      {/* Booking Ticket Modal */}
      {selectedBookingId && bookingTicketData && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedBookingId(null)} />
            <div className="relative w-full max-w-3xl">
              <BookingTicket
                data={bookingTicketData}
                isLoading={loadingBookingTicket}
                onRefresh={() => refetchBookingTicket()}
                onClose={() => setSelectedBookingId(null)}
                showActions={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
