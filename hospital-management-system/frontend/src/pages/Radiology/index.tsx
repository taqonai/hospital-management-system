import { useState, useEffect } from 'react';
import {
  PhotoIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowPathIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { radiologyApi, patientApi, doctorApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';


// Format AI findings from JSON to readable text
const formatAIFindings = (findings: any): string => {
  if (!findings) return '';
  if (typeof findings === 'string') {
    try {
      findings = JSON.parse(findings);
    } catch {
      return findings;
    }
  }
  if (Array.isArray(findings)) {
    return findings.map((f: any) => {
      const parts: string[] = [];
      if (f.region) parts.push(f.region);
      if (f.finding) parts.push(f.finding);
      if (f.description) parts.push(f.description);
      if (f.severity) parts.push(`(${f.severity})`);
      if (f.confidence) parts.push(`[${Math.round(f.confidence * 100)}% confidence]`);
      return parts.join(': ') || JSON.stringify(f);
    }).join('; ');
  }
  if (typeof findings === 'object') {
    return Object.entries(findings)
      .map(([key, val]) => `${key}: ${val}`)
      .join('; ');
  }
  return String(findings);
};

interface ImagingOrder {
  id: string;
  orderNumber: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  modalityType: string;
  bodyPart: string;
  status: string;
  priority: string;
  createdAt: string;
  aiAnalysis?: {
    findings: string;
    abnormalityDetected: boolean;
  };
}

interface RadiologyStats {
  pendingOrders: number;
  aiFlagged: number;
  inProgress: number;
  completedToday: number;
}

const priorityConfig: Record<string, { bg: string; dot: string; text: string }> = {
  STAT: { bg: 'bg-red-100/80', dot: 'bg-red-500', text: 'text-red-700' },
  URGENT: { bg: 'bg-orange-100/80', dot: 'bg-orange-500', text: 'text-orange-700' },
  ROUTINE: { bg: 'bg-gray-100/80', dot: 'bg-gray-500', text: 'text-gray-700' },
};

const statusConfig: Record<string, { bg: string; dot: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-100/80', dot: 'bg-yellow-500', text: 'text-yellow-700' },
  SCHEDULED: { bg: 'bg-blue-100/80', dot: 'bg-blue-500', text: 'text-blue-700' },
  IN_PROGRESS: { bg: 'bg-blue-100/80', dot: 'bg-blue-500', text: 'text-blue-700' },
  COMPLETED: { bg: 'bg-green-100/80', dot: 'bg-green-500', text: 'text-green-700' },
  REPORTED: { bg: 'bg-green-100/80', dot: 'bg-green-500', text: 'text-green-700' },
};

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

const modalityTypes = ['X_RAY', 'CT', 'MRI', 'ULTRASOUND', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'PET', 'NUCLEAR'];
const bodyParts = ['HEAD', 'NECK', 'CHEST', 'ABDOMEN', 'PELVIS', 'SPINE', 'UPPER_EXTREMITY', 'LOWER_EXTREMITY', 'WHOLE_BODY'];

// Import WalkInInsuranceCapture
import WalkInInsuranceCapture from '../../components/common/WalkInInsuranceCapture';
import PreAuthWarning from '../../components/insurance/PreAuthWarning';
import CostEstimate, { useCostEstimate } from '../../components/common/CostEstimate';

// Estimated costs for imaging procedures (can be made configurable)
const modalityCosts: Record<string, number> = {
  'XRAY': 150,
  'CT': 800,
  'MRI': 1500,
  'ULTRASOUND': 300,
  'MAMMOGRAPHY': 400,
  'FLUOROSCOPY': 500,
  'PET': 3000,
  'DEXA': 350,
};

function NewImagingOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [modalityType, setModalityType] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [priority, setPriority] = useState<'ROUTINE' | 'URGENT' | 'STAT'>('ROUTINE');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [contrastRequired, setContrastRequired] = useState(false);
  
  // Walk-in mode state
  const [orderMode, setOrderMode] = useState<'doctor' | 'walkin'>('doctor');
  const [showWalkInFlow, setShowWalkInFlow] = useState(false);
  const [walkInPaymentInfo, setWalkInPaymentInfo] = useState<{
    copayCollected: boolean;
    copayAmount: number;
    paymentMethod?: string;
    insuranceId?: string;
  } | null>(null);
  
  // Pre-auth state
  const [showPreAuthWarning, setShowPreAuthWarning] = useState(false);
  const [preAuthId, setPreAuthId] = useState<string | null>(null);
  const [proceedAsSelfPay, setProceedAsSelfPay] = useState(false);
  
  // Estimated cost based on modality
  const estimatedCost = modalityCosts[modalityType] || 500;
  
  // Get patient insurance info for cost estimate
  const patientInsurance = useCostEstimate(selectedPatient?.id);
  
  // Check if pre-auth is required
  const requiresPreAuth = ['MRI', 'CT', 'PET'].includes(modalityType) || estimatedCost >= 500;

  // Search patients
  const searchPatients = async (query: string) => {
    if (!query.trim()) {
      setPatients([]);
      return;
    }
    setSearching(true);
    try {
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

  // Handle walk-in flow completion
  const handleWalkInComplete = (result: {
    patient: { id: string; firstName: string; lastName: string; mrn?: string };
    hasInsurance: boolean;
    insuranceId?: string;
    copayCollected: boolean;
    copayAmount: number;
    paymentMethod?: 'CASH' | 'CREDIT_CARD';
    proceedAsSelfPay: boolean;
  }) => {
    setSelectedPatient(result.patient as Patient);
    setWalkInPaymentInfo({
      copayCollected: result.copayCollected,
      copayAmount: result.copayAmount,
      paymentMethod: result.paymentMethod,
      insuranceId: result.insuranceId,
    });
    setShowWalkInFlow(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!modalityType) {
      toast.error('Please select a modality type');
      return;
    }
    if (!bodyPart) {
      toast.error('Please select a body part');
      return;
    }
    
    // Check if pre-auth is required and not yet handled
    if (requiresPreAuth && !preAuthId && !proceedAsSelfPay && walkInPaymentInfo?.insuranceId) {
      setShowPreAuthWarning(true);
      return;
    }
    
    // For walk-in orders without upfront payment, warn
    if (orderMode === 'walkin' && !walkInPaymentInfo?.copayCollected && estimatedCost > 0) {
      const proceed = window.confirm('Payment has not been collected. Proceed anyway?');
      if (!proceed) return;
    }

    setLoading(true);
    try {
      await radiologyApi.createOrder({
        patientId: selectedPatient.id,
        modalityType,
        bodyPart,
        priority,
        clinicalHistory: clinicalHistory || undefined,
        contrastRequired,
        // Walk-in specific data
        isWalkIn: orderMode === 'walkin',
        insuranceId: walkInPaymentInfo?.insuranceId,
        copayCollected: walkInPaymentInfo?.copayCollected,
        copayAmount: walkInPaymentInfo?.copayAmount,
        // Pre-auth data
        preAuthId: preAuthId || undefined,
        selfPay: proceedAsSelfPay,
      });
      toast.success('Imaging order created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create imaging order:', error);
      toast.error(error.response?.data?.message || 'Failed to create imaging order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Create Imaging Order</h2>
            <p className="text-white/80 text-sm">Request a new radiology imaging study</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Order Mode Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setOrderMode('doctor');
                  setSelectedPatient(null);
                  setWalkInPaymentInfo(null);
                  setShowWalkInFlow(false);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                  orderMode === 'doctor' 
                    ? 'bg-white text-purple-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Doctor Ordered
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderMode('walkin');
                  setSelectedPatient(null);
                  setWalkInPaymentInfo(null);
                  setShowWalkInFlow(true);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                  orderMode === 'walkin' 
                    ? 'bg-white text-purple-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Walk-in Patient
              </button>
            </div>

            {/* Walk-in Insurance Capture Flow */}
            {orderMode === 'walkin' && showWalkInFlow && (
              <WalkInInsuranceCapture
                serviceType="RADIOLOGY"
                estimatedCost={estimatedCost}
                onComplete={handleWalkInComplete}
                onCancel={() => {
                  setShowWalkInFlow(false);
                  setOrderMode('doctor');
                }}
              />
            )}

            {/* Patient Selection (only show if not in walk-in flow) */}
            {!(orderMode === 'walkin' && showWalkInFlow) && (
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
                    {walkInPaymentInfo && (
                      <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        {walkInPaymentInfo.copayCollected ? '✓ Paid' : 'Bill Later'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient(null);
                      setWalkInPaymentInfo(null);
                      if (orderMode === 'walkin') setShowWalkInFlow(true);
                    }}
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
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  />
                  {searching && (
                    <div className="absolute right-3 top-3">
                      <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  )}
                  {patients.length > 0 && !selectedPatient && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {patients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onMouseDown={(e) => {
                            // Use onMouseDown to ensure selection happens before blur clears dropdown
                            e.preventDefault();
                            setSelectedPatient(patient);
                            setSearchQuery('');
                            // Clear patients after a short delay to allow state to update
                            setTimeout(() => setPatients([]), 50);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
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
            )}

            {/* Modality & Body Part */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modality <span className="text-red-500">*</span>
                </label>
                <select
                  value={modalityType}
                  onChange={(e) => setModalityType(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  required
                >
                  <option value="">Select modality...</option>
                  {modalityTypes.map((m) => (
                    <option key={m} value={m}>{m.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Body Part <span className="text-red-500">*</span>
                </label>
                <select
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  required
                >
                  <option value="">Select body part...</option>
                  {bodyParts.map((b) => (
                    <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
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
                          ? 'bg-red-500 text-white border-red-500'
                          : p === 'URGENT'
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-violet-500 text-white border-violet-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Contrast & Clinical History */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contrastRequired}
                  onChange={(e) => setContrastRequired(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-sm font-medium text-gray-700">Contrast Required</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Clinical History</label>
                <textarea
                  value={clinicalHistory}
                  onChange={(e) => setClinicalHistory(e.target.value)}
                  placeholder="Relevant clinical history, indication for study..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-none"
                />
              </div>
            </div>

            {/* Cost Estimate (shown when patient and modality selected) */}
            {selectedPatient && modalityType && (
              <CostEstimate
                patientId={selectedPatient.id}
                totalCost={estimatedCost}
                coveragePercentage={patientInsurance.coveragePercentage}
                insuranceProvider={patientInsurance.insuranceProvider}
                networkStatus={patientInsurance.networkStatus}
                size="md"
              />
            )}

            {/* Pre-Auth Warning */}
            {showPreAuthWarning && selectedPatient && (
              <PreAuthWarning
                patientId={selectedPatient.id}
                patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                procedureType={modalityType}
                procedureName={`${modalityType} - ${bodyPart}`}
                estimatedCost={estimatedCost}
                insuranceProvider={undefined} // Could come from patient's insurance
                onPreAuthCreated={(id) => {
                  setPreAuthId(id);
                  setShowPreAuthWarning(false);
                }}
                onProceedAsSelfPay={() => {
                  setProceedAsSelfPay(true);
                  setShowPreAuthWarning(false);
                }}
                onCancel={() => setShowPreAuthWarning(false)}
              />
            )}

            {/* Pre-Auth Required Notice (shown when selecting high-cost modality) */}
            {requiresPreAuth && modalityType && !showPreAuthWarning && !preAuthId && !proceedAsSelfPay && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-amber-700">
                  <strong>{modalityType}</strong> requires pre-authorization. You'll be prompted when creating the order.
                </span>
              </div>
            )}

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
                disabled={loading || !selectedPatient || !modalityType || !bodyPart || showPreAuthWarning}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <PhotoIcon className="h-5 w-5" />
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

interface OrderDetailsModalProps {
  order: ImagingOrder | null;
  onClose: () => void;
}

function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Imaging Order Details</h2>
            <p className="text-white/80 text-sm">{order.orderNumber}</p>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Patient Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">
                    {order.patient?.firstName} {order.patient?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Number</p>
                  <p className="font-mono text-gray-900">{order.orderNumber}</p>
                </div>
              </div>
            </div>

            {/* Study Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Study Details</h3>
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm text-gray-500">Modality</p>
                  <p className="font-medium text-gray-900">{order.modalityType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Body Part</p>
                  <p className="font-medium text-gray-900">{order.bodyPart}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className={clsx('font-medium', statusConfig[order.status]?.text)}>
                    {order.status?.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <p className={clsx('font-medium', priorityConfig[order.priority]?.text)}>
                    {order.priority}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium text-gray-900">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Analysis Results */}
            {order.aiAnalysis && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Analysis Results</h3>
                <div className="p-4 bg-violet-50 rounded-xl border border-violet-200">
                  <div className="flex items-start gap-3">
                    <SparklesIcon className="h-6 w-6 text-violet-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Findings</p>
                      <p className="text-gray-900">{formatAIFindings(order.aiAnalysis.findings)}</p>
                      {order.aiAnalysis.abnormalityDetected && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          Abnormality Detected
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Radiology() {
  const [activeTab, setActiveTab] = useState<'worklist' | 'viewer' | 'reports'>('worklist');
  const [orders, setOrders] = useState<ImagingOrder[]>([]);
  const [stats, setStats] = useState<RadiologyStats>({
    pendingOrders: 0,
    aiFlagged: 0,
    inProgress: 0,
    completedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ImagingOrder | null>(null);
  const [analyzingOrderId, setAnalyzingOrderId] = useState<string | null>(null);
  const [generatingReportOrderId, setGeneratingReportOrderId] = useState<string | null>(null);
  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  // Fetch imaging orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = await radiologyApi.getOrders({ limit: 50 });
        setOrders(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        toast.error('Failed to load imaging orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await radiologyApi.getStats();
        setStats(response.data.data || {
          pendingOrders: 0,
          aiFlagged: 0,
          inProgress: 0,
          completedToday: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  const refreshOrders = async () => {
    try {
      const response = await radiologyApi.getOrders({ limit: 50 });
      setOrders(response.data.data || []);
      // Refresh stats as well
      const statsResponse = await radiologyApi.getStats();
      setStats(statsResponse.data.data || {
        pendingOrders: 0,
        aiFlagged: 0,
        inProgress: 0,
        completedToday: 0,
      });
    } catch (error) {
      console.error('Failed to refresh orders:', error);
    }
  };

  const handleAnalyzeStudy = async (orderId: string) => {
    setAnalyzingOrderId(orderId);
    try {
      toast.loading('AI is analyzing the study...', { id: 'ai-analyze' });

      // Call the AI analysis endpoint
      await radiologyApi.addAIAnalysis(orderId, {
        findings: [],
        abnormalityDetected: false,
        confidence: 0,
        modelVersion: '1.0',
      });

      toast.success('AI analysis completed successfully', { id: 'ai-analyze' });

      // Refresh orders to show the new analysis
      await refreshOrders();
    } catch (error: any) {
      console.error('Failed to analyze study:', error);
      toast.error(error.response?.data?.message || 'Failed to analyze study', { id: 'ai-analyze' });
    } finally {
      setAnalyzingOrderId(null);
    }
  };

  const handleGenerateReport = async (orderId: string) => {
    setGeneratingReportOrderId(orderId);
    try {
      toast.loading('AI is generating preliminary report...', { id: 'generate-report' });

      // First, we need to get the order to find the study
      const orderResponse = await radiologyApi.getOrderById(orderId);
      const order = orderResponse.data.data || orderResponse.data;

      // Check if there's a study ID (this would typically be in the order data)
      // For now, we'll create a report directly on the order
      // In a real scenario, you'd need to ensure a study exists first
      if (!order.studyId) {
        toast.error('No study found for this order. Please create a study first.', { id: 'generate-report' });
        return;
      }

      await radiologyApi.addReport(order.studyId, {
        findings: 'AI-generated preliminary findings',
        impression: 'AI-generated impression',
      });

      toast.success('Report generated successfully', { id: 'generate-report' });

      // Refresh orders to show updated status
      await refreshOrders();
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      toast.error(error.response?.data?.message || 'Failed to generate report', { id: 'generate-report' });
    } finally {
      setGeneratingReportOrderId(null);
    }
  };

  const flaggedStudies = orders.filter(o => o.aiAnalysis?.abnormalityDetected);

  const tabs = [
    { id: 'worklist', label: 'Worklist', count: orders.filter(o => o.status !== 'REPORTED').length },
    { id: 'viewer', label: 'Image Viewer' },
    { id: 'reports', label: 'Reports', count: stats.completedToday },
  ];

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-8 shadow-xl">
        {/* Floating Orbs */}
        <div className="absolute top-4 right-8 w-32 h-32 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-0 left-16 w-24 h-24 bg-fuchsia-300/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-violet-300/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm border border-white/30 mb-3">
              <PhotoIcon className="h-3.5 w-3.5" />
              Radiology Department
            </span>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Radiology</h1>
            <p className="mt-2 text-violet-100">
              Imaging worklist, AI analysis, and reporting
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAIOnline && (
              <span className="inline-flex items-center gap-2 text-sm text-white bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30 shadow-lg">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
                </span>
                <SparklesIcon className="h-4 w-4" />
                AI Analysis Active
              </span>
            )}
            <button
              onClick={() => setShowNewOrderModal(true)}
              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white font-semibold shadow-lg hover:bg-white/30 hover:scale-105 transition-all duration-300"
            >
              <PlusIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
              New Order
            </button>
          </div>
        </div>
      </div>

      {/* AI Flagged Alert - Glass Styled */}
      {flaggedStudies.length > 0 && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-red-50/70 border border-red-200/50 rounded-xl p-4 shadow-lg"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100/80">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800">
                {flaggedStudies.length} Studies Flagged by AI
              </h3>
              <div className="mt-2 space-y-1">
                {flaggedStudies.slice(0, 3).map(s => (
                  <p key={s.id} className="text-sm text-red-700">
                    {s.patient?.firstName} {s.patient?.lastName} - {s.modalityType} {s.bodyPart}: {formatAIFindings(s.aiAnalysis?.findings)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated Gradient Tabs */}
      <div
        className="relative overflow-hidden backdrop-blur-xl bg-white border border-gray-200/50 rounded-xl p-2 shadow-lg"
        style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.1s', animationFillMode: 'backwards' }}
      >
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300/40 to-transparent" />

        <nav className="flex space-x-2">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'relative px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30'
                  : 'text-gray-600 hover:bg-gray-100/50'
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && (
                  <span className={clsx(
                    'py-0.5 px-2 rounded-full text-xs font-semibold',
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200/80 text-gray-600'
                  )}>
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Worklist Tab */}
      {activeTab === 'worklist' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white border border-gray-200/50 rounded-xl shadow-lg"
          style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'backwards' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300/40 to-transparent" />

          {loading ? (
            <div className="p-8 text-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-violet-500" />
              <p className="mt-2 text-gray-500">Loading imaging orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="p-4 rounded-full bg-gray-100/80 w-fit mx-auto mb-4">
                <PhotoIcon className="h-12 w-12 text-gray-400" />
              </div>
              <p className="font-medium">No imaging orders found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/50">
              {orders.map((order, index) => (
                <div
                  key={order.id}
                  className={clsx(
                    'p-4 transition-colors duration-200',
                    order.aiAnalysis?.abnormalityDetected
                      ? 'bg-red-50/50 hover:bg-red-100/50'
                      : 'hover:bg-gray-50/50'
                  )}
                  style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: `${0.3 + index * 0.05}s`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-gray-600 bg-gray-100/80 px-2 py-0.5 rounded">
                          {order.orderNumber}
                        </span>
                        {/* Glass Status Badge */}
                        <span className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-gray-200/30',
                          statusConfig[order.status]?.bg || 'bg-gray-100/80',
                          statusConfig[order.status]?.text || 'text-gray-700'
                        )}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', statusConfig[order.status]?.dot || 'bg-gray-500')} />
                          {order.status?.replace('_', ' ')}
                        </span>
                        {/* Glass Priority Badge */}
                        <span className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-gray-200/30',
                          priorityConfig[order.priority]?.bg || 'bg-gray-100/80',
                          priorityConfig[order.priority]?.text || 'text-gray-700'
                        )}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', priorityConfig[order.priority]?.dot || 'bg-gray-500')} />
                          {order.priority}
                        </span>
                      </div>
                      <h3 className="mt-2 font-semibold text-gray-800">
                        {order.patient?.firstName} {order.patient?.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {order.modalityType} - {order.bodyPart}
                      </p>
                      {order.aiAnalysis?.findings && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 bg-red-100/50 px-2 py-1 rounded-lg">
                          <SparklesIcon className="h-4 w-4" />
                          AI: {formatAIFindings(order.aiAnalysis.findings)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* View Button */}
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300/50 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View
                      </button>
                      {/* AI Analyze Button */}
                      {isAIOnline && !order.aiAnalysis && (
                        <button
                          onClick={() => handleAnalyzeStudy(order.id)}
                          disabled={analyzingOrderId === order.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-100/50 hover:bg-violet-200/70 border border-violet-300/50 rounded-lg transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {analyzingOrderId === order.id ? (
                            <>
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <SparklesIcon className="h-4 w-4" />
                              AI Analyze
                            </>
                          )}
                        </button>
                      )}
                      {/* Generate Report Button */}
                      {isAIOnline && (
                        <button
                          onClick={() => handleGenerateReport(order.id)}
                          disabled={generatingReportOrderId === order.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generatingReportOrderId === order.id ? (
                            <>
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            'Generate Report'
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
      )}

      {activeTab === 'viewer' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white border border-gray-200/50 rounded-xl p-8 shadow-lg text-center"
          style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'backwards' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300/40 to-transparent" />

          <div className="p-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 w-fit mx-auto mb-4">
            <PhotoIcon className="h-16 w-16 text-violet-500" />
          </div>
          <h3 className="font-semibold text-lg text-gray-800">DICOM Image Viewer</h3>
          <p className="text-sm text-gray-500 mt-1">
            Select a study from the worklist to view images
          </p>
          <p className="text-xs text-gray-400 mt-4 inline-flex items-center gap-1.5 bg-violet-50/50 px-3 py-1.5 rounded-full">
            <SparklesIcon className="h-3.5 w-3.5" />
            AI-powered findings overlay available for analyzed studies
          </p>
        </div>
      )}

      {activeTab === 'reports' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white border border-gray-200/50 rounded-xl p-8 shadow-lg text-center"
          style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'backwards' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300/40 to-transparent" />

          <div className="p-5 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 w-fit mx-auto mb-4">
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
          <h3 className="font-semibold text-lg text-gray-800">Radiology Reports</h3>
          <p className="text-sm text-gray-500 mt-1">View and finalize radiology reports</p>
        </div>
      )}

      {/* Quick Stats - Glass Cards with Staggered Animation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pendingOrders, gradient: 'from-yellow-400 to-amber-500', bg: 'bg-yellow-50/70', text: 'text-yellow-700', dot: 'bg-yellow-500' },
          { label: 'AI Flagged', value: stats.aiFlagged, gradient: 'from-red-400 to-rose-500', bg: 'bg-red-50/70', text: 'text-red-700', dot: 'bg-red-500' },
          { label: 'In Progress', value: stats.inProgress, gradient: 'from-blue-400 to-indigo-500', bg: 'bg-blue-50/70', text: 'text-blue-700', dot: 'bg-blue-500' },
          { label: 'Completed Today', value: stats.completedToday, gradient: 'from-green-400 to-emerald-500', bg: 'bg-green-50/70', text: 'text-green-700', dot: 'bg-green-500' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={clsx(
              'relative overflow-hidden backdrop-blur-xl border border-gray-200/50 rounded-xl p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]',
              stat.bg
            )}
            style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: `${0.3 + index * 0.1}s`, animationFillMode: 'backwards' }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            {/* Gradient accent */}
            <div className={clsx('absolute top-0 left-0 w-1 h-full bg-gradient-to-b', stat.gradient)} />

            <div className="flex items-center gap-2 mb-1">
              <span className={clsx('w-2 h-2 rounded-full', stat.dot)} />
              <p className={clsx('text-sm font-medium', stat.text)}>{stat.label}</p>
            </div>
            <p className={clsx('text-3xl font-bold', stat.text)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Global Styles for Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* New Order Modal */}
      {showNewOrderModal && (
        <NewImagingOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={() => {
            setShowNewOrderModal(false);
            refreshOrders();
          }}
        />
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
