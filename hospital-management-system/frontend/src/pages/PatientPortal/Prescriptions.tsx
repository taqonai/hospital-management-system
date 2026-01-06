import { useState, Fragment, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Dialog, Transition } from '@headlessui/react';
import {
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  UserIcon,
  BeakerIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  PhoneIcon,
  MapPinIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import toast from 'react-hot-toast';

interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  route: string;
  instructions?: string;
  sideEffects?: string[];
  warnings?: string[];
  duration?: string;
  quantity?: number;
}

interface Prescription {
  id: string;
  prescriptionNumber: string;
  medications: Medication[];
  doctor: {
    id: string;
    name: string;
    specialization: string;
    phone?: string;
  };
  department?: {
    id: string;
    name: string;
  };
  status: 'ACTIVE' | 'COMPLETED' | 'PENDING_REFILL' | 'CANCELLED' | 'EXPIRED';
  startDate: string;
  endDate?: string;
  refillsRemaining: number;
  refillsTotal: number;
  lastFilledDate?: string;
  nextRefillDate?: string;
  pharmacy?: {
    name: string;
    address?: string;
    phone?: string;
  };
  diagnosis?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string; icon: typeof CheckCircleIcon }> = {
  ACTIVE: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-500', label: 'Active', icon: CheckCircleIcon },
  COMPLETED: { bg: 'bg-gray-100/80', text: 'text-gray-700', dot: 'bg-gray-400', label: 'Completed', icon: CheckCircleIcon },
  PENDING_REFILL: { bg: 'bg-amber-100/80', text: 'text-amber-700', dot: 'bg-amber-500 animate-pulse', label: 'Pending Refill', icon: ClockIcon },
  CANCELLED: { bg: 'bg-red-100/80', text: 'text-red-700', dot: 'bg-red-500', label: 'Cancelled', icon: XMarkIcon },
  EXPIRED: { bg: 'bg-gray-100/80', text: 'text-gray-500', dot: 'bg-gray-400', label: 'Expired', icon: ClockIcon },
};

