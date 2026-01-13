import { useState, useEffect, useCallback } from 'react';
import {
  SparklesIcon,
  MagnifyingGlassIcon,
  DocumentDuplicateIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  ArrowPathIcon,
  BookOpenIcon,
  BeakerIcon,
  HeartIcon,
  BoltIcon,
  FireIcon,
  ShieldExclamationIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  DocumentPlusIcon,
  XCircleIcon,
  CalendarIcon,
  FunnelIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { smartOrderApi } from '../../services/api';
import { CurrencyDisplay } from '../../components/common';
import OrderSetRecommendation from '../../components/orders/OrderSetRecommendation';
import OrderBundleCard from '../../components/orders/OrderBundleCard';
import OrderCustomizer from '../../components/orders/OrderCustomizer';

// Common ICD-10 codes for autocomplete
const commonDiagnoses = [
  { code: 'A41.9', name: 'Sepsis, unspecified organism', category: 'Infectious' },
  { code: 'I21.9', name: 'Acute myocardial infarction, unspecified', category: 'Cardiovascular' },
  { code: 'J18.9', name: 'Pneumonia, unspecified organism', category: 'Respiratory' },
  { code: 'E11.10', name: 'Type 2 diabetes mellitus with ketoacidosis', category: 'Endocrine' },
  { code: 'I63.9', name: 'Cerebral infarction, unspecified', category: 'Neurological' },
  { code: 'K92.2', name: 'Gastrointestinal hemorrhage, unspecified', category: 'Gastrointestinal' },
  { code: 'N17.9', name: 'Acute kidney failure, unspecified', category: 'Renal' },
  { code: 'J44.1', name: 'COPD with acute exacerbation', category: 'Respiratory' },
  { code: 'I50.9', name: 'Heart failure, unspecified', category: 'Cardiovascular' },
  { code: 'E87.6', name: 'Hypokalemia', category: 'Metabolic' },
];

interface Order {
  id: string;
  name: string;
  category: string;
  urgency: string;
  confidence: number;
  rationale: string;
  warnings?: string[];
  dosing?: any;
  estimatedCost?: number;
}

interface PatientContext {
  age?: number;
  weight?: number;
  gender?: string;
  allergies?: string[];
  currentMedications?: string[];
  renalFunction?: string;
  hepaticFunction?: string;
  pregnancyStatus?: string;
  comorbidities?: string[];
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  category: string;
  componentCount: number;
  evidenceLevel: string;
}

// Order History Types
interface OrderHistoryItem {
  id: string;
  orderNumber: string;
  patientId: string;
  patientName: string;
  diagnosis: string;
  icdCode?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'in_progress';
  totalCost: number;
  itemCount: number;
  orderedBy: string;
  orderedAt: string;
  completedAt?: string;
  items: OrderHistoryItemDetail[];
}

interface OrderHistoryItemDetail {
  id: string;
  name: string;
  category: string;
  urgency: string;
  status: 'pending' | 'completed' | 'cancelled';
  rationale?: string;
  warnings?: string[];
  executedBy?: string;
  executedAt?: string;
}

interface OrderStats {
  totalOrdersToday: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  commonDiagnoses: { diagnosis: string; count: number }[];
}

interface OrderHistoryFilters {
  patientSearch: string;
  startDate: string;
  endDate: string;
  status: string;
  category: string;
}

export default function SmartOrders() {
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'bundles' | 'history'>('diagnosis');
  const [diagnosis, setDiagnosis] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [showDiagnosisSuggestions, setShowDiagnosisSuggestions] = useState(false);

  const [patientId, setPatientId] = useState('');
  const [patientContext, setPatientContext] = useState<PatientContext>({
    age: undefined,
    weight: undefined,
    gender: undefined,
    allergies: [],
    currentMedications: [],
    renalFunction: 'normal',
    hepaticFunction: 'normal',
  });

  const [recommendations, setRecommendations] = useState<any>(null);
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [bundleDetails, setBundleDetails] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [customizeResult, _setCustomizeResult] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [loadingBundleDetails, setLoadingBundleDetails] = useState(false);
  const [placingOrders, setPlacingOrders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Order History State
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<OrderHistoryFilters>({
    patientSearch: '',
    startDate: '',
    endDate: '',
    status: 'all',
    category: 'all',
  });
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showReorderModal, setShowReorderModal] = useState<string | null>(null);
  const [reorderPatientId, setReorderPatientId] = useState('');

  // Load bundles on mount
  useEffect(() => {
    loadBundles();
  }, []);

  // Load bundle details when selected
  useEffect(() => {
    if (selectedBundle) {
      loadBundleDetails(selectedBundle);
    } else {
      setBundleDetails(null);
    }
  }, [selectedBundle]);

  const loadBundles = async () => {
    setLoadingBundles(true);
    try {
      const response = await smartOrderApi.getBundles();
      const data = response.data?.data || response.data;
      setBundles(data?.bundles || []);
    } catch (err) {
      console.error('Error loading bundles:', err);
    } finally {
      setLoadingBundles(false);
    }
  };

  const loadBundleDetails = async (bundleId: string) => {
    setLoadingBundleDetails(true);
    try {
      const response = await smartOrderApi.getBundleDetails(bundleId);
      const data = response.data?.data || response.data;
      setBundleDetails(data);
    } catch (err) {
      console.error('Error loading bundle details:', err);
    } finally {
      setLoadingBundleDetails(false);
    }
  };

  // Load order history
  const loadOrderHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await smartOrderApi.getOrderHistory({
        patientName: historyFilters.patientSearch || undefined,
        startDate: historyFilters.startDate || undefined,
        endDate: historyFilters.endDate || undefined,
        status: historyFilters.status !== 'all' ? historyFilters.status : undefined,
        category: historyFilters.category !== 'all' ? historyFilters.category : undefined,
        page: currentPage,
        pageSize,
      });
      const data = response.data?.data || response.data;
      if (data?.orders) {
        setOrderHistory(data.orders);
        setTotalOrders(data.total || data.orders.length);
      } else {
        // No orders found - show empty state
        setOrderHistory([]);
        setTotalOrders(0);
      }
    } catch (err) {
      console.error('Error loading order history:', err);
      // Show empty state on error
      setOrderHistory([]);
      setTotalOrders(0);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilters, currentPage, pageSize]);

  // Load order statistics
  const loadOrderStats = useCallback(async () => {
    try {
      const response = await smartOrderApi.getOrderStats();
      const data = response.data?.data || response.data;
      if (data) {
        setOrderStats(data);
      } else {
        // Show empty stats
        setOrderStats({
          totalOrdersToday: 0,
          pendingOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          commonDiagnoses: [],
        });
      }
    } catch (err) {
      console.error('Error loading order stats:', err);
      // Show empty stats on error
      setOrderStats({
        totalOrdersToday: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        commonDiagnoses: [],
      });
    }
  }, []);

  // Load order history when tab changes or filters change
  useEffect(() => {
    if (activeTab === 'history') {
      loadOrderHistory();
      loadOrderStats();
    }
  }, [activeTab, loadOrderHistory, loadOrderStats]);

  // Handle cancel order
  const handleCancelOrder = async (orderId: string) => {
    try {
      await smartOrderApi.cancelOrder(orderId, cancelReason);
      setSuccess('Order cancelled successfully');
      setShowCancelModal(null);
      setCancelReason('');
      loadOrderHistory();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel order');
    }
  };

  // Handle reorder
  const handleReorder = async (orderId: string) => {
    if (!reorderPatientId.trim()) {
      setError('Please enter a patient ID');
      return;
    }
    try {
      await smartOrderApi.reorder(orderId, reorderPatientId);
      setSuccess('Order copied successfully. Go to Diagnosis-Based tab to review and place the order.');
      setShowReorderModal(null);
      setReorderPatientId('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reorder');
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get urgency badge style
  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'stat':
        return 'bg-red-100 text-red-800';
      case 'urgent':
        return 'bg-orange-100 text-orange-800';
      case 'routine':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate total pages
  const totalPages = Math.ceil(totalOrders / pageSize);

  const handleGetRecommendations = async () => {
    if (!diagnosis.trim()) {
      setError('Please enter a diagnosis');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await smartOrderApi.getRecommendations({
        diagnosis: diagnosis.trim(),
        icdCode: icdCode || undefined,
        symptoms: symptoms.length > 0 ? symptoms : undefined,
        patientId: patientId || undefined,
        patientContext: Object.keys(patientContext).some(k => patientContext[k as keyof PatientContext])
          ? patientContext
          : undefined,
        includeAlternatives: true,
      });

      const data = response.data?.data || response.data;
      setRecommendations(data);
      setSelectedOrders([]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyBundle = async (bundleId: string) => {
    if (!bundleDetails) return;

    // Convert bundle components to orders
    const bundleOrders: Order[] = bundleDetails.components.map((comp: any, idx: number) => ({
      id: `bundle-${bundleId}-${idx}`,
      name: comp.name,
      category: comp.category,
      urgency: comp.required ? 'stat' : 'routine',
      confidence: 0.95,
      rationale: comp.condition || `Part of ${bundleDetails.name}`,
      estimatedCost: 50,
    }));

    setSelectedOrders(bundleOrders);
    setActiveTab('diagnosis');
  };

  const handleSelectOrder = (order: Order) => {
    if (!selectedOrders.some(o => o.id === order.id)) {
      setSelectedOrders([...selectedOrders, order]);
    }
  };

  const handleDeselectOrder = (orderId: string) => {
    setSelectedOrders(selectedOrders.filter(o => o.id !== orderId));
  };

  const handleReorderOrders = (orders: Order[]) => {
    setSelectedOrders(orders);
  };

  const handleUpdateUrgency = (orderId: string, urgency: string) => {
    setSelectedOrders(selectedOrders.map(o =>
      o.id === orderId ? { ...o, urgency } : o
    ));
  };

  const handlePlaceOrders = async () => {
    if (!patientId || selectedOrders.length === 0) {
      setError('Please select a patient and at least one order');
      return;
    }

    setPlacingOrders(true);
    setError(null);

    try {
      await smartOrderApi.placeOrders({
        patientId,
        orders: selectedOrders,
        notes: diagnosis,
      });

      setSuccess(`Successfully placed ${selectedOrders.length} orders`);
      setSelectedOrders([]);
      setRecommendations(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to place orders');
    } finally {
      setPlacingOrders(false);
    }
  };

  const handleClearAll = () => {
    setSelectedOrders([]);
  };

  const handleSelectDiagnosis = (diag: typeof commonDiagnoses[0]) => {
    setDiagnosis(diag.name);
    setIcdCode(diag.code);
    setShowDiagnosisSuggestions(false);
  };

  const addSymptom = () => {
    if (symptomInput.trim() && !symptoms.includes(symptomInput.trim())) {
      setSymptoms([...symptoms, symptomInput.trim()]);
      setSymptomInput('');
    }
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const filteredDiagnoses = diagnosis
    ? commonDiagnoses.filter(d =>
        d.name.toLowerCase().includes(diagnosis.toLowerCase()) ||
        d.code.toLowerCase().includes(diagnosis.toLowerCase())
      )
    : commonDiagnoses;

  const totalCost = selectedOrders.reduce((sum, o) => sum + (o.estimatedCost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
              <SparklesIcon className="h-6 w-6" />
            </div>
            Smart Order Sets
          </h1>
          <p className="mt-1 text-gray-500">
            AI-powered clinical order recommendations with evidence-based bundles
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadBundles}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <p className="text-green-700">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Selected Orders</p>
              <p className="text-2xl font-bold text-gray-900">{selectedOrders.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <CubeIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Estimated Cost</p>
              <p className="text-2xl font-bold text-gray-900"><CurrencyDisplay amount={totalCost} /></p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600">
              <BeakerIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Available Bundles</p>
              <p className="text-2xl font-bold text-gray-900">{bundles.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
              <DocumentDuplicateIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">AI Status</p>
              <p className="text-lg font-bold text-emerald-600">Active</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100">
              <SparklesIcon className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'diagnosis', name: 'Diagnosis-Based', icon: SparklesIcon },
            { id: 'bundles', name: 'Order Bundles', icon: DocumentDuplicateIcon },
            { id: 'history', name: 'Order History', icon: ClockIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'diagnosis' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Input & Recommendations */}
          <div className="xl:col-span-2 space-y-6">
            {/* Diagnosis Input */}
            <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MagnifyingGlassIcon className="h-5 w-5 text-indigo-500" />
                Enter Diagnosis
              </h3>

              <div className="space-y-4">
                {/* Diagnosis field with autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diagnosis or ICD-10 Code
                  </label>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => {
                      setDiagnosis(e.target.value);
                      setShowDiagnosisSuggestions(true);
                    }}
                    onFocus={() => setShowDiagnosisSuggestions(true)}
                    placeholder="e.g., Sepsis, Chest Pain, I21.9..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {showDiagnosisSuggestions && filteredDiagnoses.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {filteredDiagnoses.map((diag) => (
                        <button
                          key={diag.code}
                          onClick={() => handleSelectDiagnosis(diag)}
                          className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{diag.name}</p>
                            <p className="text-sm text-gray-500">{diag.code} - {diag.category}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ICD Code (auto-filled) */}
                {icdCode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ICD-10 Code
                    </label>
                    <input
                      type="text"
                      value={icdCode}
                      onChange={(e) => setIcdCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50"
                    />
                  </div>
                )}

                {/* Symptoms */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Symptoms (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={symptomInput}
                      onChange={(e) => setSymptomInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addSymptom()}
                      placeholder="Enter symptom and press Enter"
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={addSymptom}
                      className="px-4 py-2 rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                    >
                      Add
                    </button>
                  </div>
                  {symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {symptoms.map((symptom) => (
                        <span
                          key={symptom}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm"
                        >
                          {symptom}
                          <button
                            onClick={() => removeSymptom(symptom)}
                            className="hover:text-indigo-900"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Get Recommendations Button */}
                <button
                  onClick={handleGetRecommendations}
                  disabled={loading || !diagnosis.trim()}
                  className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      <span>Generating Recommendations...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-5 w-5" />
                      <span>Get AI Recommendations</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Recommendations */}
            <OrderSetRecommendation
              recommendations={recommendations}
              selectedOrders={selectedOrders}
              onSelectOrder={handleSelectOrder}
              onDeselectOrder={handleDeselectOrder}
              loading={loading}
            />
          </div>

          {/* Right Column - Patient Context & Order Summary */}
          <div className="space-y-6">
            {/* Patient Context */}
            <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-indigo-500" />
                Patient Context
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                  <input
                    type="text"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    placeholder="Enter patient ID"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={patientContext.age || ''}
                      onChange={(e) => setPatientContext({ ...patientContext, age: parseInt(e.target.value) || undefined })}
                      placeholder="Age"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={patientContext.weight || ''}
                      onChange={(e) => setPatientContext({ ...patientContext, weight: parseFloat(e.target.value) || undefined })}
                      placeholder="Weight"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={patientContext.gender || ''}
                    onChange={(e) => setPatientContext({ ...patientContext, gender: e.target.value || undefined })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Renal Function</label>
                  <select
                    value={patientContext.renalFunction || 'normal'}
                    onChange={(e) => setPatientContext({ ...patientContext, renalFunction: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="mild">Mild impairment</option>
                    <option value="moderate">Moderate impairment</option>
                    <option value="severe">Severe impairment</option>
                    <option value="dialysis">Dialysis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <input
                    type="text"
                    value={patientContext.allergies?.join(', ') || ''}
                    onChange={(e) => setPatientContext({ ...patientContext, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="e.g., Penicillin, Sulfa"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
                  <input
                    type="text"
                    value={patientContext.currentMedications?.join(', ') || ''}
                    onChange={(e) => setPatientContext({ ...patientContext, currentMedications: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="e.g., Lisinopril, Metformin"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <OrderCustomizer
              selectedOrders={selectedOrders}
              patientContext={patientContext}
              warnings={recommendations?.warnings || []}
              modifications={customizeResult?.modifications || []}
              totalCost={totalCost}
              onRemoveOrder={handleDeselectOrder}
              onReorderOrders={handleReorderOrders}
              onUpdateUrgency={handleUpdateUrgency}
              onPlaceOrders={handlePlaceOrders}
              onClearAll={handleClearAll}
              isPlacing={placingOrders}
            />
          </div>
        </div>
      )}

      {activeTab === 'bundles' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <BookOpenIcon className="h-5 w-5 text-indigo-500" />
              Evidence-Based Order Bundles
            </h3>
            <p className="text-gray-600">
              Pre-configured order sets based on clinical guidelines for common conditions.
              Click on a bundle to view details and apply to your current order.
            </p>
          </div>

          {loadingBundles ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bundles.map((bundle) => (
                <OrderBundleCard
                  key={bundle.id}
                  bundle={bundle}
                  bundleDetails={selectedBundle === bundle.id ? bundleDetails : null}
                  isSelected={selectedBundle === bundle.id}
                  isLoading={loadingBundleDetails && selectedBundle === bundle.id}
                  onSelect={(id) => setSelectedBundle(selectedBundle === id ? null : id)}
                  onApply={handleApplyBundle}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Statistics Summary */}
          {orderStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Orders Today</p>
                    <p className="text-2xl font-bold text-gray-900">{orderStats.totalOrdersToday}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600">
                    <ChartBarIcon className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{orderStats.pendingOrders}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-yellow-100 text-yellow-600">
                    <ClockIcon className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{orderStats.completedOrders}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-100 text-green-600">
                    <CheckCircleIcon className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Cancelled</p>
                    <p className="text-2xl font-bold text-red-600">{orderStats.cancelledOrders}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-100 text-red-600">
                    <XCircleIcon className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-lg">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Top Diagnoses</p>
                  <div className="space-y-1">
                    {orderStats.commonDiagnoses.slice(0, 3).map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 truncate">{d.diagnosis}</span>
                        <span className="text-gray-500 ml-2">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters Section */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <FunnelIcon className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Search
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={historyFilters.patientSearch}
                    onChange={(e) => {
                      setHistoryFilters({ ...historyFilters, patientSearch: e.target.value });
                      setCurrentPage(1);
                    }}
                    placeholder="Name or ID..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={historyFilters.startDate}
                    onChange={(e) => {
                      setHistoryFilters({ ...historyFilters, startDate: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={historyFilters.endDate}
                    onChange={(e) => {
                      setHistoryFilters({ ...historyFilters, endDate: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={historyFilters.status}
                  onChange={(e) => {
                    setHistoryFilters({ ...historyFilters, status: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={historyFilters.category}
                  onChange={(e) => {
                    setHistoryFilters({ ...historyFilters, category: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Categories</option>
                  <option value="Lab">Lab</option>
                  <option value="Imaging">Imaging</option>
                  <option value="Medication">Medication</option>
                  <option value="Procedure">Procedure</option>
                  <option value="Consult">Consult</option>
                </select>
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setHistoryFilters({
                    patientSearch: '',
                    startDate: '',
                    endDate: '',
                    status: 'all',
                    category: 'all',
                  });
                  setCurrentPage(1);
                }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Order History Table */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-indigo-500" />
                <h3 className="text-lg font-semibold text-gray-900">Order History</h3>
                <span className="text-sm text-gray-500">({totalOrders} orders)</span>
              </div>
              <button
                onClick={loadOrderHistory}
                className="px-3 py-1 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
              </div>
            ) : orderHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <CubeIcon className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium">No orders found</p>
                <p className="text-sm mt-2">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Diagnosis
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ordered By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orderHistory.map((order) => (
                      <>
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                className="p-1 rounded hover:bg-gray-200 transition-colors"
                              >
                                {expandedOrderId === order.id ? (
                                  <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                )}
                              </button>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{order.orderNumber}</p>
                                <p className="text-xs text-gray-500">{formatDate(order.orderedAt)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{order.patientName}</p>
                              <p className="text-xs text-gray-500">{order.patientId}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm text-gray-900 truncate max-w-[200px]" title={order.diagnosis}>
                                {order.diagnosis}
                              </p>
                              {order.icdCode && (
                                <p className="text-xs text-indigo-600">{order.icdCode}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {order.itemCount} items
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(order.status)}`}>
                              {order.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-medium text-gray-900">
                              <CurrencyDisplay amount={order.totalCost} />
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm text-gray-900">{order.orderedBy}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="View Details"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setShowReorderModal(order.id)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                                title="Reorder"
                              >
                                <DocumentPlusIcon className="h-4 w-4" />
                              </button>
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => setShowCancelModal(order.id)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Cancel Order"
                                >
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Expanded Order Details */}
                        {expandedOrderId === order.id && (
                          <tr key={`${order.id}-expanded`}>
                            <td colSpan={8} className="px-6 py-4 bg-gray-50">
                              <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-gray-900">Order Items</h4>
                                <div className="grid gap-3">
                                  {order.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="p-4 rounded-xl bg-white border border-gray-200 flex items-center justify-between"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                          <p className="font-medium text-gray-900">{item.name}</p>
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getUrgencyBadge(item.urgency)}`}>
                                            {item.urgency}
                                          </span>
                                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                            {item.category}
                                          </span>
                                        </div>
                                        {item.rationale && (
                                          <p className="text-sm text-gray-500 mt-1">{item.rationale}</p>
                                        )}
                                        {item.warnings && item.warnings.length > 0 && (
                                          <div className="flex items-center gap-1 mt-1">
                                            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                                            <span className="text-xs text-amber-600">{item.warnings.join(', ')}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(item.status)}`}>
                                          {item.status}
                                        </span>
                                        {item.executedBy && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            By: {item.executedBy}
                                          </p>
                                        )}
                                        {item.executedAt && (
                                          <p className="text-xs text-gray-400">
                                            {formatDate(item.executedAt)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loadingHistory && orderHistory.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="text-sm text-gray-700">per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages} ({totalOrders} total)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-lg text-sm ${
                            currentPage === pageNum
                              ? 'bg-indigo-500 text-white'
                              : 'border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cancel Order Modal */}
          {showCancelModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancel Order</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to cancel this order? This action cannot be undone.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cancellation Reason (optional)
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Enter reason for cancellation..."
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowCancelModal(null);
                      setCancelReason('');
                    }}
                    className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Keep Order
                  </button>
                  <button
                    onClick={() => handleCancelOrder(showCancelModal)}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reorder Modal */}
          {showReorderModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Reorder for New Patient</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Copy this order set to a new patient. The orders will be added to your current selection.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Patient ID
                  </label>
                  <input
                    type="text"
                    value={reorderPatientId}
                    onChange={(e) => setReorderPatientId(e.target.value)}
                    placeholder="Enter patient ID..."
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowReorderModal(null);
                      setReorderPatientId('');
                    }}
                    className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReorder(showReorderModal)}
                    className="px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                  >
                    Copy Orders
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BoltIcon className="h-5 w-5 text-indigo-500" />
          Quick Order Shortcuts
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { name: 'Sepsis Workup', icon: FireIcon, color: 'from-red-500 to-rose-600' },
            { name: 'Chest Pain', icon: HeartIcon, color: 'from-pink-500 to-rose-600' },
            { name: 'Stroke Alert', icon: BoltIcon, color: 'from-purple-500 to-indigo-600' },
            { name: 'DKA Protocol', icon: BeakerIcon, color: 'from-amber-500 to-orange-600' },
            { name: 'GI Bleed', icon: ShieldExclamationIcon, color: 'from-emerald-500 to-teal-600' },
            { name: 'AKI Workup', icon: BeakerIcon, color: 'from-cyan-500 to-blue-600' },
          ].map((shortcut) => (
            <button
              key={shortcut.name}
              onClick={() => {
                setDiagnosis(shortcut.name);
                setActiveTab('diagnosis');
              }}
              className={`p-4 rounded-xl bg-gradient-to-br ${shortcut.color} text-white hover:shadow-lg transition-all`}
            >
              <shortcut.icon className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm font-medium">{shortcut.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
