import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';

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
}

interface Prescription {
  id: string;
  prescriptionNumber: string;
  medications: Medication[];
  doctor: {
    id: string;
    name: string;
    specialization: string;
  };
  status: 'ACTIVE' | 'COMPLETED' | 'PENDING_REFILL' | 'CANCELLED';
  startDate: string;
  endDate?: string;
  refillsRemaining: number;
  refillsTotal: number;
  lastFilledDate?: string;
  pharmacy?: string;
  notes?: string;
  createdAt: string;
}

// Mock data for development/demo purposes
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
        instructions: 'Take in the morning with or without food. Avoid potassium supplements.',
        sideEffects: ['Dry cough', 'Dizziness', 'Headache', 'Fatigue'],
        warnings: ['Do not use if pregnant', 'Avoid alcohol', 'May cause dizziness - use caution when driving'],
      },
    ],
    doctor: { id: 'd1', name: 'Dr. Sarah Johnson', specialization: 'Cardiology' },
    status: 'ACTIVE',
    startDate: '2024-01-15',
    refillsRemaining: 3,
    refillsTotal: 5,
    lastFilledDate: '2024-12-01',
    pharmacy: 'Main Street Pharmacy',
    notes: 'For hypertension management',
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
        instructions: 'Take with meals to reduce stomach upset.',
        sideEffects: ['Nausea', 'Diarrhea', 'Stomach pain', 'Loss of appetite'],
        warnings: ['Stop if having surgery or contrast dye', 'Monitor blood sugar regularly'],
      },
    ],
    doctor: { id: 'd2', name: 'Dr. Michael Chen', specialization: 'Endocrinology' },
    status: 'PENDING_REFILL',
    startDate: '2024-02-01',
    refillsRemaining: 1,
    refillsTotal: 6,
    lastFilledDate: '2024-11-15',
    pharmacy: 'City Pharmacy',
    notes: 'Type 2 diabetes management',
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
        instructions: 'Take every 8 hours. Complete the full course even if feeling better.',
        sideEffects: ['Diarrhea', 'Rash', 'Nausea', 'Vomiting'],
        warnings: ['Allergic reactions possible', 'Complete full course of treatment'],
      },
    ],
    doctor: { id: 'd3', name: 'Dr. Emily Watson', specialization: 'Family Medicine' },
    status: 'COMPLETED',
    startDate: '2024-11-01',
    endDate: '2024-11-10',
    refillsRemaining: 0,
    refillsTotal: 0,
    lastFilledDate: '2024-11-01',
    pharmacy: 'Health Plus Pharmacy',
    notes: 'For bacterial infection',
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
        instructions: 'Take 30 minutes before breakfast on an empty stomach.',
        sideEffects: ['Headache', 'Stomach pain', 'Nausea', 'Diarrhea'],
        warnings: ['Long-term use may affect bone density', 'May interact with certain medications'],
      },
    ],
    doctor: { id: 'd4', name: 'Dr. Robert Garcia', specialization: 'Gastroenterology' },
    status: 'ACTIVE',
    startDate: '2024-03-01',
    refillsRemaining: 5,
    refillsTotal: 12,
    lastFilledDate: '2024-12-10',
    pharmacy: 'Main Street Pharmacy',
    notes: 'For GERD management',
    createdAt: '2024-03-01T11:00:00Z',
  },
];

const getStatusBadge = (status: Prescription['status']) => {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Active
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Completed
        </span>
      );
    case 'PENDING_REFILL':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <ClockIcon className="h-3.5 w-3.5" />
          Pending Refill
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <XMarkIcon className="h-3.5 w-3.5" />
          Cancelled
        </span>
      );
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