// Mock data for demonstration
const mockPrescriptions: Prescription[] = [
  {
    id: '1',
    prescriptionNumber: 'RX-2024-001234',
    medications: [
      {
        id: 'm1',
        name: 'Lisinopril',
        genericName: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        route: 'Oral',
        duration: '90 days',
        quantity: 90,
        instructions: 'Take in the morning with or without food. Avoid potassium supplements.',
        sideEffects: ['Dry cough', 'Dizziness', 'Headache', 'Fatigue'],
        warnings: ['Do not use if pregnant', 'Avoid alcohol', 'May cause dizziness - use caution when driving'],
      },
    ],
    doctor: { id: 'd1', name: 'Dr. Sarah Johnson', specialization: 'Cardiology', phone: '(555) 123-4567' },
    department: { id: 'dept1', name: 'Cardiology' },
    status: 'ACTIVE',
    startDate: '2024-01-15',
    refillsRemaining: 3,
    refillsTotal: 5,
    lastFilledDate: '2024-12-01',
    nextRefillDate: '2024-12-28',
    pharmacy: { name: 'Main Street Pharmacy', address: '123 Main Street, Suite 100', phone: '(555) 987-6543' },
    diagnosis: 'Essential hypertension (I10)',
    notes: 'Continue monitoring blood pressure at home. Target BP < 130/80',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    prescriptionNumber: 'RX-2024-001235',
    medications: [
      {
        id: 'm2',
        name: 'Metformin',
        genericName: 'Metformin Hydrochloride',
        dosage: '500mg',
        frequency: 'Twice daily',
        route: 'Oral',
        duration: '90 days',
        quantity: 180,
        instructions: 'Take with meals to reduce stomach upset.',
        sideEffects: ['Nausea', 'Diarrhea', 'Stomach pain', 'Loss of appetite'],
        warnings: ['Stop if having surgery or contrast dye', 'Monitor blood sugar regularly'],
      },
      {
        id: 'm2b',
        name: 'Glipizide',
        genericName: 'Glipizide',
        dosage: '5mg',
        frequency: 'Once daily',
        route: 'Oral',
        duration: '90 days',
        quantity: 90,
        instructions: 'Take 30 minutes before breakfast.',
        sideEffects: ['Hypoglycemia', 'Weight gain', 'Nausea'],
        warnings: ['Can cause low blood sugar', 'Carry glucose tablets'],
      },
    ],
    doctor: { id: 'd2', name: 'Dr. Michael Chen', specialization: 'Endocrinology' },
    department: { id: 'dept2', name: 'Endocrinology' },
    status: 'PENDING_REFILL',
    startDate: '2024-02-01',
    refillsRemaining: 1,
    refillsTotal: 6,
    lastFilledDate: '2024-11-15',
    pharmacy: { name: 'City Pharmacy', address: '456 City Ave' },
    diagnosis: 'Type 2 diabetes mellitus (E11)',
    notes: 'A1C improved to 6.8%. Continue current regimen.',
    createdAt: '2024-02-01T14:30:00Z',
  },
  {
    id: '3',
    prescriptionNumber: 'RX-2024-001236',
    medications: [
      {
        id: 'm3',
        name: 'Amoxicillin',
        genericName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times daily',
        route: 'Oral',
        duration: '10 days',
        quantity: 30,
        instructions: 'Take every 8 hours. Complete the full course even if feeling better.',
        sideEffects: ['Diarrhea', 'Rash', 'Nausea', 'Vomiting'],
        warnings: ['Allergic reactions possible', 'Complete full course of treatment'],
      },
    ],
    doctor: { id: 'd3', name: 'Dr. Emily Watson', specialization: 'Family Medicine' },
    department: { id: 'dept3', name: 'General Medicine' },
    status: 'COMPLETED',
    startDate: '2024-11-01',
    endDate: '2024-11-10',
    refillsRemaining: 0,
    refillsTotal: 0,
    lastFilledDate: '2024-11-01',
    pharmacy: { name: 'Health Plus Pharmacy' },
    diagnosis: 'Acute sinusitis (J01.9)',
    createdAt: '2024-11-01T09:00:00Z',
  },
  {
    id: '4',
    prescriptionNumber: 'RX-2024-001237',
    medications: [
      {
        id: 'm4',
        name: 'Omeprazole',
        genericName: 'Omeprazole',
        dosage: '20mg',
        frequency: 'Once daily',
        route: 'Oral',
        duration: 'Ongoing',
        instructions: 'Take 30 minutes before breakfast on an empty stomach.',
        sideEffects: ['Headache', 'Stomach pain', 'Nausea', 'Diarrhea'],
        warnings: ['Long-term use may affect bone density', 'May interact with certain medications'],
      },
    ],
    doctor: { id: 'd4', name: 'Dr. Robert Garcia', specialization: 'Gastroenterology' },
    department: { id: 'dept4', name: 'Gastroenterology' },
    status: 'ACTIVE',
    startDate: '2024-03-01',
    refillsRemaining: 5,
    refillsTotal: 12,
    lastFilledDate: '2024-12-10',
    nextRefillDate: '2025-01-08',
    pharmacy: { name: 'Main Street Pharmacy', address: '123 Main Street, Suite 100', phone: '(555) 987-6543' },
    diagnosis: 'Gastroesophageal reflux disease (K21.0)',
    createdAt: '2024-03-01T11:00:00Z',
  },
];

