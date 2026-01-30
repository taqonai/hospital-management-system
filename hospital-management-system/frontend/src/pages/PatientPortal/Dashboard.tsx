import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Dialog, Transition } from '@headlessui/react';
import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  BeakerIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  UserCircleIcon,
  PhoneIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  BellIcon,
  SparklesIcon,
  PlusIcon,
  XMarkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import { CurrencyDisplay } from '../../components/common';
import PatientNotificationDropdown from '../../components/patient-portal/PatientNotificationDropdown';

// Types
interface Appointment {
  id: string;
  doctorName: string;
  specialty: string;
  department?: string;
  date: string;
  time: string;
  status: string;
  type?: string;
}

interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  status: 'ACTIVE' | 'NEEDS_REFILL' | 'EXPIRED';
  refillsRemaining: number;
}

interface LabResult {
  id: string;
  testName: string;
  testDate: string;
  status: 'READY' | 'PENDING' | 'REVIEWED';
  hasAbnormalValues?: boolean;
  keyValues?: { name: string; value: string; status: string }[];
}

interface Bill {
  id: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE' | 'PAID';
}

interface HealthReminder {
  id: string;
  type: 'medication' | 'appointment' | 'checkup';
  title: string;
  description: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}

interface VitalBadge {
  label: string;
  value: string;
  unit: string;
  status: 'normal' | 'attention' | 'critical';
}

interface PatientProfile {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  gender?: string;
  mrn?: string;
}

interface DashboardData {
  profile: PatientProfile;
  healthScore: number;
  scoreLabel: string;
  vitals: VitalBadge[];
  upcomingAppointments: Appointment[];
  recentPrescriptions: Prescription[];
  labResults: LabResult[];
  outstandingBills: Bill[];
  totalAmountDue: number;
  healthReminders: HealthReminder[];
  metrics: {
    upcomingAppointments: number;
    activePrescriptions: number;
    pendingLabs: number;
    outstandingBalance: number;
    remindersCount: number;
  };
}

// Helpers
const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (timeString: string): string => {
  if (!timeString) return 'N/A';
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
};

const getAppointmentStatusConfig = (status: string) => {
  const normalized = status?.toUpperCase()?.replace(/[\s-]/g, '_') || '';
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Scheduled' },
    CONFIRMED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' },
    CHECKED_IN: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Checked In' },
    IN_PROGRESS: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Progress' },
    COMPLETED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Completed' },
    CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
    NO_SHOW: { bg: 'bg-red-100', text: 'text-red-600', label: 'No Show' },
    RESCHEDULED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Rescheduled' },
    WAITING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Waiting' },
  };
  return configs[normalized] || { bg: 'bg-blue-100', text: 'text-blue-700', label: status?.replace(/_/g, ' ') || 'Unknown' };
};

