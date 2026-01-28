import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  UserIcon,
  ClipboardDocumentListIcon,
  HeartIcon,
  DocumentTextIcon,
  BeakerIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { ipdApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import VitalsTrendChart from '../../components/nursing/VitalsTrendChart';

type Tab = 'overview' | 'orders' | 'vitals' | 'notes' | 'medications' | 'discharge';

interface Admission {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup?: string;
    phone?: string;
    address?: string;
  };
  bed: {
    id: string;
    bedNumber: string;
    ward: {
      id: string;
      name: string;
      type: string;
    };
  };
  admissionDate: string;
  admittingDoctor?: {
    id: string;
    user?: {
      firstName: string;
      lastName: string;
    };
    specialization?: string;
  };
  chiefComplaint?: string;
  diagnosis?: string[];
  icdCodes?: string[];
  treatmentPlan?: string;
  status: string;
  news2Score?: number;
  latestVitals?: any;
  prescriptions?: any[];
  doctorOrders?: any[];
  progressNotes?: any[];
  nursingNotes?: any[];
  dischargeSummary?: any;
}

interface Order {
  id: string;
  orderType: string;
  description: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  status: 'ORDERED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  orderedBy: string;
  orderedByUser?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  notes?: string;
}

interface Note {
  id: string;
  noteType: 'SOAP' | 'GENERAL';
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  content?: string;
  authorId: string;
  authorRole: string;
  author?: {
    user?: {
      firstName: string;
      lastName: string;
    };
  };
  createdAt: string;
}

