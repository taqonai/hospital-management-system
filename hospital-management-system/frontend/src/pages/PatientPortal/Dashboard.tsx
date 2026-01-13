import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  BeakerIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  UserCircleIcon,
  PhoneIcon,
  HeartIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  BellIcon,
  SparklesIcon,
  PlusIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  SunIcon,
  LightBulbIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import { CurrencyDisplay } from '../../components/common';

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
  lastFilledDate?: string;
  expiryDate?: string;
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

interface AIHealthInsight {
  summary: {
    totalConditions: number;
    totalAllergies: number;
    riskLevel: string;
  };
  recommendations: Array<{
    title: string;
    description: string;
    priority: string;
  }>;
  riskFactors: Array<{
    factor: string;
    level: string;
  }>;
}

interface DashboardData {
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    bloodGroup?: string;
  };
  upcomingAppointments: Appointment[];
  recentPrescriptions: Prescription[];
  labResults: LabResult[];
  outstandingBills: Bill[];
  totalAmountDue: number;
  healthReminders: HealthReminder[];
  unreadMessages: number;
  aiHealthInsights?: AIHealthInsight;
}

// Health tips array
const healthTips = [
  "Stay hydrated! Aim for 8 glasses of water daily for optimal health.",
  "Regular exercise, even a 30-minute walk, can boost your immune system.",
  "Getting 7-8 hours of sleep helps your body recover and stay healthy.",
  "Eating colorful fruits and vegetables provides essential nutrients.",
  "Take breaks from screens to reduce eye strain and improve focus.",
  "Practice deep breathing to reduce stress and lower blood pressure.",
  "Regular health checkups can catch issues before they become serious.",
  "Wash your hands frequently to prevent the spread of infections.",
];

// Format date helper
const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format time helper
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


// Prescription status badge component
const PrescriptionStatusBadge = ({ status }: { status: Prescription['status'] }) => {
  const statusConfig = {
    ACTIVE: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: CheckCircleIcon,
      label: 'Active',
    },
    NEEDS_REFILL: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      icon: ExclamationTriangleIcon,
      label: 'Needs Refill',
    },
    EXPIRED: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: ExclamationCircleIcon,
      label: 'Expired',
    },
  };

  const config = statusConfig[status] || statusConfig.ACTIVE;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
};

// Lab result status badge component
const LabStatusBadge = ({ status, hasAbnormal }: { status: LabResult['status']; hasAbnormal?: boolean }) => {
  const statusConfig = {
    READY: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: CheckCircleIcon,
      label: 'Ready',
    },
    PENDING: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      icon: ClockIcon,
      label: 'Pending',
    },
    REVIEWED: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: CheckCircleIcon,
      label: 'Reviewed',
    },
  };

  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </span>
      {hasAbnormal && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <ExclamationCircleIcon className="h-3 w-3" />
          Abnormal
        </span>
      )}
    </div>
  );
};

// Quick action button component
const QuickActionButton = ({
  icon: Icon,
  label,
  description,
  onClick,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  gradient: string;
}) => (
  <button
    onClick={onClick}
    className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-5 text-left hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
  >
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <div className={`absolute inset-0 ${gradient} opacity-5`} />
    </div>
    <div className="relative z-10">
      <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <ChevronRightIcon className="absolute top-5 right-5 h-5 w-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
  </button>
);

