import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface PreAuthRequest {
  id: string;
  requestNumber: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  procedureCPTCode: string;
  diagnosisICDCode: string;
  urgency: string;
  status: string;
  authorizationNumber?: string;
  approvedUnits?: number;
  denialReason?: string;
  createdAt: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

interface DHAConfig {
  mode: 'sandbox' | 'production' | 'manual' | 'not_configured';
  isConfigured: boolean;
}

const PreAuth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Check if we're on the /new route or have patient params
  const isNewRoute = location.pathname.includes('/new');
  const urlPatientId = searchParams.get('patientId');
  const urlAppointmentId = searchParams.get('appointmentId');

  // Always show form when on /new route
  const [showForm, setShowForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Form state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [formData, setFormData] = useState({
    procedureCPTCode: '',
    diagnosisICDCode: '',
    urgency: 'ROUTINE',
    notes: '',
    appointmentId: urlAppointmentId || '',
  });

  // DHA configuration status
  const [dhaConfig, setDhaConfig] = useState<DHAConfig>({
    mode: 'manual',
    isConfigured: false,
  });
  const [submittingToDHA, setSubmittingToDHA] = useState(false);

  // Auto-show form when on /new route
  useEffect(() => {
    if (isNewRoute) {
      setShowForm(true);
    }
  }, [isNewRoute]);

  // Load patient if coming from modal with patientId
  useEffect(() => {
    if (urlPatientId && isNewRoute) {
      loadPatientById(urlPatientId);
    }
  }, [urlPatientId, isNewRoute]);

  // Fetch DHA config status
  useEffect(() => {
    fetchDHAConfig();
  }, []);

  const fetchDHAConfig = async () => {
    try {
      const response = await api.get('/dha-eclaim/status');
      if (response.data?.data) {
        const { configured, mode } = response.data.data;
        setDhaConfig({
          mode: configured ? mode : 'manual',
          isConfigured: configured,
        });
      }
    } catch (error) {
      // Default to manual mode if can't fetch config or DHA not configured
      setDhaConfig({ mode: 'manual', isConfigured: false });
    }
  };

  const loadPatientById = async (patientId: string) => {
    try {
      const response = await api.get(`/patients/${patientId}`);
      if (response.data?.data) {
        const patient = response.data.data;
        setSelectedPatient({
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          mrn: patient.mrn,
        });
      }
    } catch (error) {
      console.error('Failed to load patient:', error);
      toast.error('Failed to load patient details');
    }
  };

  // Fetch pre-auth requests
  const { data: preAuthData, isLoading } = useQuery({
    queryKey: ['preAuthRequests', selectedStatus],
    queryFn: async () => {
      const params = selectedStatus !== 'all' ? { status: selectedStatus } : {};
      const response = await api.get('/pre-auth', { params });
      return response.data;
    },
  });

  // Search patients
  const handlePatientSearch = async (query: string) => {
    setPatientSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.get('/patients', { params: { search: query, limit: 10 } });
      setSearchResults(response.data?.data || []);
    } catch (error) {
      console.error('Failed to search patients:', error);
    } finally {
      setSearching(false);
    }
  };

  // Create pre-auth mutation (manual mode)
  const createPreAuthMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/pre-auth', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['preAuthRequests'] });
      toast.success('Pre-authorization request saved. Follow up with insurance manually.');
      setShowForm(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save pre-auth request');
    },
  });

  // Submit to DHA mutation
  const submitToDHAMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/pre-auth/submit-to-dha', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['preAuthRequests'] });
      if (data.data?.status === 'APPROVED') {
        toast.success(`Pre-auth APPROVED! Auth #: ${data.data.authorizationNumber}`);
      } else if (data.data?.status === 'PENDING') {
        toast.success('Pre-auth submitted to DHA. Awaiting response.');
      } else {
        toast.error(`Pre-auth DENIED: ${data.data?.denialReason || 'No reason provided'}`);
      }
      setShowForm(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit to DHA');
    },
  });

  const resetForm = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setSearchResults([]);
    setFormData({
      procedureCPTCode: '',
      diagnosisICDCode: '',
      urgency: 'ROUTINE',
      notes: '',
      appointmentId: '',
    });
  };

  const handleSaveManually = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!formData.procedureCPTCode) {
      toast.error('Please enter a procedure CPT code');
      return;
    }

    createPreAuthMutation.mutate({
      patientId: selectedPatient.id,
      ...formData,
      submissionMode: 'MANUAL',
    });
  };

  const handleSubmitToDHA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!formData.procedureCPTCode) {
      toast.error('Please enter a procedure CPT code');
      return;
    }

    setSubmittingToDHA(true);
    try {
      await submitToDHAMutation.mutateAsync({
        patientId: selectedPatient.id,
        ...formData,
        submissionMode: 'DHA_ECLAIM',
      });
    } finally {
      setSubmittingToDHA(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ClockIcon },
      SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-800', icon: ClockIcon },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon },
      DENIED: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon },
      EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircleIcon },
    };

    const badge = badges[status] || badges.PENDING;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="h-4 w-4" />
        {status}
      </span>
    );
  };

  const getUrgencyBadge = (urgency: string) => {
    const colors: Record<string, string> = {
      ROUTINE: 'bg-gray-100 text-gray-800',
      URGENT: 'bg-orange-100 text-orange-800',
      EMERGENCY: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${colors[urgency] || colors.ROUTINE}`}>
        {urgency}
      </span>
    );
  };

  const isDHAEnabled = dhaConfig.mode === 'sandbox' || dhaConfig.mode === 'production';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pre-Authorization Requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage insurance pre-authorization requests for procedures
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          {/* DHA Status Indicator */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
            isDHAEnabled 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isDHAEnabled ? 'bg-green-500' : 'bg-yellow-500'}`} />
            {isDHAEnabled ? `DHA ${dhaConfig.mode}` : 'Manual Mode'}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5" />
            New Pre-Auth Request
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {['all', 'PENDING', 'SUBMITTED', 'APPROVED', 'DENIED'].map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              selectedStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Pre-Auth List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading pre-auth requests...</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procedure</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diagnosis</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auth #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {preAuthData?.data?.map((request: PreAuthRequest) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{request.requestNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{request.patient.firstName} {request.patient.lastName}</div>
                    <div className="text-sm text-gray-500">MRN: {request.patient.mrn}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.procedureCPTCode}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.diagnosisICDCode || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getUrgencyBadge(request.urgency)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(request.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.authorizationNumber || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900">View</button>
                  </td>
                </tr>
              ))}
              {(!preAuthData?.data || preAuthData.data.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No pre-authorization requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Pre-Authorization Request</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isDHAEnabled 
                    ? `Submit via DHA eClaimLink (${dhaConfig.mode} mode)` 
                    : 'Manual submission - follow up with insurance'}
                </p>
              </div>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            {/* DHA Mode Banner */}
            {!isDHAEnabled && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Manual Mode</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    DHA eClaimLink is not configured. Request will be saved and you'll need to contact the insurance company manually.
                  </p>
                </div>
              </div>
            )}

            <form className="space-y-6">
              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient <span className="text-red-500">*</span>
                </label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <p className="font-semibold text-gray-900">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                      <p className="text-sm text-gray-600">MRN: {selectedPatient.mrn}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => handlePatientSearch(e.target.value)}
                        placeholder="Search by name, MRN, or Emirates ID..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                      {searching && (
                        <ArrowPathIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
                      )}
                    </div>
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(patient);
                              setPatientSearch('');
                              setSearchResults([]);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <p className="font-medium text-gray-900">{patient.firstName} {patient.lastName}</p>
                            <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Procedure CPT Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Procedure CPT Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.procedureCPTCode}
                  onChange={(e) => setFormData({ ...formData, procedureCPTCode: e.target.value })}
                  placeholder="e.g., 99213, 70553"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                />
              </div>

              {/* Diagnosis ICD Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diagnosis ICD-10 Code
                </label>
                <input
                  type="text"
                  value={formData.diagnosisICDCode}
                  onChange={(e) => setFormData({ ...formData, diagnosisICDCode: e.target.value })}
                  placeholder="e.g., J06.9, M54.5"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                />
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                >
                  <option value="ROUTINE">Routine</option>
                  <option value="URGENT">Urgent</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Clinical justification, additional details..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Actions - Dual Mode */}
              <div className="flex flex-col gap-3 pt-4 border-t">
                {isDHAEnabled ? (
                  <>
                    {/* DHA Submit Button */}
                    <button
                      type="button"
                      onClick={handleSubmitToDHA}
                      disabled={submittingToDHA || submitToDHAMutation.isPending}
                      className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submittingToDHA || submitToDHAMutation.isPending ? (
                        <>
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                          Submitting to DHA...
                        </>
                      ) : (
                        <>
                          <PaperAirplaneIcon className="h-5 w-5" />
                          Submit to DHA eClaimLink
                        </>
                      )}
                    </button>
                    {/* Also allow manual save */}
                    <button
                      type="button"
                      onClick={handleSaveManually}
                      disabled={createPreAuthMutation.isPending}
                      className="w-full px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <DocumentCheckIcon className="h-5 w-5" />
                      Save & Follow Up Manually
                    </button>
                  </>
                ) : (
                  /* Manual Mode - Only Save Button */
                  <button
                    type="button"
                    onClick={handleSaveManually}
                    disabled={createPreAuthMutation.isPending}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {createPreAuthMutation.isPending ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <DocumentCheckIcon className="h-5 w-5" />
                        Save & Follow Up Manually
                      </>
                    )}
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="w-full px-6 py-2.5 bg-white text-gray-700 font-medium rounded-xl border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreAuth;