export default function AdmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'overview';

  // Permission flags
  const canDischarge = hasPermission('ipd:discharge');
  const canWriteOrders = hasPermission('ipd:admissions:write');
  const canWriteNotes = hasPermission('ipd:admissions:write');
  const canRecordVitals = hasPermission('ipd:admissions:write');
  const canWriteNursingNotes = hasPermission('ipd:nursing:notes');
  
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  
  // Modal states
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  
  // Form states
  const [orderForm, setOrderForm] = useState({
    orderType: 'Medication',
    priority: 'ROUTINE' as 'ROUTINE' | 'URGENT' | 'STAT',
    description: '',
    notes: '',
  });
  
  const [noteForm, setNoteForm] = useState({
    noteType: 'SOAP' as 'SOAP' | 'GENERAL',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    content: '',
  });
  
  const [vitalsForm, setVitalsForm] = useState({
    respiratoryRate: 16,
    oxygenSaturation: 98,
    supplementalOxygen: false,
    bloodPressureSys: 120,
    bloodPressureDia: 80,
    heartRate: 80,
    temperature: 37.0,
    consciousness: 'alert' as string,
  });
  const [savingVitals, setSavingVitals] = useState(false);

  const [prescriptionForm, setPrescriptionForm] = useState({
    medications: [] as Array<{
      drugId: string;
      drugName: string;
      dosage: string;
      frequency: string;
      route: string;
      duration: string;
      instructions: string;
    }>,
    notes: '',
  });
  const [savingPrescription, setSavingPrescription] = useState(false);

  const [dischargeForm, setDischargeForm] = useState({
    dischargeDate: new Date().toISOString().split('T')[0],
    dischargeType: 'REGULAR',
    conditionAtDischarge: 'IMPROVED',
    finalDiagnosis: [] as string[],
    proceduresPerformed: [] as string[],
    medicationsOnDischarge: [] as Array<{ name: string; dose: string; frequency: string; duration: string }>,
    followUpInstructions: '',
    followUpDate: '',
    dietaryInstructions: '',
    activityRestrictions: '',
    warningSigns: [] as string[],
  });
  
  const [tempInput, setTempInput] = useState('');
  const [tempMedication, setTempMedication] = useState({ name: '', dose: '', frequency: '', duration: '' });

  useEffect(() => {
    loadAdmissionDetail();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    } else if (activeTab === 'notes') {
      loadNotes();
    }
  }, [activeTab]);

  const loadAdmissionDetail = async () => {
    try {
      const response = await ipdApi.getAdmissionDetail(id!);
      setAdmission(response.data.data);
    } catch (error) {
      console.error('Failed to load admission:', error);
      toast.error('Failed to load admission details');
      navigate('/ipd');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await ipdApi.getOrders(id!);
      setOrders(response.data.data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await ipdApi.getNotes(id!);
      setNotes(response.data.data || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const handleCreateOrder = async () => {
    try {
      await ipdApi.createOrder(id!, orderForm);
      toast.success('Order created successfully');
      setShowOrderModal(false);
      setOrderForm({
        orderType: 'Medication',
        priority: 'ROUTINE',
        description: '',
        notes: '',
      });
      loadOrders();
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error('Failed to create order');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await ipdApi.updateOrderStatus(id!, orderId, { status });
      toast.success('Order status updated');
      loadOrders();
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('Failed to update order');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
      await ipdApi.cancelOrder(id!, orderId);
      toast.success('Order cancelled');
      loadOrders();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error('Failed to cancel order');
    }
  };

  const handleCreateNote = async () => {
    try {
      await ipdApi.createNote(id!, noteForm);
      toast.success('Note added successfully');
      setShowNoteModal(false);
      setNoteForm({
        noteType: 'SOAP',
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        content: '',
      });
      loadNotes();
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to add note');
    }
  };

  const handleRecordVitals = async () => {
    setSavingVitals(true);
    try {
      const result = await ipdApi.recordVitals(id!, vitalsForm);
      const data = result.data?.data;
      toast.success(`Vitals recorded. NEWS2 Score: ${data?.news2Score || 'N/A'} (${data?.riskLevel || 'N/A'})`);
      setShowVitalsModal(false);
      // Reset form
      setVitalsForm({
        respiratoryRate: 16,
        oxygenSaturation: 98,
        supplementalOxygen: false,
        bloodPressureSys: 120,
        bloodPressureDia: 80,
        heartRate: 80,
        temperature: 37.0,
        consciousness: 'alert',
      });
      // Refresh admission data
      loadAdmissionDetail();
    } catch (error: any) {
      console.error('Failed to record vitals:', error);
      toast.error(error.response?.data?.message || 'Failed to record vitals');
    } finally {
      setSavingVitals(false);
    }
  };

  const handleCreatePrescription = async () => {
    if (prescriptionForm.medications.length === 0) {
      toast.error('Please add at least one medication');
      return;
    }

    // Validate medications
    for (const med of prescriptionForm.medications) {
      if (!med.drugId || !med.dosage || !med.frequency || !med.route) {
        toast.error('Please fill in all required medication fields');
        return;
      }
    }

    setSavingPrescription(true);
    try {
      await ipdApi.createPrescription(id!, {
        medications: prescriptionForm.medications.map(m => ({
          drugId: m.drugId,
          dosage: m.dosage,
          frequency: m.frequency,
          route: m.route,
          duration: m.duration,
          instructions: m.instructions,
        })),
        notes: prescriptionForm.notes,
      });
      toast.success('Prescription created successfully');
      setShowPrescriptionModal(false);
      setPrescriptionForm({ medications: [], notes: '' });
      loadAdmissionDetail();
    } catch (error: any) {
      console.error('Failed to create prescription:', error);
      toast.error(error.response?.data?.message || 'Failed to create prescription');
    } finally {
      setSavingPrescription(false);
    }
  };

  const handleAddMedication = () => {
    setPrescriptionForm({
      ...prescriptionForm,
      medications: [
        ...prescriptionForm.medications,
        { drugId: '', drugName: '', dosage: '', frequency: '', route: 'Oral', duration: '', instructions: '' }
      ]
    });
  };

  const handleRemoveMedication = (index: number) => {
    setPrescriptionForm({
      ...prescriptionForm,
      medications: prescriptionForm.medications.filter((_, i) => i !== index)
    });
  };

  const handleUpdateTreatmentPlan = async (value: string) => {
    try {
      await ipdApi.updateAdmission(id!, { treatmentPlan: value });
      toast.success('Treatment plan updated');
    } catch (error) {
      console.error('Failed to update treatment plan:', error);
      toast.error('Failed to update treatment plan');
    }
  };

  const handleDischarge = async () => {
    if (!confirm('Are you sure you want to discharge this patient?')) return;
    
    try {
      await ipdApi.discharge(id!, dischargeForm);
      toast.success('Patient discharged successfully');
      navigate('/ipd');
    } catch (error) {
      console.error('Failed to discharge patient:', error);
      toast.error('Failed to discharge patient');
    }
  };

  const allTabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: ClipboardDocumentListIcon },
    { id: 'orders' as Tab, label: 'Orders', icon: DocumentTextIcon },
    { id: 'vitals' as Tab, label: 'Vitals', icon: HeartIcon },
    { id: 'notes' as Tab, label: 'Notes', icon: DocumentTextIcon },
    { id: 'medications' as Tab, label: 'Medications', icon: BeakerIcon },
    { id: 'discharge' as Tab, label: 'Discharge', icon: ArrowRightOnRectangleIcon, permission: 'ipd:discharge' },
  ];
  const tabs = allTabs.filter(tab => !(tab as any).permission || hasPermission((tab as any).permission));

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'STAT': return 'bg-red-100 text-red-700 border-red-200';
      case 'URGENT': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'ROUTINE': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700 border-green-200';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'ORDERED': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'DOCTOR': return 'bg-blue-100 text-blue-700';
      case 'NURSE': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getNEWS2Color = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-700';
    if (score >= 7) return 'bg-red-100 text-red-700';
    if (score >= 5) return 'bg-orange-100 text-orange-700';
    if (score >= 3) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admission details...</p>
        </div>
      </div>
    );
  }

  if (!admission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-gray-900 font-medium">Admission not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Sticky Patient Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/ipd')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {admission.patient.firstName} {admission.patient.lastName}
                </h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span>MRN: {admission.patient.mrn}</span>
                  <span>•</span>
                  <span>{admission.bed.ward.name} - Bed {admission.bed.bedNumber}</span>
                  <span>•</span>
                  <span>Admitted: {new Date(admission.admissionDate).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Dr. {admission.admittingDoctor?.user?.firstName || 'Unknown'} {admission.admittingDoctor?.user?.lastName || ''}</span>
                </div>
              </div>
            </div>
            {admission.news2Score !== undefined && (
              <div className={clsx('px-4 py-2 rounded-lg font-bold', getNEWS2Color(admission.news2Score))}>
                NEWS2: {admission.news2Score}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[89px] z-10 bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Patient Demographics */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                <h2 className="text-lg font-semibold text-white">Patient Demographics</h2>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Date of Birth</p>
                  <p className="font-medium">{new Date(admission.patient.dateOfBirth).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium">{admission.patient.gender}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Blood Group</p>
                  <p className="font-medium">{admission.patient.bloodGroup || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{admission.patient.phone || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{admission.patient.address || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Admission Details */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                <h2 className="text-lg font-semibold text-white">Admission Details</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Chief Complaint</p>
                  <p className="text-gray-900">{admission.chiefComplaint || 'Not specified'}</p>
                </div>
                {admission.diagnosis && admission.diagnosis.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Diagnosis</p>
                    <div className="flex flex-wrap gap-2">
                      {admission.diagnosis.map((diag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {diag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {admission.icdCodes && admission.icdCodes.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">ICD Codes</p>
                    <div className="flex flex-wrap gap-2">
                      {admission.icdCodes.map((code, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-mono">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Treatment Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                <h2 className="text-lg font-semibold text-white">Treatment Plan</h2>
              </div>
              <div className="p-6">
                <textarea
                  className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter treatment plan..."
                  defaultValue={admission.treatmentPlan || ''}
                  onBlur={(e) => handleUpdateTreatmentPlan(e.target.value)}
                />
              </div>
            </div>

            {/* Latest Vitals */}
            {admission.latestVitals && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                  <h2 className="text-lg font-semibold text-white">Latest Vitals</h2>
                </div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {admission.latestVitals.bloodPressureSys && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Blood Pressure</p>
                      <p className="text-xl font-bold text-gray-900">
                        {admission.latestVitals.bloodPressureSys}/{admission.latestVitals.bloodPressureDia}
                      </p>
                    </div>
                  )}
                  {admission.latestVitals.heartRate && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Heart Rate</p>
                      <p className="text-xl font-bold text-gray-900">{admission.latestVitals.heartRate} bpm</p>
                    </div>
                  )}
                  {admission.latestVitals.oxygenSaturation && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">SpO2</p>
                      <p className="text-xl font-bold text-gray-900">{admission.latestVitals.oxygenSaturation}%</p>
                    </div>
                  )}
                  {admission.latestVitals.temperature && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Temperature</p>
                      <p className="text-xl font-bold text-gray-900">{admission.latestVitals.temperature}°C</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Active Orders</p>
                    <p className="text-3xl font-bold text-indigo-600">{orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length}</p>
                  </div>
                  <DocumentTextIcon className="h-12 w-12 text-indigo-200" />
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Progress Notes</p>
                    <p className="text-3xl font-bold text-purple-600">{notes.length}</p>
                  </div>
                  <DocumentTextIcon className="h-12 w-12 text-purple-200" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              {canWriteOrders && (
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
                >
                  <PlusIcon className="h-5 w-5" />
                  New Order
                </button>
              )}
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium">
                            {order.orderType}
                          </span>
                          <span className={clsx('px-3 py-1 rounded-lg text-sm font-medium border', getPriorityBadgeClass(order.priority))}>
                            {order.priority}
                          </span>
                          <span className={clsx('px-3 py-1 rounded-lg text-sm font-medium border', getStatusBadgeClass(order.status))}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-gray-900 font-medium mb-2">{order.description}</p>
                        {order.notes && (
                          <p className="text-sm text-gray-600 mb-2">{order.notes}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>
                            Ordered by: Dr. {order.orderedByUser?.firstName || 'Unknown'} {order.orderedByUser?.lastName || ''}
                          </span>
                          <span>•</span>
                          <span>{new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canWriteOrders && order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                          <>
                            <select
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            >
                              <option value="ORDERED">Ordered</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancel order"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VITALS TAB */}
        {activeTab === 'vitals' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              {canRecordVitals && (
                <button
                  onClick={() => setShowVitalsModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
                >
                  <PlusIcon className="h-5 w-5" />
                  Record Vitals
                </button>
              )}
            </div>

            {/* Vitals History Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                <h2 className="text-lg font-semibold text-white">Vitals History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BP</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HR</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RR</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SpO2</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pain</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NEWS2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {admission.nursingNotes && admission.nursingNotes.length > 0 ? (
                      admission.nursingNotes.map((note: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(note.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {note.bloodPressureSys && note.bloodPressureDia
                              ? `${note.bloodPressureSys}/${note.bloodPressureDia}`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {note.heartRate || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {note.respiratoryRate || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {note.oxygenSaturation ? `${note.oxygenSaturation}%` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {note.temperature ? `${note.temperature}°C` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {note.painLevel || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {note.news2Score !== undefined && (
                              <span className={clsx('px-2 py-1 rounded-lg text-sm font-medium', getNEWS2Color(note.news2Score))}>
                                {note.news2Score}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          No vitals recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vitals Trend Chart */}
            {admission.nursingNotes && admission.nursingNotes.length > 0 && (
              <VitalsTrendChart
                data={{
                  labels: admission.nursingNotes.map((n: any) => n.createdAt),
                  respiratoryRate: admission.nursingNotes.map((n: any) => n.respiratoryRate),
                  oxygenSaturation: admission.nursingNotes.map((n: any) => n.oxygenSaturation),
                  systolicBP: admission.nursingNotes.map((n: any) => n.bloodPressureSys),
                  diastolicBP: admission.nursingNotes.map((n: any) => n.bloodPressureDia),
                  heartRate: admission.nursingNotes.map((n: any) => n.heartRate),
                  temperature: admission.nursingNotes.map((n: any) => n.temperature),
                  news2Scores: admission.nursingNotes.map((n: any) => n.news2Score || 0),
                }}
                patientName={`${admission.patient.firstName} ${admission.patient.lastName}`}
              />
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              {canWriteNotes && (
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Note
                </button>
              )}
            </div>

            {notes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No progress notes yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div key={note.id} className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold">
                          {(note.author?.user?.firstName || 'U')[0]}{(note.author?.user?.lastName || '')[0]}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-gray-900">
                            {note.author?.user?.firstName || 'Unknown'} {note.author?.user?.lastName || ''}
                          </span>
                          <span className={clsx('px-2 py-1 rounded text-xs font-medium', getRoleBadgeClass(note.authorRole || 'DOCTOR'))}>
                            {note.authorRole || 'DOCTOR'}
                          </span>
                          <span className="text-sm text-gray-500">{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                        
                        {note.noteType === 'SOAP' ? (
                          <div className="space-y-3 mt-4">
                            {note.subjective && (
                              <div>
                                <p className="text-sm font-semibold text-blue-700 mb-1">Subjective:</p>
                                <p className="text-gray-700">{note.subjective}</p>
                              </div>
                            )}
                            {note.objective && (
                              <div>
                                <p className="text-sm font-semibold text-green-700 mb-1">Objective:</p>
                                <p className="text-gray-700">{note.objective}</p>
                              </div>
                            )}
                            {note.assessment && (
                              <div>
                                <p className="text-sm font-semibold text-amber-700 mb-1">Assessment:</p>
                                <p className="text-gray-700">{note.assessment}</p>
                              </div>
                            )}
                            {note.plan && (
                              <div>
                                <p className="text-sm font-semibold text-purple-700 mb-1">Plan:</p>
                                <p className="text-gray-700">{note.plan}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-700 mt-2">{note.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MEDICATIONS TAB */}
        {activeTab === 'medications' && (
          <div className="space-y-6">
            {/* Add Prescription Button */}
            {canWriteOrders && (
              <div className="flex justify-end">
                <button
                  onClick={() => setShowPrescriptionModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Prescription
                </button>
              </div>
            )}

            {!admission.prescriptions || admission.prescriptions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <BeakerIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No prescriptions yet</p>
                {canWriteOrders && (
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Create First Prescription
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {admission.prescriptions.map((prescription: any) => (
                  <div key={prescription.id} className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{prescription.medication}</h3>
                        <p className="text-sm text-gray-600">{prescription.dosage}</p>
                      </div>
                      <span className={clsx(
                        'px-3 py-1 rounded-lg text-sm font-medium',
                        prescription.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      )}>
                        {prescription.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Frequency:</span>
                        <span className="font-medium">{prescription.frequency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Route:</span>
                        <span className="font-medium">{prescription.route}</span>
                      </div>
                      {prescription.duration && (
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span className="font-medium">{prescription.duration}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DISCHARGE TAB */}
        {activeTab === 'discharge' && (
          <div className="space-y-6">
            {admission.dischargeSummary ? (
              // Show read-only discharge summary
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                  <h2 className="text-lg font-semibold text-white">Discharge Summary</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Discharge Date</p>
                      <p className="font-medium">{new Date(admission.dischargeSummary.dischargeDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Discharge Type</p>
                      <p className="font-medium">{admission.dischargeSummary.dischargeType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Condition at Discharge</p>
                      <p className="font-medium">{admission.dischargeSummary.conditionAtDischarge}</p>
                    </div>
                  </div>
                  
                  {admission.dischargeSummary.finalDiagnosis && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Final Diagnosis</p>
                      <p className="text-gray-900">{admission.dischargeSummary.finalDiagnosis}</p>
                    </div>
                  )}
                  
                  {admission.dischargeSummary.followUpInstructions && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Follow-up Instructions</p>
                      <p className="text-gray-900">{admission.dischargeSummary.followUpInstructions}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Show discharge form
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                  <h2 className="text-lg font-semibold text-white">Discharge Patient</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Date</label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        value={dischargeForm.dischargeDate}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, dischargeDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Type</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        value={dischargeForm.dischargeType}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, dischargeType: e.target.value })}
                      >
                        <option value="REGULAR">Regular</option>
                        <option value="AGAINST_MEDICAL_ADVICE">Against Medical Advice</option>
                        <option value="TRANSFER">Transfer</option>
                        <option value="DEATH">Death</option>
                        <option value="ABSCOND">Abscond</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Condition at Discharge</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={dischargeForm.conditionAtDischarge}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, conditionAtDischarge: e.target.value })}
                    >
                      <option value="IMPROVED">Improved</option>
                      <option value="UNCHANGED">Unchanged</option>
                      <option value="DETERIORATED">Deteriorated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Final Diagnosis</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Add diagnosis..."
                        value={tempInput}
                        onChange={(e) => setTempInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && tempInput.trim()) {
                            setDischargeForm({
                              ...dischargeForm,
                              finalDiagnosis: [...dischargeForm.finalDiagnosis, tempInput.trim()]
                            });
                            setTempInput('');
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (tempInput.trim()) {
                            setDischargeForm({
                              ...dischargeForm,
                              finalDiagnosis: [...dischargeForm.finalDiagnosis, tempInput.trim()]
                            });
                            setTempInput('');
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dischargeForm.finalDiagnosis.map((diag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2">
                          {diag}
                          <button
                            onClick={() => setDischargeForm({
                              ...dischargeForm,
                              finalDiagnosis: dischargeForm.finalDiagnosis.filter((_, i) => i !== idx)
                            })}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Procedures Performed</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Add procedure..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                            setDischargeForm({
                              ...dischargeForm,
                              proceduresPerformed: [...dischargeForm.proceduresPerformed, (e.target as HTMLInputElement).value.trim()]
                            });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dischargeForm.proceduresPerformed.map((proc, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-2">
                          {proc}
                          <button
                            onClick={() => setDischargeForm({
                              ...dischargeForm,
                              proceduresPerformed: dischargeForm.proceduresPerformed.filter((_, i) => i !== idx)
                            })}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Medications on Discharge</label>
                    <div className="space-y-2">
                      {dischargeForm.medicationsOnDischarge.map((med, idx) => (
                        <div key={idx} className="grid grid-cols-5 gap-2">
                          <input
                            type="text"
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Medication"
                            value={med.name}
                            onChange={(e) => {
                              const updated = [...dischargeForm.medicationsOnDischarge];
                              updated[idx].name = e.target.value;
                              setDischargeForm({ ...dischargeForm, medicationsOnDischarge: updated });
                            }}
                          />
                          <input
                            type="text"
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Dose"
                            value={med.dose}
                            onChange={(e) => {
                              const updated = [...dischargeForm.medicationsOnDischarge];
                              updated[idx].dose = e.target.value;
                              setDischargeForm({ ...dischargeForm, medicationsOnDischarge: updated });
                            }}
                          />
                          <input
                            type="text"
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Frequency"
                            value={med.frequency}
                            onChange={(e) => {
                              const updated = [...dischargeForm.medicationsOnDischarge];
                              updated[idx].frequency = e.target.value;
                              setDischargeForm({ ...dischargeForm, medicationsOnDischarge: updated });
                            }}
                          />
                          <input
                            type="text"
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Duration"
                            value={med.duration}
                            onChange={(e) => {
                              const updated = [...dischargeForm.medicationsOnDischarge];
                              updated[idx].duration = e.target.value;
                              setDischargeForm({ ...dischargeForm, medicationsOnDischarge: updated });
                            }}
                          />
                          <button
                            onClick={() => setDischargeForm({
                              ...dischargeForm,
                              medicationsOnDischarge: dischargeForm.medicationsOnDischarge.filter((_, i) => i !== idx)
                            })}
                            className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setDischargeForm({
                          ...dischargeForm,
                          medicationsOnDischarge: [...dischargeForm.medicationsOnDischarge, { name: '', dose: '', frequency: '', duration: '' }]
                        })}
                        className="flex items-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Medication
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Instructions</label>
                    <textarea
                      className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={dischargeForm.followUpInstructions}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, followUpInstructions: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={dischargeForm.followUpDate}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, followUpDate: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Instructions</label>
                    <textarea
                      className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={dischargeForm.dietaryInstructions}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, dietaryInstructions: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Activity Restrictions</label>
                    <textarea
                      className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={dischargeForm.activityRestrictions}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, activityRestrictions: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Warning Signs to Watch</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Add warning sign..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                            setDischargeForm({
                              ...dischargeForm,
                              warningSigns: [...dischargeForm.warningSigns, (e.target as HTMLInputElement).value.trim()]
                            });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dischargeForm.warningSigns.map((sign, idx) => (
                        <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm flex items-center gap-2">
                          {sign}
                          <button
                            onClick={() => setDischargeForm({
                              ...dischargeForm,
                              warningSigns: dischargeForm.warningSigns.filter((_, i) => i !== idx)
                            })}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleDischarge}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    Discharge Patient
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">New Order</h2>
              <button onClick={() => setShowOrderModal(false)} className="text-white hover:bg-white/20 rounded-lg p-1">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={orderForm.orderType}
                  onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value })}
                >
                  <option value="Medication">Medication</option>
                  <option value="Lab">Lab</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Nursing">Nursing</option>
                  <option value="Diet">Diet</option>
                  <option value="Consult">Consult</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex gap-4">
                  {(['ROUTINE', 'URGENT', 'STAT'] as const).map((priority) => (
                    <label key={priority} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value={priority}
                        checked={orderForm.priority === priority}
                        onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value as any })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{priority}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={orderForm.description}
                  onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                  placeholder="Enter order details..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOrder}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg"
                  disabled={!orderForm.description.trim()}
                >
                  Create Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add Progress Note</h2>
              <button onClick={() => setShowNoteModal(false)} className="text-white hover:bg-white/20 rounded-lg p-1">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="noteType"
                      value="SOAP"
                      checked={noteForm.noteType === 'SOAP'}
                      onChange={(e) => setNoteForm({ ...noteForm, noteType: 'SOAP' })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>SOAP Note</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="noteType"
                      value="GENERAL"
                      checked={noteForm.noteType === 'GENERAL'}
                      onChange={(e) => setNoteForm({ ...noteForm, noteType: 'GENERAL' })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>General Note</span>
                  </label>
                </div>
              </div>

              {noteForm.noteType === 'SOAP' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Subjective</label>
                    <textarea
                      className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={noteForm.subjective}
                      onChange={(e) => setNoteForm({ ...noteForm, subjective: e.target.value })}
                      placeholder="Patient's symptoms and complaints..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2">Objective</label>
                    <textarea
                      className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={noteForm.objective}
                      onChange={(e) => setNoteForm({ ...noteForm, objective: e.target.value })}
                      placeholder="Clinical findings, vitals, test results..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-700 mb-2">Assessment</label>
                    <textarea
                      className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={noteForm.assessment}
                      onChange={(e) => setNoteForm({ ...noteForm, assessment: e.target.value })}
                      placeholder="Clinical diagnosis and impression..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-2">Plan</label>
                    <textarea
                      className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      value={noteForm.plan}
                      onChange={(e) => setNoteForm({ ...noteForm, plan: e.target.value })}
                      placeholder="Treatment plan and follow-up..."
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note Content</label>
                  <textarea
                    className="w-full min-h-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={noteForm.content}
                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                    placeholder="Enter your note..."
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNote}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg"
                  disabled={noteForm.noteType === 'SOAP' 
                    ? !noteForm.subjective && !noteForm.objective && !noteForm.assessment && !noteForm.plan
                    : !noteForm.content.trim()}
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vitals Modal */}
      {showVitalsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between sticky top-0">
              <h3 className="text-lg font-semibold text-white">Record Vitals</h3>
              <button onClick={() => setShowVitalsModal(false)} className="text-white hover:bg-white/20 rounded-lg p-1">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Blood Pressure */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={vitalsForm.bloodPressureSys}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressureSys: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={vitalsForm.bloodPressureDia}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressureDia: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Heart Rate & Respiratory Rate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={vitalsForm.heartRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate (/min)</label>
                  <input
                    type="number"
                    value={vitalsForm.respiratoryRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* SpO2 & Temperature */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={vitalsForm.oxygenSaturation}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, oxygenSaturation: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalsForm.temperature}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Supplemental Oxygen */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vitalsForm.supplementalOxygen}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, supplementalOxygen: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">On Supplemental Oxygen</span>
                </label>
              </div>

              {/* Consciousness */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consciousness (AVPU)</label>
                <select
                  value={vitalsForm.consciousness}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, consciousness: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="alert">Alert</option>
                  <option value="voice">Responds to Voice</option>
                  <option value="pain">Responds to Pain</option>
                  <option value="unresponsive">Unresponsive</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowVitalsModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordVitals}
                  disabled={savingVitals}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingVitals ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Vitals'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Modal */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between sticky top-0">
              <h3 className="text-lg font-semibold text-white">Create Prescription</h3>
              <button onClick={() => setShowPrescriptionModal(false)} className="text-white hover:bg-white/20 rounded-lg p-1">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Medications List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Medications</label>
                  <button
                    onClick={handleAddMedication}
                    className="text-sm flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Medication
                  </button>
                </div>

                {prescriptionForm.medications.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 mb-3">No medications added yet</p>
                    <button
                      onClick={handleAddMedication}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Add First Medication
                    </button>
                  </div>
                ) : (
                  prescriptionForm.medications.map((med, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3 relative">
                      <button
                        onClick={() => handleRemoveMedication(index)}
                        className="absolute top-2 right-2 text-red-600 hover:bg-red-50 rounded-lg p-1"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Drug Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={med.drugName}
                            onChange={(e) => {
                              const updated = [...prescriptionForm.medications];
                              updated[index].drugName = e.target.value;
                              updated[index].drugId = e.target.value; // Temporary - use drugName as ID
                              setPrescriptionForm({ ...prescriptionForm, medications: updated });
                            }}
                            placeholder="Enter medication name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Dosage <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) => {
                              const updated = [...prescriptionForm.medications];
                              updated[index].dosage = e.target.value;
                              setPrescriptionForm({ ...prescriptionForm, medications: updated });
                            }}
                            placeholder="e.g., 500mg"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Frequency <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={med.frequency}
                            onChange={(e) => {
                              const updated = [...prescriptionForm.medications];
                              updated[index].frequency = e.target.value;
                              setPrescriptionForm({ ...prescriptionForm, medications: updated });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select frequency</option>
                            <option value="Once daily">Once daily</option>
                            <option value="Twice daily">Twice daily</option>
                            <option value="Three times daily">Three times daily</option>
                            <option value="Four times daily">Four times daily</option>
                            <option value="Every 4 hours">Every 4 hours</option>
                            <option value="Every 6 hours">Every 6 hours</option>
                            <option value="Every 8 hours">Every 8 hours</option>
                            <option value="Every 12 hours">Every 12 hours</option>
                            <option value="As needed">As needed (PRN)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Route <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={med.route}
                            onChange={(e) => {
                              const updated = [...prescriptionForm.medications];
                              updated[index].route = e.target.value;
                              setPrescriptionForm({ ...prescriptionForm, medications: updated });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Oral">Oral</option>
                            <option value="IV">Intravenous (IV)</option>
                            <option value="IM">Intramuscular (IM)</option>
                            <option value="SC">Subcutaneous (SC)</option>
                            <option value="Topical">Topical</option>
                            <option value="Inhalation">Inhalation</option>
                            <option value="Rectal">Rectal</option>
                            <option value="Sublingual">Sublingual</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                          <input
                            type="text"
                            value={med.duration}
                            onChange={(e) => {
                              const updated = [...prescriptionForm.medications];
                              updated[index].duration = e.target.value;
                              setPrescriptionForm({ ...prescriptionForm, medications: updated });
                            }}
                            placeholder="e.g., 7 days"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                          <input
                            type="text"
                            value={med.instructions}
                            onChange={(e) => {
                              const updated = [...prescriptionForm.medications];
                              updated[index].instructions = e.target.value;
                              setPrescriptionForm({ ...prescriptionForm, medications: updated });
                            }}
                            placeholder="e.g., Take with food"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Prescription Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prescription Notes</label>
                <textarea
                  value={prescriptionForm.notes}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes for pharmacist..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowPrescriptionModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePrescription}
                  disabled={savingPrescription || prescriptionForm.medications.length === 0}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingPrescription ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Prescription'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