const calculateAge = (dob?: string): string => {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  const age = Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${age}y`;
};

const vitalStatusColor = (status: string) => {
  switch (status) {
    case 'normal': return 'bg-green-100 text-green-700 border-green-200';
    case 'attention': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'critical': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

// Main Dashboard Component
export default function PatientPortalDashboard() {
  const navigate = useNavigate();
  const user = useSelector((state: any) => state.auth.user);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBookingChoice, setShowBookingChoice] = useState(false);

  const patientUser = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('patientUser') || 'null')
    : null;

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);

    // Fetch all endpoints in parallel using Promise.allSettled
    const results = await Promise.allSettled([
      patientPortalApi.getSummary(),                                    // 0
      patientPortalApi.getAppointments({ type: 'upcoming', limit: 2 }),  // 1
      patientPortalApi.getPrescriptions({ status: 'active', limit: 2 }), // 2
      patientPortalApi.getLabResults({ limit: 2 }),                     // 3
      patientPortalApi.getBillingSummary(),                             // 4
      patientPortalApi.getBills({ type: 'pending', limit: 3 }),         // 5
      patientPortalApi.getHealthInsights(),                            // 6
      patientPortalApi.getProfile(),                                   // 7
    ]);

    const extract = (idx: number) => {
      const r = results[idx];
      if (r.status === 'fulfilled') return r.value?.data?.data || r.value?.data || {};
      return null;
    };

    const summary = extract(0) || {};
    const appointmentsRaw = extract(1);
    const prescriptionsRaw = extract(2);
    const labsRaw = extract(3);
    const billing = extract(4) || {};
    const billsRaw = extract(5);
    const healthInsights = extract(6) || {};
    const profileData = extract(7) || {};

    const toArray = (raw: any) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (raw.data && Array.isArray(raw.data)) return raw.data;
      return [];
    };

    const appointments = toArray(appointmentsRaw);
    const prescriptions = toArray(prescriptionsRaw);
    const labs = toArray(labsRaw);
    const bills = toArray(billsRaw);

    // Build profile
    const profile: PatientProfile = {
      firstName: profileData?.firstName || summary?.patient?.firstName || patientUser?.firstName || user?.firstName || 'Patient',
      lastName: profileData?.lastName || summary?.patient?.lastName || patientUser?.lastName || user?.lastName || '',
      dateOfBirth: profileData?.dateOfBirth || summary?.patient?.dateOfBirth,
      bloodGroup: profileData?.bloodGroup || summary?.patient?.bloodGroup,
      gender: profileData?.gender || summary?.patient?.gender,
      mrn: profileData?.mrn || profileData?.patientId,
    };

    // Build vitals from health insights metrics
    const vitals: VitalBadge[] = [];
    const metricsArr = healthInsights?.metrics || [];
    for (const m of metricsArr) {
      if (m.value === '--') continue;
      vitals.push({
        label: m.name,
        value: String(m.value),
        unit: m.unit || '',
        status: m.status || 'normal',
      });
    }

    // Transform appointments
    const upcomingAppointments: Appointment[] = appointments.map((apt: any) => ({
      id: apt.id,
      doctorName: apt.doctor?.user
        ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`
        : apt.doctorName || 'Doctor',
      specialty: apt.doctor?.specialization || apt.specialty || 'General',
      department: apt.department?.name || apt.department,
      date: apt.appointmentDate || apt.scheduledAt || apt.date,
      time: apt.startTime || apt.time,
      status: apt.status,
      type: apt.type,
    }));

    // Transform prescriptions
    const recentPrescriptions: Prescription[] = prescriptions.map((rx: any) => ({
      id: rx.id,
      medicationName: rx.medications?.[0]?.name || rx.medicationName || 'Medication',
      dosage: rx.medications?.[0]?.dosage || rx.dosage || '',
      frequency: rx.medications?.[0]?.frequency || rx.frequency || '',
      status: rx.refillsRemaining === 0 ? 'NEEDS_REFILL' as const :
              rx.status === 'PENDING_REFILL' ? 'NEEDS_REFILL' as const :
              rx.status === 'COMPLETED' ? 'EXPIRED' as const : 'ACTIVE' as const,
      refillsRemaining: rx.refillsRemaining || 0,
    }));

    // Transform lab results
    const labResults: LabResult[] = labs.map((lab: any) => ({
      id: lab.id,
      testName: lab.testName || 'Lab Test',
      testDate: lab.testDate || lab.reportDate,
      status: lab.status,
      hasAbnormalValues: lab.results?.some(
        (r: any) => r.status === 'HIGH' || r.status === 'LOW' || r.status === 'CRITICAL_HIGH' || r.status === 'CRITICAL_LOW'
      ),
      keyValues: lab.results?.slice(0, 2).map((r: any) => ({
        name: r.testCode || r.testName,
        value: `${r.value} ${r.unit}`,
        status: r.status,
      })),
    }));

    // Transform bills
    const outstandingBills: Bill[] = bills.map((bill: any) => ({
      id: bill.id,
      invoiceNumber: bill.invoiceNumber,
      description: bill.description || 'Medical Services',
      amount: Number(bill.balanceDue || bill.totalAmount || 0),
      dueDate: bill.dueDate,
      status: bill.status,
    }));

    // Generate health reminders
    const healthReminders: HealthReminder[] = [];
    recentPrescriptions.forEach((rx) => {
      if (rx.status === 'NEEDS_REFILL') {
        healthReminders.push({
          id: `refill-${rx.id}`,
          type: 'medication',
          title: 'Refill Needed',
          description: rx.medicationName,
          priority: 'high',
        });
      }
    });
    upcomingAppointments.forEach((apt) => {
      const diffDays = Math.ceil((new Date(apt.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 3 && diffDays >= 0) {
        healthReminders.push({
          id: `apt-${apt.id}`,
          type: 'appointment',
          title: 'Upcoming Appointment',
          description: `${apt.doctorName} - ${apt.specialty}`,
          dueDate: apt.date,
          priority: diffDays === 0 ? 'high' : 'medium',
        });
      }
    });
    labResults.forEach((lab) => {
      if (lab.status === 'READY' && lab.hasAbnormalValues) {
        healthReminders.push({
          id: `lab-${lab.id}`,
          type: 'checkup',
          title: 'Review Lab Results',
          description: `${lab.testName} has abnormal values`,
          priority: 'high',
        });
      }
    });

    // Counts for metrics row
    const pendingLabCount = labs.filter((l: any) => l.status === 'PENDING').length;

    setDashboardData({
      profile,
      healthScore: Number(healthInsights?.overallScore || 75),
      scoreLabel: healthInsights?.scoreLabel || 'Good',
      vitals,
      upcomingAppointments,
      recentPrescriptions,
      labResults,
      outstandingBills,
      totalAmountDue: Number(billing?.totalBalance || 0),
      healthReminders,
      metrics: {
        upcomingAppointments: upcomingAppointments.length,
        activePrescriptions: recentPrescriptions.filter(rx => rx.status === 'ACTIVE').length,
        pendingLabs: pendingLabCount,
        outstandingBalance: Number(billing?.totalBalance || 0),
        remindersCount: healthReminders.length,
      },
    });

    setIsLoading(false);
  };

  // Loading
  if (isLoading || !dashboardData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="mt-3 text-gray-600 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <ExclamationCircleIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Unable to Load Dashboard</h2>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchDashboard}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 text-sm"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const data = dashboardData;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* 1. Compact Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {patientUser?.firstName || data.profile.firstName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <PatientNotificationDropdown />
          <a
            href="tel:998"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <PhoneIcon className="h-4 w-4" />
            Emergency
          </a>
        </div>
      </div>

      {/* 2. Patient Info + Vitals Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          {/* Left: Patient info */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold text-white">
                {(data.profile.firstName?.[0] || '') + (data.profile.lastName?.[0] || '')}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {data.profile.firstName} {data.profile.lastName}
              </h2>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                {data.profile.mrn && <span>MRN: {data.profile.mrn.slice(0, 8)}</span>}
                {data.profile.dateOfBirth && (
                  <span>{calculateAge(data.profile.dateOfBirth)} old</span>
                )}
                {data.profile.gender && (
                  <span className="capitalize">{data.profile.gender.toLowerCase()}</span>
                )}
                {data.profile.bloodGroup && (
                  <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded font-medium">
                    {data.profile.bloodGroup}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-12 bg-gray-200" />

          {/* Right: Latest vitals + Health Score */}
          <div className="flex-1 flex flex-wrap items-center gap-2">
            {data.vitals.slice(0, 5).map((v, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${vitalStatusColor(v.status)}`}
              >
                {v.label}: <span className="font-bold">{v.value}</span> {v.unit}
              </span>
            ))}
            {data.vitals.length === 0 && (
              <span className="text-xs text-gray-400">No recent vitals recorded</span>
            )}
          </div>

          {/* Health Score */}
          <div className="flex-shrink-0 text-center px-4">
            <div className={`text-2xl font-bold ${
              data.healthScore >= 85 ? 'text-green-600' :
              data.healthScore >= 70 ? 'text-blue-600' :
              data.healthScore >= 55 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {data.healthScore}
            </div>
            <div className="text-xs text-gray-500">{data.scoreLabel}</div>
          </div>
        </div>
      </div>

      {/* 3. Metrics Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          icon={CalendarDaysIcon}
          value={data.metrics.upcomingAppointments}
          label="Upcoming Appts"
          color="blue"
          onClick={() => navigate('/patient-portal/appointments')}
        />
        <MetricCard
          icon={ClipboardDocumentListIcon}
          value={data.metrics.activePrescriptions}
          label="Active Rx"
          color="emerald"
          onClick={() => navigate('/patient-portal/prescriptions')}
        />
        <MetricCard
          icon={BeakerIcon}
          value={data.metrics.pendingLabs}
          label="Pending Labs"
          color="purple"
          onClick={() => navigate('/patient-portal/labs')}
        />
        <MetricCard
          icon={CreditCardIcon}
          value={data.metrics.outstandingBalance}
          label="Balance Due"
          color="amber"
          isCurrency
          onClick={() => navigate('/patient-portal/billing')}
        />
        <MetricCard
          icon={BellIcon}
          value={data.metrics.remindersCount}
          label="Reminders"
          color="rose"
          onClick={() => {}}
        />
      </div>

      {/* 4. Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Upcoming Appointments */}
          <SectionCard
            title="Upcoming Appointments"
            icon={CalendarDaysIcon}
            iconColor="bg-blue-100 text-blue-600"
            onViewAll={() => navigate('/patient-portal/appointments')}
          >
            {data.upcomingAppointments.length > 0 ? (
              <div className="space-y-2">
                {data.upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex-shrink-0 text-center min-w-[48px] p-2 rounded-lg bg-blue-600 text-white">
                      <div className="text-lg font-bold leading-none">{new Date(apt.date).getDate()}</div>
                      <div className="text-[10px] opacity-80">{new Date(apt.date).toLocaleDateString('en-US', { month: 'short' })}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{apt.doctorName}</p>
                      <p className="text-xs text-gray-500">{apt.specialty}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900">{formatTime(apt.time)}</p>
                      {(() => {
                        const sc = getAppointmentStatusConfig(apt.status);
                        return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>;
                      })()}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setShowBookingChoice(true)}
                  className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm mt-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  Book Appointment
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <CalendarDaysIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No upcoming appointments</p>
                <button
                  onClick={() => setShowBookingChoice(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Book Now
                </button>
              </div>
            )}
          </SectionCard>

          {/* Recent Prescriptions */}
          <SectionCard
            title="Prescriptions"
            icon={ClipboardDocumentListIcon}
            iconColor="bg-emerald-100 text-emerald-600"
            onViewAll={() => navigate('/patient-portal/prescriptions')}
          >
            {data.recentPrescriptions.length > 0 ? (
              <div className="space-y-2">
                {data.recentPrescriptions.map((rx) => (
                  <div key={rx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${rx.status === 'NEEDS_REFILL' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                        <ClipboardDocumentListIcon className={`h-4 w-4 ${rx.status === 'NEEDS_REFILL' ? 'text-amber-600' : 'text-emerald-600'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{rx.medicationName}</p>
                        <p className="text-xs text-gray-500">{rx.dosage} - {rx.frequency}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                      rx.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      rx.status === 'NEEDS_REFILL' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {rx.status === 'NEEDS_REFILL' ? 'Refill Needed' : rx.status === 'EXPIRED' ? 'Expired' : 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <ClipboardDocumentListIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No active prescriptions</p>
              </div>
            )}
          </SectionCard>

          {/* Lab Results */}
          <SectionCard
            title="Lab Results"
            icon={BeakerIcon}
            iconColor="bg-purple-100 text-purple-600"
            onViewAll={() => navigate('/patient-portal/labs')}
          >
            {data.labResults.length > 0 ? (
              <div className="space-y-2">
                {data.labResults.map((lab) => (
                  <div key={lab.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{lab.testName}</p>
                        <p className="text-xs text-gray-500">{formatDate(lab.testDate)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          lab.status === 'READY' ? 'bg-green-100 text-green-700' :
                          lab.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{lab.status === 'READY' ? 'Ready' : lab.status === 'PENDING' ? 'Pending' : 'Reviewed'}</span>
                        {lab.hasAbnormalValues && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Abnormal</span>
                        )}
                      </div>
                    </div>
                    {lab.keyValues && lab.keyValues.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {lab.keyValues.map((kv, i) => (
                          <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            kv.status === 'NORMAL' ? 'bg-green-50 text-green-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {kv.name}: {kv.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <BeakerIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No recent lab results</p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-5">
          {/* Outstanding Bills */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <CreditCardIcon className="h-4 w-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">Outstanding Bills</h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl mb-3">
              <p className="text-xs text-amber-700">Total Due</p>
              <p className="text-xl font-bold text-amber-800"><CurrencyDisplay amount={data.totalAmountDue} /></p>
            </div>
            {data.outstandingBills.length > 0 ? (
              <div className="space-y-2">
                {data.outstandingBills.slice(0, 2).map((bill) => (
                  <div key={bill.id} className={`p-2.5 rounded-lg border text-xs ${
                    bill.status === 'OVERDUE' ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-gray-50/50'
                  }`}>
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-medium truncate">{bill.description}</span>
                      <span className="font-bold text-gray-900 whitespace-nowrap ml-2"><CurrencyDisplay amount={bill.amount} /></span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-500">{formatDate(bill.dueDate)}</span>
                      {bill.status === 'OVERDUE' && <span className="text-red-600 font-medium">Overdue</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3">
                <CheckCircleIcon className="h-8 w-8 text-green-400 mx-auto mb-1" />
                <p className="text-gray-500 text-xs">No outstanding bills</p>
              </div>
            )}
            <button
              onClick={() => navigate('/patient-portal/billing')}
              className="w-full mt-3 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors text-xs"
            >
              View All Bills
            </button>
          </div>

          {/* Health Reminders */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <BellIcon className="h-4 w-4 text-white" />
              <h3 className="font-semibold text-white text-sm">Health Reminders</h3>
            </div>
            {data.healthReminders.length > 0 ? (
              <div className="space-y-2">
                {data.healthReminders.slice(0, 4).map((r) => (
                  <div key={r.id} className={`p-2.5 rounded-lg ${
                    r.priority === 'high' ? 'bg-red-400/20' :
                    r.priority === 'medium' ? 'bg-amber-400/20' : 'bg-white/10'
                  }`}>
                    <p className="text-white text-xs font-medium">{r.title}</p>
                    <p className="text-white/70 text-[10px]">{r.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3">
                <CheckCircleIcon className="h-8 w-8 text-white/50 mx-auto mb-1" />
                <p className="text-white/70 text-xs">All caught up!</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction icon={CalendarDaysIcon} label="Book Appt" onClick={() => setShowBookingChoice(true)} />
              <QuickAction icon={SparklesIcon} label="Symptom Check" onClick={() => navigate('/patient-portal/symptom-checker')} />
              <QuickAction icon={DocumentTextIcon} label="Records" onClick={() => navigate('/patient-portal/records')} />
              <QuickAction icon={ChatBubbleLeftRightIcon} label="Messages" onClick={() => navigate('/patient-portal/messages')} />
              <QuickAction icon={UserCircleIcon} label="Profile" onClick={() => navigate('/patient-portal/settings')} />
              <QuickAction icon={ClockIcon} label="History" onClick={() => navigate('/patient-portal/history')} />
            </div>
          </div>
        </div>
      </div>

      {/* Booking Choice Modal (unchanged) */}
      <Transition appear show={showBookingChoice} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowBookingChoice(false)}>
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                  <Dialog.Title className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Book Appointment</h3>
                      <p className="text-sm text-gray-500 mt-1">Choose how you'd like to proceed</p>
                    </div>
                    <button
                      onClick={() => setShowBookingChoice(false)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6 text-gray-500" />
                    </button>
                  </Dialog.Title>

                  <div className="space-y-3">
                    <button
                      onClick={() => { setShowBookingChoice(false); navigate('/patient-portal/appointments?booking=emergency'); }}
                      className="w-full p-5 rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 hover:shadow-xl transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur rounded-xl text-white">
                          <ExclamationTriangleIcon className="h-8 w-8" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-lg">Emergency</h4>
                            <span className="px-2 py-0.5 text-xs font-bold bg-white text-red-600 rounded-full animate-pulse">INSTANT</span>
                          </div>
                          <p className="text-sm text-red-100 mt-1">One-click booking for urgent care today</p>
                        </div>
                        <ChevronRightIcon className="h-6 w-6 text-white/80" />
                      </div>
                    </button>

                    <button
                      onClick={() => { setShowBookingChoice(false); navigate('/patient-portal/appointments?booking=quick'); }}
                      className="w-full p-5 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 hover:shadow-xl transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur rounded-xl text-white">
                          <ClockIcon className="h-8 w-8" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-lg">Quick Book</h4>
                            <span className="px-2 py-0.5 text-xs font-bold bg-white text-blue-600 rounded-full">2 STEPS</span>
                          </div>
                          <p className="text-sm text-blue-100 mt-1">Select department &rarr; Pick doctor &amp; time</p>
                        </div>
                        <ChevronRightIcon className="h-6 w-6 text-white/80" />
                      </div>
                    </button>

                    <button
                      onClick={() => { setShowBookingChoice(false); navigate('/patient-portal/symptom-checker?autoStart=true'); }}
                      className="w-full p-4 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 hover:border-purple-400 hover:shadow-lg transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white shadow-lg group-hover:scale-110 transition-transform">
                          <SparklesIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">AI-Guided</h4>
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Smart</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Unsure which doctor? AI recommends based on symptoms</p>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-purple-500" />
                      </div>
                    </button>

                    <button
                      onClick={() => { setShowBookingChoice(false); navigate('/patient-portal/appointments?booking=standard'); }}
                      className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all text-left"
                    >
                      <div className="flex items-center justify-center gap-2 text-gray-600">
                        <CalendarDaysIcon className="h-5 w-5" />
                        <span className="text-sm font-medium">Standard Booking (4 steps)</span>
                      </div>
                    </button>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-start gap-3">
                      <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-700">
                        <p className="font-medium">Not sure which option to choose?</p>
                        <p className="mt-1">The AI-Guided Booking helps identify the best specialist for your needs based on your symptoms.</p>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

// Sub-components

function MetricCard({
  icon: Icon,
  value,
  label,
  color,
  isCurrency,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  color: string;
  isCurrency?: boolean;
  onClick: () => void;
}) {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-700' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-700' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', text: 'text-rose-700' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-all text-left group"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded-lg ${c.bg}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-xl font-bold ${c.text}`}>
        {isCurrency ? <CurrencyDisplay amount={value} /> : value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </button>
  );
}

function SectionCard({
  title,
  icon: Icon,
  iconColor,
  onViewAll,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  onViewAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        <button
          onClick={onViewAll}
          className="text-blue-600 text-xs font-medium hover:text-blue-700 flex items-center gap-0.5 group"
        >
          View All
          <ChevronRightIcon className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
      {children}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
    >
      <Icon className="h-5 w-5 text-gray-600" />
      <span className="text-[11px] font-medium text-gray-700">{label}</span>
    </button>
  );
}

// Export named component
export { PatientPortalDashboard };