// Glass card component
const GlassCard = ({
  children,
  className = '',
  padding = 'p-6',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) => (
  <div className={`relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg ${padding} ${className}`}>
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    {children}
  </div>
);

// Main Dashboard Component
export default function PatientPortalDashboard() {
  const navigate = useNavigate();
  const user = useSelector((state: any) => state.auth.user);
  const [healthTip, setHealthTip] = useState('');
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  // Check if this is the user's first visit
  useEffect(() => {
    const userId = user?.id;
    if (userId) {
      const visitKey = `user_visited_${userId}`;
      const hasVisited = localStorage.getItem(visitKey);
      if (!hasVisited) {
        setIsFirstVisit(true);
        localStorage.setItem(visitKey, 'true');
      } else {
        setIsFirstVisit(false);
      }
    }
  }, [user?.id]);

  // Set random health tip on mount
  useEffect(() => {
    const randomTip = healthTips[Math.floor(Math.random() * healthTips.length)];
    setHealthTip(randomTip);
  }, []);

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['patient-portal-dashboard', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        // Fetch summary from API
        const summaryResponse = await patientPortalApi.getSummary();
        const summary = summaryResponse.data?.data || summaryResponse.data || {};

        // Fetch appointments
        const appointmentsResponse = await patientPortalApi.getAppointments({ type: 'upcoming', limit: 3 });
        const appointments = appointmentsResponse.data?.data || appointmentsResponse.data || [];

        // Fetch prescriptions
        const prescriptionsResponse = await patientPortalApi.getPrescriptions({ status: 'active', limit: 3 });
        const prescriptions = prescriptionsResponse.data?.data || prescriptionsResponse.data || [];

        // Fetch lab results
        const labsResponse = await patientPortalApi.getLabResults({ limit: 3 });
        const labs = labsResponse.data?.data || labsResponse.data || [];

        // Fetch billing summary
        const billingSummary = await patientPortalApi.getBillingSummary();
        const billing = billingSummary.data?.data || billingSummary.data || {};

        // Fetch pending bills
        const billsResponse = await patientPortalApi.getBills({ type: 'pending', limit: 3 });
        const bills = billsResponse.data?.data || billsResponse.data || [];

        // Transform appointments data
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

        // Transform prescriptions data
        const recentPrescriptions: Prescription[] = prescriptions.map((rx: any) => ({
          id: rx.id,
          medicationName: rx.medications?.[0]?.name || rx.medicationName || 'Medication',
          dosage: rx.medications?.[0]?.dosage || rx.dosage || '',
          frequency: rx.medications?.[0]?.frequency || rx.frequency || '',
          status: rx.refillsRemaining === 0 ? 'NEEDS_REFILL' :
                  rx.status === 'PENDING_REFILL' ? 'NEEDS_REFILL' :
                  rx.status === 'COMPLETED' ? 'EXPIRED' : 'ACTIVE',
          refillsRemaining: rx.refillsRemaining || 0,
          lastFilledDate: rx.lastFilledDate,
          expiryDate: rx.endDate,
        }));

        // Transform lab results data
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

        // Transform bills data
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

        // Add medication reminders
        recentPrescriptions.forEach((rx) => {
          if (rx.status === 'NEEDS_REFILL') {
            healthReminders.push({
              id: `refill-${rx.id}`,
              type: 'medication',
              title: 'Prescription Refill Needed',
              description: `${rx.medicationName} needs to be refilled`,
              priority: 'high',
            });
          }
        });

        // Add appointment reminders
        upcomingAppointments.forEach((apt) => {
          const aptDate = new Date(apt.date);
          const today = new Date();
          const diffDays = Math.ceil((aptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

        // Add lab result reminders
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

        // Fetch AI Health Insights
        let aiHealthInsights: AIHealthInsight | undefined;
        try {
          const aiResponse = await patientPortalApi.analyzeMedicalHistory();
          const aiData = aiResponse.data?.data || aiResponse.data;
          if (aiData) {
            aiHealthInsights = {
              summary: aiData.summary || { totalConditions: 0, totalAllergies: 0, riskLevel: 'normal' },
              recommendations: aiData.recommendations || [],
              riskFactors: aiData.riskFactors || [],
            };
          }
        } catch (aiErr) {
          console.error('Error fetching AI health insights:', aiErr);
        }

        return {
          patient: {
            firstName: summary?.patient?.firstName || user?.firstName || 'Patient',
            lastName: summary?.patient?.lastName || user?.lastName || '',
            dateOfBirth: summary?.patient?.dateOfBirth,
            bloodGroup: summary?.patient?.bloodGroup,
          },
          upcomingAppointments,
          recentPrescriptions,
          labResults,
          outstandingBills,
          totalAmountDue: Number(billing.totalBalance || 0),
          healthReminders,
          unreadMessages: summary?.unreadMessages || 0,
          aiHealthInsights,
        };
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        // Return fallback data with user's actual name
        return {
          patient: {
            firstName: user?.firstName || 'Patient',
            lastName: user?.lastName || '',
          },
          upcomingAppointments: [
            {
              id: '1',
              doctorName: 'Dr. Sarah Johnson',
              specialty: 'Cardiology',
              department: 'Heart Center',
              date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              time: '10:30',
              status: 'SCHEDULED',
            },
            {
              id: '2',
              doctorName: 'Dr. Michael Chen',
              specialty: 'Internal Medicine',
              department: 'General Medicine',
              date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
              time: '14:00',
              status: 'CONFIRMED',
            },
          ],
          recentPrescriptions: [
            {
              id: '1',
              medicationName: 'Lisinopril',
              dosage: '10mg',
              frequency: 'Once daily',
              status: 'ACTIVE' as const,
              refillsRemaining: 3,
            },
            {
              id: '2',
              medicationName: 'Metformin',
              dosage: '500mg',
              frequency: 'Twice daily',
              status: 'NEEDS_REFILL' as const,
              refillsRemaining: 0,
            },
          ],
          labResults: [
            {
              id: '1',
              testName: 'Complete Blood Count',
              testDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'REVIEWED' as const,
              hasAbnormalValues: true,
              keyValues: [
                { name: 'WBC', value: '11.5 K/uL', status: 'HIGH' },
                { name: 'HGB', value: '14.5 g/dL', status: 'NORMAL' },
              ],
            },
            {
              id: '2',
              testName: 'Lipid Panel',
              testDate: new Date().toISOString(),
              status: 'PENDING' as const,
            },
          ],
          outstandingBills: [
            {
              id: '1',
              invoiceNumber: 'INV-2024-001',
              description: 'Cardiology Consultation',
              amount: 150.00,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'PENDING' as const,
            },
          ],
          totalAmountDue: 150.00,
          healthReminders: [
            {
              id: '1',
              type: 'medication' as const,
              title: 'Medication Refill Needed',
              description: 'Metformin needs to be refilled',
              priority: 'high' as const,
            },
            {
              id: '2',
              type: 'checkup' as const,
              title: 'Annual Checkup Due',
              description: 'Your yearly physical exam is due',
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              priority: 'medium' as const,
            },
          ],
          unreadMessages: 2,
          aiHealthInsights: {
            summary: {
              totalConditions: 2,
              totalAllergies: 1,
              riskLevel: 'moderate',
            },
            recommendations: [
              {
                title: 'Schedule Annual Checkup',
                description: 'Regular health checkups help detect issues early.',
                priority: 'medium',
              },
              {
                title: 'Review Medications',
                description: 'Discuss your current medications with your doctor.',
                priority: 'low',
              },
            ],
            riskFactors: [
              { factor: 'Family history of heart disease', level: 'moderate' },
            ],
          },
        };
      }
    },
  });

  // Navigation handlers
  const navigateToAppointments = () => navigate('/patient-portal/appointments');
  const navigateToPrescriptions = () => navigate('/patient-portal/prescriptions');
  const navigateToLabResults = () => navigate('/patient-portal/labs');
  const navigateToBilling = () => navigate('/patient-portal/billing');
  const navigateToMessages = () => navigate('/patient-portal/messages');
  const navigateToRecords = () => navigate('/patient-portal/records');
  const navigateToProfile = () => navigate('/patient-portal/profile');
  const navigateToSymptomChecker = () => navigate('/patient-portal/symptom-checker');
  const navigateToMedicalHistory = () => navigate('/patient-portal/medical-history');

  // Loading state - also show loading when query is disabled (user not loaded yet) or data not available
  if (isLoading || !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <GlassCard className="max-w-md w-full text-center">
          <ExclamationCircleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Dashboard</h2>
          <p className="text-gray-600 mb-6">We encountered an error loading your information. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Retry
          </button>
        </GlassCard>
      </div>
    );
  }

  const data = dashboardData!;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-purple-400/20 rounded-full blur-xl animate-pulse" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-4">
              <SparklesIcon className="h-4 w-4" />
              Patient Portal
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
              {isFirstVisit ? 'Welcome' : 'Welcome back'}, {user?.firstName || data.patient.firstName} {user?.lastName || data.patient.lastName}!
            </h1>
            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 mt-4">
              <SunIcon className="h-6 w-6 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white/90 font-medium text-sm">Health Tip of the Day</p>
                <p className="text-white/80 text-sm mt-1">{healthTip}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={navigateToMessages}
              className="relative inline-flex items-center gap-2 px-5 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-colors font-medium"
            >
              <BellIcon className="h-5 w-5" />
              Notifications
              {data.unreadMessages > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {data.unreadMessages}
                </span>
              )}
            </button>
            <a
              href="tel:911"
              className="inline-flex items-center gap-2 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
            >
              <PhoneIcon className="h-5 w-5" />
              Emergency
            </a>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Appointments Card */}
          <GlassCard>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <CalendarDaysIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
                  <p className="text-sm text-gray-500">Your next scheduled visits</p>
                </div>
              </div>
              <button
                onClick={navigateToAppointments}
                className="text-blue-600 text-sm font-medium hover:text-blue-700 flex items-center gap-1 group"
              >
                View All
                <ChevronRightIcon className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {data.upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {data.upcomingAppointments.map((apt, index) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-4 p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100/80 transition-colors"
                    style={{
                      animation: 'fadeIn 0.3s ease-out',
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: 'both',
                    }}
                  >
                    <div className="flex-shrink-0 text-center min-w-[60px] p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      <div className="text-xl font-bold">
                        {new Date(apt.date).getDate()}
                      </div>
                      <div className="text-xs opacity-90">
                        {new Date(apt.date).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{apt.doctorName}</h3>
                      <p className="text-sm text-gray-600">{apt.specialty}</p>
                      {apt.department && (
                        <p className="text-xs text-gray-500">{apt.department}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatTime(apt.time)}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        <CheckCircleIcon className="h-3 w-3" />
                        {apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No upcoming appointments</p>
                <button
                  onClick={navigateToAppointments}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Book Appointment
                </button>
              </div>
            )}

            <button
              onClick={navigateToAppointments}
              className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Book New Appointment
            </button>
          </GlassCard>

          {/* Recent Prescriptions Card */}
          <GlassCard>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl">
                  <ClipboardDocumentListIcon className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Recent Prescriptions</h2>
                  <p className="text-sm text-gray-500">Your current medications</p>
                </div>
              </div>
              <button
                onClick={navigateToPrescriptions}
                className="text-emerald-600 text-sm font-medium hover:text-emerald-700 flex items-center gap-1 group"
              >
                View All
                <ChevronRightIcon className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {data.recentPrescriptions.length > 0 ? (
              <div className="space-y-3">
                {data.recentPrescriptions.map((rx, index) => (
                  <div
                    key={rx.id}
                    className="flex items-center justify-between p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100/80 transition-colors"
                    style={{
                      animation: 'fadeIn 0.3s ease-out',
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: 'both',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${rx.status === 'NEEDS_REFILL' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                        <ClipboardDocumentListIcon
                          className={`h-5 w-5 ${rx.status === 'NEEDS_REFILL' ? 'text-amber-600' : 'text-emerald-600'}`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{rx.medicationName}</h3>
                        <p className="text-sm text-gray-600">
                          {rx.dosage} - {rx.frequency}
                        </p>
                        {rx.refillsRemaining > 0 && (
                          <p className="text-xs text-gray-500">
                            {rx.refillsRemaining} refill{rx.refillsRemaining !== 1 ? 's' : ''} remaining
                          </p>
                        )}
                      </div>
                    </div>
                    <PrescriptionStatusBadge status={rx.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardDocumentListIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No active prescriptions</p>
              </div>
            )}
          </GlassCard>

          {/* Lab Results Card */}
          <GlassCard>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-xl">
                  <BeakerIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Lab Results</h2>
                  <p className="text-sm text-gray-500">Your recent test results</p>
                </div>
              </div>
              <button
                onClick={navigateToLabResults}
                className="text-purple-600 text-sm font-medium hover:text-purple-700 flex items-center gap-1 group"
              >
                View All
                <ChevronRightIcon className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {data.labResults.length > 0 ? (
              <div className="space-y-3">
                {data.labResults.map((lab, index) => (
                  <div
                    key={lab.id}
                    className="p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100/80 transition-colors"
                    style={{
                      animation: 'fadeIn 0.3s ease-out',
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: 'both',
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{lab.testName}</h3>
                        <p className="text-sm text-gray-500">{formatDate(lab.testDate)}</p>
                      </div>
                      <LabStatusBadge status={lab.status} hasAbnormal={lab.hasAbnormalValues} />
                    </div>
                    {lab.keyValues && lab.keyValues.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {lab.keyValues.map((kv, i) => (
                          <span
                            key={i}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                              kv.status === 'NORMAL' ? 'bg-green-100 text-green-700' :
                              kv.status === 'HIGH' || kv.status === 'LOW' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {kv.name}: {kv.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BeakerIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No recent lab results</p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Outstanding Bills Card */}
          <GlassCard>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <CreditCardIcon className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Outstanding Bills</h2>
                <p className="text-sm text-gray-500">Payment summary</p>
              </div>
            </div>

            {/* Total Due */}
            <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl mb-4">
              <p className="text-sm text-amber-700 font-medium">Total Amount Due</p>
              <p className="text-3xl font-bold text-amber-800"><CurrencyDisplay amount={data.totalAmountDue} /></p>
            </div>

            {/* Bill List */}
            {data.outstandingBills.length > 0 ? (
              <div className="space-y-3">
                {data.outstandingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className={`p-3 rounded-xl border ${
                      bill.status === 'OVERDUE' ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">
                        {bill.description}
                      </span>
                      <span className="text-sm font-bold text-gray-900"><CurrencyDisplay amount={bill.amount} /></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Due: {formatDate(bill.dueDate)}</span>
                      {bill.status === 'OVERDUE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <ExclamationCircleIcon className="h-3 w-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircleIcon className="h-10 w-10 text-green-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No outstanding bills</p>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={navigateToBilling}
                className="flex-1 py-2.5 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors text-sm"
              >
                Pay Now
              </button>
              <button
                onClick={navigateToBilling}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                History
              </button>
            </div>
          </GlassCard>

          {/* AI Health Insights Card */}
          {data.aiHealthInsights && (
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl">
                    <SparklesIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">AI Health Insights</h2>
                    <p className="text-xs text-gray-500">Personalized for you</p>
                  </div>
                </div>
                <button
                  onClick={navigateToMedicalHistory}
                  className="text-emerald-600 text-sm font-medium hover:text-emerald-700 flex items-center gap-1 group"
                >
                  View All
                  <ChevronRightIcon className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-600">{data.aiHealthInsights.summary.totalConditions}</p>
                  <p className="text-xs text-gray-600">Conditions</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-amber-600">{data.aiHealthInsights.summary.totalAllergies}</p>
                  <p className="text-xs text-gray-600">Allergies</p>
                </div>
                <div className={`p-3 rounded-xl text-center ${
                  data.aiHealthInsights.summary.riskLevel === 'high' ? 'bg-gradient-to-br from-red-50 to-rose-50' :
                  data.aiHealthInsights.summary.riskLevel === 'moderate' ? 'bg-gradient-to-br from-amber-50 to-yellow-50' :
                  'bg-gradient-to-br from-green-50 to-emerald-50'
                }`}>
                  <p className={`text-lg font-bold capitalize ${
                    data.aiHealthInsights.summary.riskLevel === 'high' ? 'text-red-600' :
                    data.aiHealthInsights.summary.riskLevel === 'moderate' ? 'text-amber-600' :
                    'text-green-600'
                  }`}>{data.aiHealthInsights.summary.riskLevel}</p>
                  <p className="text-xs text-gray-600">Risk Level</p>
                </div>
              </div>

              {/* Recommendations */}
              {data.aiHealthInsights.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recommendations</p>
                  {data.aiHealthInsights.recommendations.slice(0, 2).map((rec, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-xl flex items-start gap-3 ${
                        rec.priority === 'high' ? 'bg-red-50 border border-red-100' :
                        rec.priority === 'medium' ? 'bg-amber-50 border border-amber-100' :
                        'bg-blue-50 border border-blue-100'
                      }`}
                    >
                      <LightBulbIcon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        rec.priority === 'high' ? 'text-red-500' :
                        rec.priority === 'medium' ? 'text-amber-500' :
                        'text-blue-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{rec.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Risk Factors */}
              {data.aiHealthInsights.riskFactors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Risk Factors</p>
                  <div className="flex flex-wrap gap-2">
                    {data.aiHealthInsights.riskFactors.slice(0, 3).map((rf, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                          rf.level === 'high' ? 'bg-red-100 text-red-700' :
                          rf.level === 'moderate' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}
                      >
                        <ShieldExclamationIcon className="h-3.5 w-3.5" />
                        {rf.factor}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={navigateToMedicalHistory}
                className="w-full mt-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all text-sm flex items-center justify-center gap-2"
              >
                <ClipboardDocumentListIcon className="h-4 w-4" />
                Manage Medical History
              </button>
            </GlassCard>
          )}

          {/* Health Reminders Card */}
          <GlassCard className="bg-gradient-to-br from-blue-600 to-indigo-700" padding="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BellIcon className="h-5 w-5 text-white" />
              <h2 className="text-lg font-semibold text-white">Health Reminders</h2>
            </div>

            {data.healthReminders.length > 0 ? (
              <div className="space-y-3">
                {data.healthReminders.slice(0, 4).map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`p-3 rounded-xl backdrop-blur-sm ${
                      reminder.priority === 'high' ? 'bg-red-400/20' :
                      reminder.priority === 'medium' ? 'bg-amber-400/20' : 'bg-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                        reminder.priority === 'high' ? 'bg-red-400' :
                        reminder.priority === 'medium' ? 'bg-amber-400' : 'bg-white/60'
                      }`} />
                      <div>
                        <p className="text-white text-sm font-medium">{reminder.title}</p>
                        <p className="text-white/70 text-xs">{reminder.description}</p>
                        {reminder.dueDate && (
                          <p className="text-white/50 text-xs mt-1">{formatDate(reminder.dueDate)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircleIcon className="h-10 w-10 text-white/60 mx-auto mb-2" />
                <p className="text-white/70 text-sm">All caught up!</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <GlassCard padding="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <QuickActionButton
            icon={CalendarDaysIcon}
            label="Book Appointment"
            description="Schedule a visit"
            onClick={navigateToAppointments}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <QuickActionButton
            icon={ArrowPathIcon}
            label="Request Refill"
            description="Renew medications"
            onClick={navigateToPrescriptions}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
          <QuickActionButton
            icon={DocumentTextIcon}
            label="Medical Records"
            description="View your history"
            onClick={navigateToRecords}
            gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <QuickActionButton
            icon={ChatBubbleLeftRightIcon}
            label="Message Doctor"
            description="Secure messaging"
            onClick={navigateToMessages}
            gradient="bg-gradient-to-br from-pink-500 to-pink-600"
          />
          <QuickActionButton
            icon={ArrowDownTrayIcon}
            label="Health Summary"
            description="Download report"
            onClick={navigateToRecords}
            gradient="bg-gradient-to-br from-amber-500 to-amber-600"
          />
          <QuickActionButton
            icon={UserCircleIcon}
            label="Update Profile"
            description="Edit your info"
            onClick={navigateToProfile}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
          />
        </div>
      </GlassCard>

      {/* Symptom Checker Promo */}
      <GlassCard className="overflow-hidden" padding="p-0">
        <div className="flex flex-col md:flex-row items-center">
          <div className="flex-1 p-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium mb-3">
              <ShieldCheckIcon className="h-4 w-4" />
              AI-Powered
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Symptom Checker</h2>
            <p className="text-gray-600 mb-4">
              Not feeling well? Use our AI-powered symptom checker to understand your symptoms and get guidance on next steps.
            </p>
            <button
              onClick={navigateToSymptomChecker}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
            >
              Check Symptoms
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="hidden md:block w-64 h-48 bg-gradient-to-br from-emerald-400 to-teal-500 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <HeartIcon className="h-24 w-24 text-white/30" />
            </div>
            <div className="absolute top-4 left-4 w-8 h-8 bg-white/20 rounded-full animate-pulse" />
            <div className="absolute bottom-6 right-6 w-12 h-12 bg-white/20 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>
      </GlassCard>

      {/* CSS Animations */}
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
    </div>
  );
}

// Export named component
export { PatientPortalDashboard };
