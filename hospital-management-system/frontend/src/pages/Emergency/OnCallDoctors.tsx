import { useState, useEffect } from 'react';
import {
  UserCircleIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { emergencyApi, patientApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface OnCallDoctor {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    avatar?: string;
  };
  department: string;
  specialization: string;
  experience: number;
  status: 'AVAILABLE' | 'RESPONDING' | 'IN_SURGERY' | 'ON_BREAK';
  avgResponseTime?: number;
  totalPages: number;
}

interface Page {
  id: string;
  doctorName: string;
  patientName?: string;
  urgency: 'STAT' | 'URGENT' | 'ROUTINE';
  message: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'EN_ROUTE' | 'ARRIVED' | 'DECLINED' | 'EXPIRED';
  pagedByName: string;
  createdAt: string;
  elapsedMinutes: number;
  responseMinutes?: number;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

export default function OnCallDoctors() {
  const [doctors, setDoctors] = useState<OnCallDoctor[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPageModal, setShowPageModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<OnCallDoctor | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [doctorsRes, pagesRes] = await Promise.all([
        emergencyApi.getOnCallDoctors(),
        emergencyApi.getPages(),
      ]);
      setDoctors(doctorsRes.data.data || []);
      setPages(pagesRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch on-call data:', error);
      toast.error('Failed to load on-call doctors');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return { bg: 'bg-green-500', text: 'Available', icon: '✅' };
      case 'RESPONDING':
        return { bg: 'bg-yellow-500', text: 'Responding', icon: '🟡' };
      case 'IN_SURGERY':
        return { bg: 'bg-red-500', text: 'In Surgery', icon: '🔴' };
      case 'ON_BREAK':
        return { bg: 'bg-gray-500', text: 'On Break', icon: '⚪' };
      default:
        return { bg: 'bg-gray-500', text: 'Unknown', icon: '⚫' };
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'STAT':
        return 'bg-red-600 text-white animate-pulse border-2 border-red-800';
      case 'URGENT':
        return 'bg-orange-500 text-white';
      case 'ROUTINE':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getPageStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACKNOWLEDGED':
        return 'bg-blue-100 text-blue-800';
      case 'EN_ROUTE':
        return 'bg-purple-100 text-purple-800';
      case 'ARRIVED':
        return 'bg-green-100 text-green-800';
      case 'DECLINED':
        return 'bg-red-100 text-red-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Group doctors by specialty
  const specialties = ['all', ...new Set(doctors.map(d => d.specialization))];
  const filteredDoctors = selectedSpecialty === 'all'
    ? doctors
    : doctors.filter(d => d.specialization === selectedSpecialty);

  // Count by status
  const availableCount = doctors.filter(d => d.status === 'AVAILABLE').length;
  const respondingCount = doctors.filter(d => d.status === 'RESPONDING').length;
  const activePagesCount = pages.filter(p => ['PENDING', 'ACKNOWLEDGED', 'EN_ROUTE'].includes(p.status)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-red-500" />
        <span className="ml-3 text-gray-600">Loading on-call doctors...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 shadow-lg p-5">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
              <CheckCircleIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{availableCount}</p>
              <p className="text-sm text-gray-600">Available Doctors</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200 shadow-lg p-5">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500 flex items-center justify-center">
              <UserCircleIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{respondingCount}</p>
              <p className="text-sm text-gray-600">Currently Responding</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl border border-red-200 shadow-lg p-5">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
              <BellAlertIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activePagesCount}</p>
              <p className="text-sm text-gray-600">Active Pages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter by Specialty */}
      <div className="flex gap-3 flex-wrap">
        {specialties.map((specialty) => (
          <button
            key={specialty}
            onClick={() => setSelectedSpecialty(specialty)}
            className={clsx(
              'px-4 py-2 rounded-xl font-medium text-sm transition-all',
              selectedSpecialty === specialty
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            {specialty === 'all' ? 'All Specialties' : specialty}
          </button>
        ))}
        <button
          onClick={fetchData}
          className="ml-auto px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
        >
          <ArrowPathIcon className="h-5 w-5 inline mr-2" />
          Refresh
        </button>
      </div>

      {/* Doctor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDoctors.map((doctor) => {
          const statusBadge = getStatusBadge(doctor.status);
          return (
            <div
              key={doctor.id}
              className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-lg p-5 hover:shadow-xl transition-all"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
              
              {/* Doctor Info */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  {doctor.user.avatar ? (
                    <img
                      src={doctor.user.avatar}
                      alt={`${doctor.user.firstName} ${doctor.user.lastName}`}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {doctor.user.firstName[0]}{doctor.user.lastName[0]}
                      </span>
                    </div>
                  )}
                  <div className={clsx(
                    'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs',
                    statusBadge.bg
                  )}>
                    {statusBadge.icon}
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">
                    Dr. {doctor.user.firstName} {doctor.user.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">{doctor.specialization}</p>
                  <p className="text-xs text-gray-500">{doctor.department}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className={clsx(
                'inline-block px-3 py-1 rounded-full text-xs font-bold mb-3',
                statusBadge.bg, 'text-white'
              )}>
                {statusBadge.text}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-gray-600 text-xs">Experience</p>
                  <p className="font-bold text-gray-900">{doctor.experience} years</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-gray-600 text-xs">Avg Response</p>
                  <p className="font-bold text-gray-900">
                    {doctor.avgResponseTime ? `${doctor.avgResponseTime} min` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-1 mb-4 text-xs text-gray-600">
                <p>📧 {doctor.user.email}</p>
                <p>📱 {doctor.user.phone}</p>
              </div>

              {/* Page Button */}
              <button
                onClick={() => {
                  setSelectedDoctor(doctor);
                  setShowPageModal(true);
                }}
                className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50"
                disabled={doctor.status === 'ON_BREAK'}
              >
                <BellAlertIcon className="h-5 w-5 inline mr-2" />
                Page Doctor
              </button>
            </div>
          );
        })}
      </div>

      {/* Active Pages Panel */}
      {pages.length > 0 && (
        <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BellAlertIcon className="h-6 w-6 text-red-500" />
            Active Pages
          </h3>
          
          <div className="space-y-3">
            {pages.map((page) => (
              <div
                key={page.id}
                className={clsx(
                  'p-4 rounded-xl border-2 transition-all',
                  page.urgency === 'STAT' ? 'border-red-500 bg-red-50 animate-pulse' :
                  page.urgency === 'URGENT' ? 'border-orange-500 bg-orange-50' :
                  'border-blue-500 bg-blue-50'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs font-bold',
                      getUrgencyColor(page.urgency)
                    )}>
                      {page.urgency}
                    </span>
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      getPageStatusColor(page.status)
                    )}>
                      {page.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-600 flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    <span>{page.elapsedMinutes} min ago</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                  <div>
                    <span className="text-gray-600">Doctor:</span>
                    <span className="ml-2 font-medium text-gray-900">{page.doctorName}</span>
                  </div>
                  {page.patientName && (
                    <div>
                      <span className="text-gray-600">Patient:</span>
                      <span className="ml-2 font-medium text-gray-900">{page.patientName}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Paged by:</span>
                    <span className="ml-2 font-medium text-gray-900">{page.pagedByName}</span>
                  </div>
                  {page.responseMinutes !== null && (
                    <div>
                      <span className="text-gray-600">Response time:</span>
                      <span className="ml-2 font-medium text-gray-900">{page.responseMinutes} min</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-700 bg-white p-2 rounded-lg">
                  {page.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page Doctor Modal */}
      {showPageModal && selectedDoctor && (
        <PageDoctorModal
          doctor={selectedDoctor}
          onClose={() => {
            setShowPageModal(false);
            setSelectedDoctor(null);
          }}
          onSuccess={() => {
            setShowPageModal(false);
            setSelectedDoctor(null);
            fetchData();
            toast.success('Doctor paged successfully');
          }}
        />
      )}
    </div>
  );
}

// Page Doctor Modal Component
function PageDoctorModal({
  doctor,
  onClose,
  onSuccess,
}: {
  doctor: OnCallDoctor;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({
    urgency: 'URGENT' as 'STAT' | 'URGENT' | 'ROUTINE',
    message: '',
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
    if (!formData.message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      await emergencyApi.pageDoctor({
        doctorId: doctor.id,
        patientId: selectedPatient?.id,
        urgency: formData.urgency,
        message: formData.message,
      });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to page doctor:', error);
      toast.error(error.response?.data?.message || 'Failed to page doctor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className={clsx(
            "px-6 py-4",
            formData.urgency === 'STAT' ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 animate-pulse' :
            'bg-gradient-to-r from-red-600 via-rose-500 to-red-700'
          )}>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BellAlertIcon className="h-6 w-6" />
              Page Dr. {doctor.user.firstName} {doctor.user.lastName}
            </h2>
            <p className="text-red-100 text-sm">{doctor.specialization}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Urgency <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: 'STAT' })}
                  className={clsx(
                    'px-4 py-3 rounded-xl font-bold text-sm transition-all',
                    formData.urgency === 'STAT'
                      ? 'bg-red-600 text-white animate-pulse border-2 border-red-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  STAT
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: 'URGENT' })}
                  className={clsx(
                    'px-4 py-3 rounded-xl font-bold text-sm transition-all',
                    formData.urgency === 'URGENT'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  URGENT
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: 'ROUTINE' })}
                  className={clsx(
                    'px-4 py-3 rounded-xl font-bold text-sm transition-all',
                    formData.urgency === 'ROUTINE'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  ROUTINE
                </button>
              </div>
            </div>

            {/* Patient (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient (Optional)
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
                    Clear
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

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Describe the situation..."
                rows={4}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500/50"
              />
            </div>

            {formData.urgency === 'STAT' && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-3">
                <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                  <ExclamationCircleIcon className="h-5 w-5" />
                  STAT pages will send urgent notification to the doctor immediately
                </p>
              </div>
            )}

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
                className={clsx(
                  'flex-1 px-4 py-3 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50',
                  formData.urgency === 'STAT'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white animate-pulse'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                )}
              >
                {loading ? 'Paging...' : 'Page Doctor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