export default function Prescriptions() {
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [refillNotes, setRefillNotes] = useState('');
  const [selectedPharmacy, setSelectedPharmacy] = useState('');
  const itemsPerPage = 10;
  const queryClient = useQueryClient();

  // Fetch prescriptions
  const { data: prescriptionsData, isLoading, error } = useQuery({
    queryKey: ['patient-prescriptions-page', activeTab, statusFilter],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getPrescriptions({
          status: activeTab,
        });
        return response.data?.data || response.data || [];
      } catch {
        return mockPrescriptions;
      }
    },
  });

  const prescriptions: Prescription[] = Array.isArray(prescriptionsData) ? prescriptionsData : [];

  // Refill mutation
  const refillMutation = useMutation({
    mutationFn: (prescriptionId: string) =>
      patientPortalApi.requestRefill(prescriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions-page'] });
      toast.success('Refill request submitted successfully');
      setShowRefillModal(false);
      setSelectedPrescription(null);
      setRefillNotes('');
      setSelectedPharmacy('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit refill request');
    },
  });

  // Filter prescriptions
  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter((rx) => {
      // Tab filter
      const isActive = ['ACTIVE', 'PENDING_REFILL'].includes(rx.status);
      if (activeTab === 'active' && !isActive) return false;
      if (activeTab === 'past' && isActive) return false;

      // Status filter
      if (statusFilter && rx.status !== statusFilter) return false;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const medicationNames = rx.medications.map(m => m.name.toLowerCase()).join(' ');
        const doctorName = rx.doctor.name.toLowerCase();
        const rxNumber = rx.prescriptionNumber.toLowerCase();
        const diagnosis = rx.diagnosis?.toLowerCase() || '';

        if (!medicationNames.includes(searchLower) &&
            !doctorName.includes(searchLower) &&
            !rxNumber.includes(searchLower) &&
            !diagnosis.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [prescriptions, activeTab, statusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredPrescriptions.length / itemsPerPage);
  const paginatedPrescriptions = filteredPrescriptions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenDetailModal = (rx: Prescription) => {
    setSelectedPrescription(rx);
    setShowDetailModal(true);
  };

  const handleOpenRefillModal = (rx: Prescription) => {
    setSelectedPrescription(rx);
    setSelectedPharmacy(rx.pharmacy?.name || '');
    setShowRefillModal(true);
  };

  const handleSubmitRefill = () => {
    if (selectedPrescription) {
      refillMutation.mutate(selectedPrescription.id);
    }
  };

  const canRequestRefill = (rx: Prescription) => {
    return rx.refillsRemaining > 0 && ['ACTIVE', 'PENDING_REFILL'].includes(rx.status);
  };

  const getDaysUntilRefill = (rx: Prescription) => {
    if (!rx.nextRefillDate) return null;
    const days = differenceInDays(parseISO(rx.nextRefillDate), new Date());
    return days;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const renderPrescriptionCard = (rx: Prescription) => {
    const status = statusConfig[rx.status] || statusConfig.ACTIVE;
    const StatusIcon = status.icon;
    const daysUntilRefill = getDaysUntilRefill(rx);
    const primaryMed = rx.medications[0];

    return (
      <div
        key={rx.id}
        className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Medication Icon */}
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md">
              <BeakerIcon className="h-8 w-8" />
            </div>

            {/* Prescription Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h3 className="font-semibold text-gray-900 text-lg">
                  {primaryMed?.name}
                  {rx.medications.length > 1 && (
                    <span className="text-sm text-gray-500 font-normal ml-2">
                      +{rx.medications.length - 1} more
                    </span>
                  )}
                </h3>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                <p className="font-medium text-gray-700">
                  {primaryMed?.dosage} - {primaryMed?.frequency}
                </p>
                <div className="flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-4 w-4 text-gray-400" />
                  <span>Rx: {rx.prescriptionNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <span>{rx.doctor.name} - {rx.doctor.specialization}</span>
                </div>
                {rx.pharmacy && (
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 text-gray-400" />
                    <span>{rx.pharmacy.name}</span>
                  </div>
                )}
              </div>

              {/* Refill Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
                  <ArrowPathIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">
                    {rx.refillsRemaining} of {rx.refillsTotal} refills
                  </span>
                </div>

                {rx.lastFilledDate && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">
                      Last filled: {formatDate(rx.lastFilledDate)}
                    </span>
                  </div>
                )}

                {daysUntilRefill !== null && daysUntilRefill >= 0 && daysUntilRefill <= 7 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg">
                    <ExclamationCircleIcon className="h-4 w-4" />
                    <span className="font-medium">
                      {daysUntilRefill === 0 ? 'Refill today!' : `Refill in ${daysUntilRefill} day${daysUntilRefill === 1 ? '' : 's'}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 lg:flex-shrink-0 flex-wrap">
            <button
              onClick={() => handleOpenDetailModal(rx)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 transition-colors"
            >
              View Details
            </button>
            {canRequestRefill(rx) && (
              <button
                onClick={() => handleOpenRefillModal(rx)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 transition-all shadow-md"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Request Refill
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl text-white shadow-lg">
                <ClipboardDocumentListIcon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Prescriptions</h1>
                <p className="text-gray-500 mt-1">View and manage your medications</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search, Tabs, and Filters */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search by medication, doctor, or Rx number..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Tabs */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => { setActiveTab('active'); setStatusFilter(''); setCurrentPage(1); }}
                  className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'active'
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Active Prescriptions
                </button>
                <button
                  onClick={() => { setActiveTab('past'); setStatusFilter(''); setCurrentPage(1); }}
                  className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'past'
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Past Prescriptions
                </button>
              </div>

              <div className="flex-1" />

              {/* Status Filter */}
              <div className="flex items-center gap-3">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm min-w-[150px]"
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING_REFILL">Pending Refill</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Prescriptions List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
                <p className="mt-4 text-gray-500">Loading prescriptions...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                <div>
                  <h3 className="font-semibold text-red-800">Error Loading Prescriptions</h3>
                  <p className="text-red-600">Unable to load your prescriptions. Please try again later.</p>
                </div>
              </div>
            </div>
          ) : paginatedPrescriptions.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
              <div className="text-center">
                <ClipboardDocumentListIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Prescriptions Found
                </h3>
                <p className="text-gray-500">
                  {activeTab === 'active'
                    ? 'You have no active prescriptions at this time.'
                    : 'You have no past prescriptions to display.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 px-1">
                Showing {paginatedPrescriptions.length} of {filteredPrescriptions.length} prescriptions
              </p>

              {paginatedPrescriptions.map((rx) => renderPrescriptionCard(rx))}

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
                              ? 'bg-teal-600 text-white'
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
                  <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all max-h-[90vh] flex flex-col">
                    {selectedPrescription && (
                      <>
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-white">Prescription Details</h3>
                              <p className="text-teal-100 text-sm mt-1">{selectedPrescription.prescriptionNumber}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => window.print()}
                                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                                title="Print"
                              >
                                <PrinterIcon className="h-5 w-5" />
                              </button>
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
                          {/* Status & Refills */}
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                              statusConfig[selectedPrescription.status]?.bg || 'bg-gray-100'
                            } ${statusConfig[selectedPrescription.status]?.text || 'text-gray-700'}`}>
                              <span className={`w-2 h-2 rounded-full ${statusConfig[selectedPrescription.status]?.dot || 'bg-gray-400'}`} />
                              {statusConfig[selectedPrescription.status]?.label || selectedPrescription.status}
                            </span>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <ArrowPathIcon className="h-5 w-5" />
                              <span className="font-medium">{selectedPrescription.refillsRemaining}</span>
                              <span>of</span>
                              <span className="font-medium">{selectedPrescription.refillsTotal}</span>
                              <span>refills remaining</span>
                            </div>
                          </div>

                          {/* Doctor Info */}
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Prescribing Physician</h4>
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                                {selectedPrescription.doctor.name.charAt(4) || 'D'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{selectedPrescription.doctor.name}</p>
                                <p className="text-gray-600">{selectedPrescription.doctor.specialization}</p>
                                {selectedPrescription.doctor.phone && (
                                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                    <PhoneIcon className="h-3.5 w-3.5" />
                                    {selectedPrescription.doctor.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Medications */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <BeakerIcon className="h-4 w-4" />
                              Medications
                            </h4>
                            <div className="space-y-4">
                              {selectedPrescription.medications.map((med) => (
                                <div key={med.id} className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h5 className="text-lg font-bold text-gray-900">{med.name}</h5>
                                      {med.genericName && med.genericName !== med.name && (
                                        <p className="text-sm text-gray-600">Generic: {med.genericName}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                    <div className="bg-white rounded-lg p-3">
                                      <p className="text-xs text-gray-500 uppercase">Dosage</p>
                                      <p className="font-semibold text-gray-900">{med.dosage}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3">
                                      <p className="text-xs text-gray-500 uppercase">Frequency</p>
                                      <p className="font-semibold text-gray-900">{med.frequency}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3">
                                      <p className="text-xs text-gray-500 uppercase">Route</p>
                                      <p className="font-semibold text-gray-900">{med.route}</p>
                                    </div>
                                    {med.duration && (
                                      <div className="bg-white rounded-lg p-3">
                                        <p className="text-xs text-gray-500 uppercase">Duration</p>
                                        <p className="font-semibold text-gray-900">{med.duration}</p>
                                      </div>
                                    )}
                                  </div>

                                  {med.instructions && (
                                    <div className="mb-3">
                                      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                                        <InformationCircleIcon className="h-4 w-4 text-blue-500" />
                                        Instructions
                                      </p>
                                      <p className="text-gray-600 bg-white rounded-lg p-3 text-sm">{med.instructions}</p>
                                    </div>
                                  )}

                                  {med.sideEffects && med.sideEffects.length > 0 && (
                                    <div className="mb-3">
                                      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                                        <ExclamationCircleIcon className="h-4 w-4 text-amber-500" />
                                        Possible Side Effects
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {med.sideEffects.map((effect, idx) => (
                                          <span key={idx} className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                                            {effect}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {med.warnings && med.warnings.length > 0 && (
                                    <div>
                                      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                                        <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                                        Warnings
                                      </p>
                                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                                        {med.warnings.map((warning, idx) => (
                                          <p key={idx} className="text-sm text-red-700 flex items-start gap-2">
                                            <span className="text-red-500 mt-0.5">*</span>
                                            {warning}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Diagnosis */}
                          {selectedPrescription.diagnosis && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Diagnosis</h4>
                              <p className="text-gray-700 bg-blue-50 border border-blue-200 rounded-xl p-3">
                                {selectedPrescription.diagnosis}
                              </p>
                            </div>
                          )}

                          {/* Dates */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Start Date</p>
                              <p className="font-medium text-gray-900">{formatDate(selectedPrescription.startDate)}</p>
                            </div>
                            {selectedPrescription.endDate && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase">End Date</p>
                                <p className="font-medium text-gray-900">{formatDate(selectedPrescription.endDate)}</p>
                              </div>
                            )}
                            {selectedPrescription.lastFilledDate && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Last Filled</p>
                                <p className="font-medium text-gray-900">{formatDate(selectedPrescription.lastFilledDate)}</p>
                              </div>
                            )}
                            {selectedPrescription.nextRefillDate && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Next Refill</p>
                                <p className="font-medium text-gray-900">{formatDate(selectedPrescription.nextRefillDate)}</p>
                              </div>
                            )}
                          </div>

                          {/* Pharmacy */}
                          {selectedPrescription.pharmacy && (
                            <div className="bg-gray-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Pharmacy</h4>
                              <p className="font-medium text-gray-900">{selectedPrescription.pharmacy.name}</p>
                              {selectedPrescription.pharmacy.address && (
                                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                  <MapPinIcon className="h-4 w-4" />
                                  {selectedPrescription.pharmacy.address}
                                </p>
                              )}
                              {selectedPrescription.pharmacy.phone && (
                                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                  <PhoneIcon className="h-4 w-4" />
                                  {selectedPrescription.pharmacy.phone}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Notes */}
                          {selectedPrescription.notes && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                              <p className="text-gray-600 italic">{selectedPrescription.notes}</p>
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
                          {canRequestRefill(selectedPrescription) && (
                            <button
                              onClick={() => { setShowDetailModal(false); handleOpenRefillModal(selectedPrescription); }}
                              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-medium hover:from-teal-700 hover:to-emerald-700 transition-all flex items-center gap-2"
                            >
                              <ArrowPathIcon className="h-4 w-4" />
                              Request Refill
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

        {/* Refill Request Modal */}
        <Transition appear show={showRefillModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowRefillModal(false)}>
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
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                    <Dialog.Title className="text-lg font-bold text-gray-900 mb-2">
                      Request Prescription Refill
                    </Dialog.Title>

                    {selectedPrescription && (
                      <>
                        {/* Prescription Summary */}
                        <div className="bg-teal-50 rounded-xl p-4 mb-6">
                          <p className="font-semibold text-gray-900">
                            {selectedPrescription.medications[0]?.name}
                            {selectedPrescription.medications.length > 1 && ` +${selectedPrescription.medications.length - 1} more`}
                          </p>
                          <p className="text-sm text-gray-600">Rx: {selectedPrescription.prescriptionNumber}</p>
                          <p className="text-sm text-gray-600">
                            {selectedPrescription.refillsRemaining} refills remaining
                          </p>
                        </div>

                        {/* Pharmacy Selection */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Pharmacy</label>
                          <input
                            type="text"
                            value={selectedPharmacy}
                            onChange={(e) => setSelectedPharmacy(e.target.value)}
                            placeholder="Enter pharmacy name"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>

                        {/* Notes */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                          <textarea
                            value={refillNotes}
                            onChange={(e) => setRefillNotes(e.target.value)}
                            placeholder="Any special instructions or notes..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => { setShowRefillModal(false); setRefillNotes(''); }}
                            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSubmitRefill}
                            disabled={refillMutation.isPending}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-medium hover:from-teal-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {refillMutation.isPending ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon className="h-4 w-4" />
                                Submit Refill Request
                              </>
                            )}
                          </button>
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