export default function Prescriptions() {
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refillSuccess, setRefillSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: prescriptions = [], isLoading, error } = useQuery({
    queryKey: ['patient-prescriptions', activeTab],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getPrescriptions({
          status: activeTab
        });
        return response.data?.data || response.data || [];
      } catch {
        // Return mock data for demo/development
        const filteredMock = mockPrescriptions.filter((p) => {
          if (activeTab === 'active') {
            return p.status === 'ACTIVE' || p.status === 'PENDING_REFILL';
          }
          return p.status === 'COMPLETED' || p.status === 'CANCELLED';
        });
        return filteredMock;
      }
    },
  });

  const refillMutation = useMutation({
    mutationFn: (prescriptionId: string) => patientPortalApi.requestRefill(prescriptionId),
    onSuccess: (_data, prescriptionId) => {
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
      setRefillSuccess(prescriptionId);
      setTimeout(() => setRefillSuccess(null), 3000);
    },
    onError: (error) => {
      console.error('Refill request failed:', error);
    },
  });

  const filteredPrescriptions = prescriptions.filter((p: Prescription) => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  const canRequestRefill = (prescription: Prescription) => {
    return (
      prescription.refillsRemaining > 0 &&
      (prescription.status === 'ACTIVE' || prescription.status === 'PENDING_REFILL')
    );
  };

  const handleRefillRequest = (prescriptionId: string) => {
    refillMutation.mutate(prescriptionId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center text-gray-500 mt-4">Loading prescriptions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-semibold text-red-800">Error Loading Prescriptions</h3>
              <p className="text-red-600">Unable to load your prescriptions. Please try again later.</p>
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
            <div className="p-3 bg-blue-100 rounded-xl">
              <ClipboardDocumentListIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Prescriptions</h1>
              <p className="text-gray-600">View and manage your medications</p>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Filter:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_REFILL">Pending Refill</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Prescriptions
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'past'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Past Prescriptions
          </button>
        </div>
      </div>

      {/* Success Message */}
      {refillSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircleIcon className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-medium text-green-800">Refill Request Submitted</p>
            <p className="text-sm text-green-600">Your pharmacy will be notified to prepare your refill.</p>
          </div>
        </div>
      )}

      {/* Prescriptions List */}
      {filteredPrescriptions.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-12 text-center">
          <ClipboardDocumentListIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Prescriptions Found</h3>
          <p className="text-gray-600">
            {activeTab === 'active'
              ? 'You have no active prescriptions at this time.'
              : 'You have no past prescriptions to display.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPrescriptions.map((prescription: Prescription) => (
            <div
              key={prescription.id}
              className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Prescription Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-50 rounded-xl flex-shrink-0">
                        <BeakerIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {prescription.medications[0]?.name}
                          </h3>
                          {getStatusBadge(prescription.status)}
                        </div>
                        <p className="text-gray-600 mb-1">
                          {prescription.medications[0]?.dosage} - {prescription.medications[0]?.frequency}
                        </p>
                        <p className="text-sm text-gray-500">
                          Rx: {prescription.prescriptionNumber}
                        </p>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Prescribed by</p>
                          <p className="text-sm font-medium text-gray-900">{prescription.doctor.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Start Date</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(prescription.startDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowPathIcon className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Refills</p>
                          <p className="text-sm font-medium text-gray-900">
                            {prescription.refillsRemaining} of {prescription.refillsTotal} remaining
                          </p>
                        </div>
                      </div>
                      {prescription.lastFilledDate && (
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Last Filled</p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDate(prescription.lastFilledDate)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row lg:flex-col gap-2">
                    <button
                      onClick={() => setSelectedPrescription(prescription)}
                      className="flex-1 lg:flex-none px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      View Details
                    </button>
                    {canRequestRefill(prescription) && (
                      <button
                        onClick={() => handleRefillRequest(prescription.id)}
                        disabled={refillMutation.isPending}
                        className="flex-1 lg:flex-none px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {refillMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Requesting...
                          </>
                        ) : (
                          <>
                            <ArrowPathIcon className="h-4 w-4" />
                            Request Refill
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Prescription Details</h2>
                <p className="text-sm text-gray-500">{selectedPrescription.prescriptionNumber}</p>
              </div>
              <button
                onClick={() => setSelectedPrescription(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Medication Info */}
              {selectedPrescription.medications.map((medication) => (
                <div key={medication.id} className="space-y-6">
                  {/* Basic Info */}
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{medication.name}</h3>
                    {medication.genericName && medication.genericName !== medication.name && (
                      <p className="text-sm text-gray-600 mb-3">Generic: {medication.genericName}</p>
                    )}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Dosage</p>
                        <p className="font-medium text-gray-900">{medication.dosage}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Frequency</p>
                        <p className="font-medium text-gray-900">{medication.frequency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Route</p>
                        <p className="font-medium text-gray-900">{medication.route}</p>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  {medication.instructions && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                        Instructions
                      </h4>
                      <p className="text-gray-600 bg-gray-50 rounded-xl p-4">{medication.instructions}</p>
                    </div>
                  )}

                  {/* Side Effects */}
                  {medication.sideEffects && medication.sideEffects.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                        Possible Side Effects
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {medication.sideEffects.map((effect, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-sm"
                          >
                            {effect}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {medication.warnings && medication.warnings.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                        Important Warnings
                      </h4>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                        {medication.warnings.map((warning, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">*</span>
                            <p className="text-red-700 text-sm">{warning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Prescription Details */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-4">Prescription Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Prescribing Doctor</p>
                    <p className="font-medium text-gray-900">{selectedPrescription.doctor.name}</p>
                    <p className="text-sm text-gray-600">{selectedPrescription.doctor.specialization}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    {getStatusBadge(selectedPrescription.status)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Start Date</p>
                    <p className="font-medium text-gray-900">{formatDate(selectedPrescription.startDate)}</p>
                  </div>
                  {selectedPrescription.endDate && (
                    <div>
                      <p className="text-xs text-gray-500">End Date</p>
                      <p className="font-medium text-gray-900">{formatDate(selectedPrescription.endDate)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Refills Remaining</p>
                    <p className="font-medium text-gray-900">
                      {selectedPrescription.refillsRemaining} of {selectedPrescription.refillsTotal}
                    </p>
                  </div>
                  {selectedPrescription.pharmacy && (
                    <div>
                      <p className="text-xs text-gray-500">Pharmacy</p>
                      <p className="font-medium text-gray-900">{selectedPrescription.pharmacy}</p>
                    </div>
                  )}
                </div>
                {selectedPrescription.notes && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500">Notes</p>
                    <p className="text-gray-600 mt-1">{selectedPrescription.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setSelectedPrescription(null)}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              {canRequestRefill(selectedPrescription) && (
                <button
                  onClick={() => {
                    handleRefillRequest(selectedPrescription.id);
                    setSelectedPrescription(null);
                  }}
                  disabled={refillMutation.isPending}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Request Refill
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
