import { useState, useEffect } from 'react';
import {
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { emergencyApi, patientApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface BloodInventory {
  bloodType: string;
  bloodGroup: string;
  rhFactor: string;
  totalUnits: number;
  componentBreakdown: Record<string, number>;
  statusLevel: 'critical' | 'low' | 'adequate';
}

interface BloodRequest {
  id: string;
  requestNumber: string;
  patientName: string;
  patientBloodType: string;
  componentType: string;
  unitsRequired: number;
  unitsFulfilled: number;
  priority: string;
  status: string;
  indication: string;
  createdAt: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  bloodGroup?: string;
}

export default function BloodBank() {
  const [inventory, setInventory] = useState<BloodInventory[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showEmergencyReleaseModal, setShowEmergencyReleaseModal] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [inventoryRes, requestsRes] = await Promise.all([
        emergencyApi.getBloodBankInventory(),
        emergencyApi.getBloodBankRequests(),
      ]);
      setInventory(inventoryRes.data.data || []);
      setRequests(requestsRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch blood bank data:', error);
      toast.error('Failed to load blood bank data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate totals and critical counts
  const totalUnits = inventory.reduce((sum, item) => sum + item.totalUnits, 0);
  const criticalTypes = inventory.filter(item => item.statusLevel === 'critical').length;
  const lowTypes = inventory.filter(item => item.statusLevel === 'low').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500 text-white';
      case 'low': return 'bg-yellow-500 text-black';
      case 'adequate': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY': return 'bg-red-600 text-white animate-pulse';
      case 'URGENT': return 'bg-orange-500 text-white';
      case 'ROUTINE': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-red-500" />
        <span className="ml-3 text-gray-600">Loading blood bank data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl border border-red-200 shadow-lg p-5">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
              <BeakerIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
              <p className="text-sm text-gray-600">Total Units</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl border border-red-200 shadow-lg p-5">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center animate-pulse">
              <ExclamationTriangleIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{criticalTypes}</p>
              <p className="text-sm text-gray-600">Critical Low</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200 shadow-lg p-5">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500 flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{lowTypes}</p>
              <p className="text-sm text-gray-600">Low Stock</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border border-blue-200 shadow-lg p-5">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
              <p className="text-sm text-gray-600">Pending Requests</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowRequestModal(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          Request Blood
        </button>
        <button
          onClick={() => setShowEmergencyReleaseModal(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-white/30 animate-pulse"
        >
          Emergency Release (O-)
        </button>
        <button
          onClick={fetchData}
          className="px-5 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
        >
          <ArrowPathIcon className="h-5 w-5 inline mr-2" />
          Refresh
        </button>
      </div>

      {/* Blood Inventory Grid */}
      <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Blood Inventory by Type</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {inventory.map((item) => (
            <div
              key={item.bloodType}
              className={clsx(
                'relative overflow-hidden rounded-xl p-4 border-2 transition-all duration-300 hover:scale-105',
                item.statusLevel === 'critical' ? 'bg-red-50 border-red-500' :
                item.statusLevel === 'low' ? 'bg-yellow-50 border-yellow-500' :
                'bg-green-50 border-green-500'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-gray-900">{item.bloodType}</span>
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs font-bold',
                  getStatusColor(item.statusLevel)
                )}>
                  {item.totalUnits}
                </span>
              </div>
              
              <div className="space-y-1">
                {Object.entries(item.componentBreakdown).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-xs text-gray-600">
                    <span className="truncate">{type.replace(/_/g, ' ')}</span>
                    <span className="font-medium ml-2">{count}</span>
                  </div>
                ))}
              </div>

              {item.statusLevel === 'critical' && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-700 font-medium">
                  <ExclamationTriangleIcon className="h-4 w-4 animate-pulse" />
                  <span>Critical!</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Pending Blood Requests</h3>
          
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className={clsx(
                  'p-4 rounded-xl border-2 transition-all',
                  request.priority === 'EMERGENCY' ? 'border-red-500 bg-red-50' :
                  request.priority === 'URGENT' ? 'border-orange-500 bg-orange-50' :
                  'border-blue-500 bg-blue-50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={clsx(
                        'px-2 py-1 rounded-full text-xs font-bold',
                        getPriorityColor(request.priority)
                      )}>
                        {request.priority}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{request.requestNumber}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div>
                        <span className="text-gray-600">Patient:</span>
                        <span className="ml-2 font-medium text-gray-900">{request.patientName}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Blood Type:</span>
                        <span className="ml-2 font-medium text-gray-900">{request.patientBloodType}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Component:</span>
                        <span className="ml-2 font-medium text-gray-900">{request.componentType.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Units:</span>
                        <span className="ml-2 font-medium text-gray-900">{request.unitsFulfilled}/{request.unitsRequired}</span>
                      </div>
                    </div>
                    
                    {request.indication && (
                      <p className="text-xs text-gray-600 mt-2">
                        <span className="font-medium">Indication:</span> {request.indication}
                      </p>
                    )}
                  </div>

                  <div className="ml-4">
                    <span className={clsx(
                      'inline-block px-3 py-1 rounded-full text-xs font-medium',
                      request.status === 'FULFILLED' ? 'bg-green-100 text-green-800' :
                      request.status === 'PARTIALLY_FULFILLED' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    )}>
                      {request.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Blood Modal */}
      {showRequestModal && (
        <RequestBloodModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
            fetchData();
            toast.success('Blood request created successfully');
          }}
        />
      )}

      {/* Emergency Release Modal */}
      {showEmergencyReleaseModal && (
        <EmergencyReleaseModal
          onClose={() => setShowEmergencyReleaseModal(false)}
          onSuccess={() => {
            setShowEmergencyReleaseModal(false);
            fetchData();
            toast.success('Emergency blood released');
          }}
        />
      )}
    </div>
  );
}

// Request Blood Modal Component
function RequestBloodModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({
    bloodType: 'O+',
    componentType: 'PACKED_RED_CELLS',
    unitsNeeded: 1,
    urgency: 'URGENT' as 'STAT' | 'URGENT' | 'ROUTINE',
    indication: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    setLoading(true);
    try {
      await emergencyApi.createBloodRequest({
        patientId: selectedPatient.id,
        bloodType: formData.bloodType,
        componentType: formData.componentType,
        unitsNeeded: formData.unitsNeeded,
        urgency: formData.urgency,
        indication: formData.indication,
      });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create blood request:', error);
      toast.error(error.response?.data?.message || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 via-rose-500 to-red-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Request Blood</h2>
            <p className="text-red-100 text-sm">Create emergency blood request</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Patient Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient <span className="text-red-500">*</span>
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
                    placeholder="Search patient..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
                  />
                  {searching && <ArrowPathIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />}
                  
                  {patients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {patients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatient(patient);
                            if (patient.bloodGroup) {
                              // Map BloodGroup enum to blood type string
                              const bg = patient.bloodGroup.replace('_', '');
                              setFormData({ ...formData, bloodType: bg });
                            }
                            setSearchQuery('');
                            setPatients([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50"
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

            {/* Blood Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blood Type</label>
              <select
                value={formData.bloodType}
                onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
              >
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            {/* Component Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Component Type</label>
              <select
                value={formData.componentType}
                onChange={(e) => setFormData({ ...formData, componentType: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
              >
                <option value="PACKED_RED_CELLS">Packed Red Cells</option>
                <option value="WHOLE_BLOOD">Whole Blood</option>
                <option value="FRESH_FROZEN_PLASMA">Fresh Frozen Plasma</option>
                <option value="PLATELET_CONCENTRATE">Platelet Concentrate</option>
                <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
              </select>
            </div>

            {/* Units Needed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Units Needed</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.unitsNeeded}
                onChange={(e) => setFormData({ ...formData, unitsNeeded: parseInt(e.target.value) || 1 })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
              />
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
              >
                <option value="STAT">STAT (Immediate)</option>
                <option value="URGENT">URGENT (Within 1 hour)</option>
                <option value="ROUTINE">ROUTINE (Scheduled)</option>
              </select>
            </div>

            {/* Indication */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Indication <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.indication}
                onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
                placeholder="Reason for transfusion..."
                rows={3}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Emergency Release Modal Component
function EmergencyReleaseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [unitsNeeded, setUnitsNeeded] = useState(2);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    if (!confirm('EMERGENCY RELEASE: This will immediately release O- universal donor blood. Cross-match will be done later. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      await emergencyApi.emergencyBloodRelease({
        patientId: selectedPatient.id,
        unitsNeeded,
      });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to release blood:', error);
      toast.error(error.response?.data?.message || 'Failed to release blood');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-red-600">
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-4 animate-pulse">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ExclamationTriangleIcon className="h-6 w-6" />
              Emergency Release (O-)
            </h2>
            <p className="text-red-100 text-sm">Life-threatening situation - Immediate blood release</p>
          </div>

          <div className="bg-red-50 border-b-2 border-red-300 px-6 py-3">
            <p className="text-sm text-red-800 font-medium">
              ⚠️ Warning: This will release O- universal donor blood WITHOUT cross-match. Use only in life-threatening emergencies.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Patient Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient <span className="text-red-500">*</span>
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
                    placeholder="Search patient..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
                  />
                  {searching && <ArrowPathIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />}
                  
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
                          className="w-full text-left px-4 py-2 hover:bg-gray-50"
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

            {/* Units Needed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Units Needed (O- Packed RBC)</label>
              <input
                type="number"
                min="1"
                max="6"
                value={unitsNeeded}
                onChange={(e) => setUnitsNeeded(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
              <p className="text-sm text-yellow-800">
                <strong>Protocol:</strong> Monitor patient closely for transfusion reactions. Cross-match will be performed after release.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 animate-pulse"
              >
                {loading ? 'Releasing...' : 'EMERGENCY RELEASE'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
