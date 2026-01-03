import React, { useState, useEffect } from 'react';
import { bloodBankApi, patientApi } from '../../services/api';
import {
  BeakerIcon,
  UserPlusIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  SparklesIcon,
  HeartIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface BloodInventoryItem {
  bloodGroup: string;
  rhFactor: string;
  componentType: string;
  available: number;
  expiringSoon: number;
}

interface DonorStats {
  totalDonors: number;
  activeDonors: number;
  todayDonations: number;
  pendingRequests: number;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

const bloodGroups = ['A', 'B', 'AB', 'O'];
const rhFactors = ['POSITIVE', 'NEGATIVE'];
const componentTypes = ['WHOLE_BLOOD', 'PACKED_RED_CELLS', 'PLATELETS', 'FRESH_FROZEN_PLASMA', 'CRYOPRECIPITATE'];

function RegisterDonorModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    bloodGroup: '',
    rhFactor: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.bloodGroup || !formData.rhFactor) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await bloodBankApi.registerDonor({
        ...formData,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString() : undefined,
      });
      toast.success('Donor registered successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to register donor:', error);
      toast.error(error.response?.data?.message || 'Failed to register donor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Register New Donor</h2>
            <p className="text-white/80 text-sm">Add a new blood donor to the system</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Personal Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group <span className="text-red-500">*</span></label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                  required
                >
                  <option value="">Select...</option>
                  {bloodGroups.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rh Factor <span className="text-red-500">*</span></label>
                <select
                  value={formData.rhFactor}
                  onChange={(e) => setFormData({ ...formData, rhFactor: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                  required
                >
                  <option value="">Select...</option>
                  {rhFactors.map((rh) => (
                    <option key={rh} value={rh}>{rh}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'MALE' | 'FEMALE' })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                />
              </div>
            </div>

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
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-5 w-5" />
                    Register Donor
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

function CreateBloodRequestModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({
    bloodGroup: '',
    rhFactor: '',
    componentType: 'WHOLE_BLOOD',
    units: 1,
    urgency: 'NORMAL' as 'NORMAL' | 'URGENT' | 'EMERGENCY',
    reason: '',
    requiredBy: '',
  });

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
    if (!formData.bloodGroup || !formData.rhFactor) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await bloodBankApi.createBloodRequest({
        patientId: selectedPatient.id,
        bloodGroup: formData.bloodGroup,
        rhFactor: formData.rhFactor,
        componentType: formData.componentType,
        units: formData.units,
        urgency: formData.urgency,
        reason: formData.reason || undefined,
        requiredBy: formData.requiredBy ? new Date(formData.requiredBy).toISOString() : undefined,
      });
      toast.success('Blood request created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create blood request:', error);
      toast.error(error.response?.data?.message || 'Failed to create blood request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Create Blood Request</h2>
            <p className="text-white/80 text-sm">Request blood products for a patient</p>
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
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
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

            {/* Blood Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group <span className="text-red-500">*</span></label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                  required
                >
                  <option value="">Select...</option>
                  {bloodGroups.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rh Factor <span className="text-red-500">*</span></label>
                <select
                  value={formData.rhFactor}
                  onChange={(e) => setFormData({ ...formData, rhFactor: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                  required
                >
                  <option value="">Select...</option>
                  {rhFactors.map((rh) => (
                    <option key={rh} value={rh}>{rh}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Component & Units */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Component Type</label>
                <select
                  value={formData.componentType}
                  onChange={(e) => setFormData({ ...formData, componentType: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                >
                  {componentTypes.map((ct) => (
                    <option key={ct} value={ct}>{ct.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Units Required</label>
                <input
                  type="number"
                  value={formData.units}
                  onChange={(e) => setFormData({ ...formData, units: parseInt(e.target.value) || 1 })}
                  min="1"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                />
              </div>
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
              <div className="flex gap-3">
                {(['NORMAL', 'URGENT', 'EMERGENCY'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setFormData({ ...formData, urgency: u })}
                    className={clsx(
                      'flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border',
                      formData.urgency === u
                        ? u === 'EMERGENCY'
                          ? 'bg-red-500 text-white border-red-500'
                          : u === 'URGENT'
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-rose-500 text-white border-rose-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Required By & Reason */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Required By</label>
                <input
                  type="datetime-local"
                  value={formData.requiredBy}
                  onChange={(e) => setFormData({ ...formData, requiredBy: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Surgery, transfusion, etc."
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                />
              </div>
            </div>

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
                disabled={loading || !selectedPatient}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <ClipboardDocumentCheckIcon className="h-5 w-5" />
                    Create Request
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

const BloodBank: React.FC = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [_inventory, setInventory] = useState<BloodInventoryItem[]>([]);
  void _inventory; // Used for future expansion
  const [showDonorModal, setShowDonorModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // AI Feature states
  const [eligibilityForm, setEligibilityForm] = useState({
    age: 25,
    weight: 60,
    lastDonationDays: 120,
    hemoglobin: 13.5,
    hasInfection: false,
    hasChronicDisease: false,
    isPregnant: false,
    recentSurgery: false,
    medications: [] as string[],
  });
  const [eligibilityResult, setEligibilityResult] = useState<any>(null);

  const [matchingForm, setMatchingForm] = useState({
    patientBloodGroup: 'A',
    patientRhFactor: 'positive',
    transfusionHistory: [] as string[],
    antibodies: [] as string[],
    isEmergency: false,
  });
  const [matchingResult, setMatchingResult] = useState<any>(null);

  const [reactionForm, setReactionForm] = useState({
    patientAge: 45,
    transfusionCount: 3,
    previousReactions: false,
    allergies: [] as string[],
    immunocompromised: false,
    componentAge: 5,
  });
  const [reactionResult, setReactionResult] = useState<any>(null);

  useEffect(() => {
    loadStats();
    loadInventory();
  }, []);

  const loadStats = async () => {
    try {
      const response = await bloodBankApi.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadInventory = async () => {
    try {
      const response = await bloodBankApi.getInventory();
      setInventory(response.data.data || []);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    }
  };

  const checkEligibility = async () => {
    setLoading(true);
    try {
      const response = await bloodBankApi.checkEligibility(eligibilityForm);
      setEligibilityResult(response.data.data);
    } catch (error) {
      console.error('Eligibility check failed:', error);
    }
    setLoading(false);
  };

  const smartMatch = async () => {
    setLoading(true);
    try {
      const response = await bloodBankApi.smartBloodMatch(matchingForm);
      setMatchingResult(response.data.data);
    } catch (error) {
      console.error('Smart matching failed:', error);
    }
    setLoading(false);
  };

  const predictReaction = async () => {
    setLoading(true);
    try {
      const response = await bloodBankApi.predictReaction(reactionForm);
      setReactionResult(response.data.data);
    } catch (error) {
      console.error('Reaction prediction failed:', error);
    }
    setLoading(false);
  };

  const bloodGroups = ['A', 'B', 'AB', 'O'];

  const tabs = [
    { id: 'inventory', name: 'Inventory', icon: BeakerIcon },
    { id: 'donors', name: 'Donors', icon: UserPlusIcon },
    { id: 'requests', name: 'Requests', icon: ClipboardDocumentCheckIcon },
    { id: 'ai-eligibility', name: 'AI Eligibility', icon: SparklesIcon },
    { id: 'ai-matching', name: 'AI Matching', icon: HeartIcon },
    { id: 'ai-reaction', name: 'AI Reaction Risk', icon: ExclamationTriangleIcon },
  ];

  return (
    <div className="min-h-screen space-y-6">
      {/* Glassmorphism Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 via-rose-500 to-pink-600 p-8 shadow-2xl">
        {/* Floating Orbs */}
        <div className="absolute top-4 right-12 w-32 h-32 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-4 left-20 w-24 h-24 bg-pink-300/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-rose-200/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Blur Overlay */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />

        <div className="relative z-10 flex items-center justify-between">
          <div>
            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm border border-white/30 mb-3">
              <HeartIcon className="h-3.5 w-3.5" />
              Blood Bank
            </span>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Blood Bank Management</h1>
            <p className="text-rose-100 mt-1">AI-powered blood bank operations and matching</p>
          </div>
          <button
            onClick={() => { loadStats(); loadInventory(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm border border-white/30 transition-all duration-300 hover:scale-105 hover:shadow-lg"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards with Glass Effect */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: UserPlusIcon, label: 'Total Donors', value: stats?.totalDonors || 0, color: 'red', delay: '0ms' },
          { icon: HeartIcon, label: "Today's Donations", value: stats?.todayDonations || 0, color: 'green', delay: '100ms' },
          { icon: ClipboardDocumentCheckIcon, label: 'Pending Requests', value: stats?.pendingRequests || 0, color: 'yellow', delay: '200ms' },
          { icon: ChartBarIcon, label: 'Active Donors', value: stats?.activeDonors || 0, color: 'blue', delay: '300ms' },
        ].map((stat, index) => (
          <div
            key={index}
            className="relative backdrop-blur-xl bg-white p-5 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
            style={{ animationDelay: stat.delay }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${
                stat.color === 'red' ? 'from-red-400 to-rose-500' :
                stat.color === 'green' ? 'from-green-400 to-emerald-500' :
                stat.color === 'yellow' ? 'from-yellow-400 to-amber-500' :
                'from-blue-400 to-indigo-500'
              } shadow-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Animated Gradient Tabs */}
      <div className="relative backdrop-blur-xl bg-white rounded-2xl p-2 border border-gray-200 shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        <nav className="flex flex-wrap gap-2" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content with Glass Effect */}
      <div
        className="relative backdrop-blur-xl bg-white rounded-2xl shadow-xl p-6 border border-gray-200 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
        style={{ animationDelay: '400ms' }}
      >
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />

        {activeTab === 'inventory' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Blood Inventory Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {bloodGroups.map((group, idx) => (
                <div
                  key={group}
                  className="relative backdrop-blur-sm bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">{group}+</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Rh+
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Whole Blood:</span>
                      <span className="font-medium text-gray-900">{Math.floor(Math.random() * 50)} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Packed Cells:</span>
                      <span className="font-medium text-gray-900">{Math.floor(Math.random() * 30)} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plasma:</span>
                      <span className="font-medium text-gray-900">{Math.floor(Math.random() * 40)} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Platelets:</span>
                      <span className="font-medium text-gray-900">{Math.floor(Math.random() * 20)} units</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <h3 className="font-medium mb-3 text-gray-900">Rh Negative Inventory (Critical)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {bloodGroups.map((group, idx) => (
                  <div
                    key={`${group}-neg`}
                    className="relative backdrop-blur-sm bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
                    style={{ animationDelay: `${(idx + 4) * 100}ms` }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">{group}-</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                        Rh-
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{Math.floor(Math.random() * 15)} units</span>
                      {Math.random() > 0.5 && (
                        <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                          Low
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'donors' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Donor Management</h2>
            <div className="text-center py-12">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 mb-4">
                <UserPlusIcon className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-500">Donor registration and management interface</p>
              <button
                onClick={() => setShowDonorModal(true)}
                className="mt-4 px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/30 font-medium"
              >
                Register New Donor
              </button>
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Blood Requests</h2>
            <div className="text-center py-12">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 mb-4">
                <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-500">Blood request management interface</p>
              <button
                onClick={() => setShowRequestModal(true)}
                className="mt-4 px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/30 font-medium"
              >
                Create New Request
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ai-eligibility' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-400 to-violet-500 shadow-lg">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              AI Donor Eligibility Assessment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={eligibilityForm.age}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, age: parseInt(e.target.value) })}
                      className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={eligibilityForm.weight}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, weight: parseInt(e.target.value) })}
                      className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hemoglobin (g/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={eligibilityForm.hemoglobin}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, hemoglobin: parseFloat(e.target.value) })}
                      className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Days Since Last Donation</label>
                    <input
                      type="number"
                      value={eligibilityForm.lastDonationDays}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, lastDonationDays: parseInt(e.target.value) })}
                      className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                    />
                  </div>
                </div>
                <div className="space-y-2 p-4 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={eligibilityForm.hasInfection}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, hasInfection: e.target.checked })}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500 transition-all duration-200"
                    />
                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Active Infection</span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={eligibilityForm.hasChronicDisease}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, hasChronicDisease: e.target.checked })}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500 transition-all duration-200"
                    />
                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Chronic Disease</span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={eligibilityForm.recentSurgery}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, recentSurgery: e.target.checked })}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500 transition-all duration-200"
                    />
                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Recent Surgery (last 6 months)</span>
                  </label>
                </div>
                <button
                  onClick={checkEligibility}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-xl hover:from-purple-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/30 font-medium"
                >
                  {loading ? 'Analyzing...' : 'Check Eligibility'}
                </button>
              </div>
              <div>
                {eligibilityResult && (
                  <div className={`relative p-5 rounded-xl backdrop-blur-sm border ${eligibilityResult.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                    <h3 className={`font-semibold text-lg flex items-center gap-2 ${eligibilityResult.eligible ? 'text-green-800' : 'text-red-800'}`}>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${eligibilityResult.eligible ? 'bg-green-100' : 'bg-red-100'}`}>
                        <span className={`w-2 h-2 rounded-full ${eligibilityResult.eligible ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {eligibilityResult.eligible ? 'Eligible to Donate' : 'Not Eligible'}
                      </span>
                    </h3>
                    {eligibilityResult.deferralReasons?.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium text-gray-700">Deferral Reasons:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                          {eligibilityResult.deferralReasons.map((reason: string, idx: number) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {eligibilityResult.recommendations?.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium text-gray-700">Recommendations:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                          {eligibilityResult.recommendations.map((rec: string, idx: number) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {eligibilityResult.nextEligibleDate && (
                      <p className="mt-3 text-sm text-gray-600">
                        Next eligible date: <span className="font-medium text-gray-900">{eligibilityResult.nextEligibleDate}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai-matching' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-400 to-rose-500 shadow-lg">
                <HeartIcon className="h-5 w-5 text-white" />
              </div>
              AI Smart Blood Matching
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient Blood Group</label>
                    <select
                      value={matchingForm.patientBloodGroup}
                      onChange={(e) => setMatchingForm({ ...matchingForm, patientBloodGroup: e.target.value })}
                      className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                    >
                      {bloodGroups.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rh Factor</label>
                    <select
                      value={matchingForm.patientRhFactor}
                      onChange={(e) => setMatchingForm({ ...matchingForm, patientRhFactor: e.target.value })}
                      className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                    >
                      <option value="positive">Positive (+)</option>
                      <option value="negative">Negative (-)</option>
                    </select>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={matchingForm.isEmergency}
                      onChange={(e) => setMatchingForm({ ...matchingForm, isEmergency: e.target.checked })}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500 transition-all duration-200"
                    />
                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Emergency Transfusion</span>
                  </label>
                </div>
                <button
                  onClick={smartMatch}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/30 font-medium"
                >
                  {loading ? 'Finding Best Match...' : 'Find Compatible Blood'}
                </button>
              </div>
              <div>
                {matchingResult && (
                  <div className="relative backdrop-blur-sm bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                    <h3 className="font-semibold text-lg text-gray-800 mb-3">Matching Results</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Compatible Blood Types:</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {matchingResult.compatibleTypes?.map((type: string, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full text-sm font-medium shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/80"></span>
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                      {matchingResult.recommendations?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">AI Recommendations:</p>
                          <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                            {matchingResult.recommendations.map((rec: string, idx: number) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai-reaction' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
              <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-white" />
              </div>
              AI Transfusion Reaction Risk Prediction
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient Age</label>
                    <input
                      type="number"
                      value={reactionForm.patientAge}
                      onChange={(e) => setReactionForm({ ...reactionForm, patientAge: parseInt(e.target.value) })}
                      className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prior Transfusions</label>
                    <input
                      type="number"
                      value={reactionForm.transfusionCount}
                      onChange={(e) => setReactionForm({ ...reactionForm, transfusionCount: parseInt(e.target.value) })}
                      className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Component Age (days)</label>
                  <input
                    type="number"
                    value={reactionForm.componentAge}
                    onChange={(e) => setReactionForm({ ...reactionForm, componentAge: parseInt(e.target.value) })}
                    className="block w-full rounded-xl border-gray-300 bg-white backdrop-blur-sm shadow-sm focus:border-red-500 focus:ring-red-500 transition-all duration-200"
                  />
                </div>
                <div className="space-y-2 p-4 rounded-xl bg-gray-50 backdrop-blur-sm border border-gray-200">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={reactionForm.previousReactions}
                      onChange={(e) => setReactionForm({ ...reactionForm, previousReactions: e.target.checked })}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500 transition-all duration-200"
                    />
                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Previous Transfusion Reactions</span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={reactionForm.immunocompromised}
                      onChange={(e) => setReactionForm({ ...reactionForm, immunocompromised: e.target.checked })}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500 transition-all duration-200"
                    />
                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Immunocompromised</span>
                  </label>
                </div>
                <button
                  onClick={predictReaction}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-xl hover:from-yellow-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-500/30 font-medium"
                >
                  {loading ? 'Analyzing Risk...' : 'Predict Reaction Risk'}
                </button>
              </div>
              <div>
                {reactionResult && (
                  <div className={`relative p-5 rounded-xl backdrop-blur-sm border ${
                    reactionResult.riskLevel === 'LOW' ? 'bg-green-50 border-green-200' :
                    reactionResult.riskLevel === 'MODERATE' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                    <h3 className="font-semibold text-lg mb-2">
                      <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm ${
                        reactionResult.riskLevel === 'LOW' ? 'bg-green-100 text-green-800' :
                        reactionResult.riskLevel === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          reactionResult.riskLevel === 'LOW' ? 'bg-green-500' :
                          reactionResult.riskLevel === 'MODERATE' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}></span>
                        Risk Level: {reactionResult.riskLevel}
                      </span>
                    </h3>
                    <div className="mt-3">
                      <p className="text-sm text-gray-600">
                        Risk Score: <span className="font-semibold text-gray-900 text-lg">{reactionResult.riskScore}%</span>
                      </p>
                    </div>
                    {reactionResult.riskFactors?.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium text-gray-700">Risk Factors:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                          {reactionResult.riskFactors.map((factor: any, idx: number) => (
                            <li key={idx}>{factor.factor || factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {reactionResult.precautions?.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium text-gray-700">Recommended Precautions:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                          {reactionResult.precautions.map((prec: string, idx: number) => (
                            <li key={idx}>{prec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add keyframes for fadeIn animation */}
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

      {/* Register Donor Modal */}
      {showDonorModal && (
        <RegisterDonorModal
          onClose={() => setShowDonorModal(false)}
          onSuccess={() => {
            setShowDonorModal(false);
            loadStats();
          }}
        />
      )}

      {/* Blood Request Modal */}
      {showRequestModal && (
        <CreateBloodRequestModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
            loadStats();
          }}
        />
      )}
    </div>
  );
};

export default BloodBank;
