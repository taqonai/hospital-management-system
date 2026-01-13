import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import {
  CalendarDaysIcon,
  DocumentTextIcon,
  BeakerIcon,
  ChatBubbleLeftRightIcon,
  CreditCardIcon,
  HeartIcon,
  ClipboardDocumentListIcon,
  UserCircleIcon,
  BellIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import PatientPortalDashboard from './Dashboard';
import AppointmentsList from './components/AppointmentsList';
import MedicalRecords from './components/MedicalRecords';
import Prescriptions from './components/Prescriptions';
import LabResults from './components/LabResults';
import Messages from './components/Messages';
import BillingOverview from './components/BillingOverview';

type PortalSection =
  | 'dashboard'
  | 'appointments'
  | 'records'
  | 'prescriptions'
  | 'labs'
  | 'messages'
  | 'billing';

export default function PatientPortal() {
  const [activeSection, setActiveSection] = useState<PortalSection>('dashboard');
  const user = useSelector((state: any) => state.auth.user);

  // Fetch patient summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ['patient-portal-summary'],
    queryFn: async () => {
      const response = await patientPortalApi.getSummary();
      return response.data?.data || response.data;
    },
  });

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: HeartIcon },
    { id: 'appointments', name: 'Appointments', icon: CalendarDaysIcon, count: summary?.upcomingAppointments || 0 },
    { id: 'records', name: 'Medical Records', icon: DocumentTextIcon },
    { id: 'prescriptions', name: 'Prescriptions', icon: ClipboardDocumentListIcon, count: summary?.activePrescriptions || 0 },
    { id: 'labs', name: 'Lab Results', icon: BeakerIcon, count: summary?.pendingLabs || 0 },
    { id: 'messages', name: 'Messages', icon: ChatBubbleLeftRightIcon, count: summary?.unreadMessages || 0 },
    { id: 'billing', name: 'Billing', icon: CreditCardIcon, count: summary?.pendingBills || 0 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-white/80 backdrop-blur-xl border-r border-white/20 shadow-lg">
          {/* User Profile Section */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <UserCircleIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</h2>
                <p className="text-sm text-gray-500">Patient Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as PortalSection)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeSection === item.id
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <item.icon className={`w-5 h-5 mr-3 ${activeSection === item.id ? 'text-white' : 'text-gray-400'}`} />
                  {item.name}
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeSection === item.id
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Quick Actions */}
          <div className="p-4 mt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
            <button className="w-full px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all">
              Book Appointment
            </button>
            <button className="w-full mt-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all">
              Contact Support
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {activeSection === 'dashboard' && <PatientPortalDashboard />}
          {activeSection === 'appointments' && <AppointmentsList />}
          {activeSection === 'records' && <MedicalRecords />}
          {activeSection === 'prescriptions' && <Prescriptions />}
          {activeSection === 'labs' && <LabResults />}
          {activeSection === 'messages' && <Messages />}
          {activeSection === 'billing' && <BillingOverview />}
        </main>
      </div>
    </div>
  );
}

// Dashboard View Component
function DashboardView({ summary, isLoading, setActiveSection }: { summary: any; isLoading: boolean; setActiveSection: (s: PortalSection) => void }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back!</h1>
          <p className="text-gray-500 mt-1">Here's an overview of your health information</p>
        </div>
        <button className="p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all relative">
          <BellIcon className="w-6 h-6 text-gray-600" />
          {(summary?.unreadMessages || 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {summary.unreadMessages}
            </span>
          )}
        </button>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStatCard
          title="Next Appointment"
          value={summary?.nextAppointment ? formatDate(summary.nextAppointment.date) : 'None scheduled'}
          subtitle={summary?.nextAppointment?.doctorName || ''}
          icon={CalendarDaysIcon}
          color="blue"
          onClick={() => setActiveSection('appointments')}
        />
        <QuickStatCard
          title="Active Medications"
          value={summary?.activePrescriptions || 0}
          subtitle="prescriptions"
          icon={ClipboardDocumentListIcon}
          color="emerald"
          onClick={() => setActiveSection('prescriptions')}
        />
        <QuickStatCard
          title="Pending Lab Results"
          value={summary?.pendingLabs || 0}
          subtitle="awaiting results"
          icon={BeakerIcon}
          color="purple"
          onClick={() => setActiveSection('labs')}
        />
        <QuickStatCard
          title="Outstanding Balance"
          value={formatCurrency(summary?.outstandingBalance)}
          subtitle="pending payment"
          icon={CreditCardIcon}
          color="amber"
          onClick={() => setActiveSection('billing')}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
            <button
              onClick={() => setActiveSection('appointments')}
              className="text-blue-600 text-sm font-medium hover:text-blue-700 flex items-center"
            >
              View All <ChevronRightIcon className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="space-y-3">
            {summary?.upcomingAppointmentsList?.length > 0 ? (
              summary.upcomingAppointmentsList.slice(0, 3).map((apt: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{apt.doctorName}</p>
                      <p className="text-sm text-gray-500">{apt.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatDate(apt.date)}</p>
                    <p className="text-sm text-gray-500">{apt.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CalendarDaysIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No upcoming appointments</p>
                <button className="mt-2 text-blue-600 font-medium text-sm">Book an appointment</button>
              </div>
            )}
          </div>
        </div>

        {/* Health Reminders */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
            Health Reminders
          </h2>
          <div className="space-y-3">
            {summary?.reminders?.length > 0 ? (
              summary.reminders.map((reminder: string, idx: number) => (
                <div key={idx} className="flex items-start space-x-2">
                  <span className="w-2 h-2 mt-2 bg-white rounded-full flex-shrink-0"></span>
                  <p className="text-sm text-white/90">{reminder}</p>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-start space-x-2">
                  <span className="w-2 h-2 mt-2 bg-white rounded-full flex-shrink-0"></span>
                  <p className="text-sm text-white/90">Stay up to date with your annual checkup</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-2 h-2 mt-2 bg-white rounded-full flex-shrink-0"></span>
                  <p className="text-sm text-white/90">Review your medication refills</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-2 h-2 mt-2 bg-white rounded-full flex-shrink-0"></span>
                  <p className="text-sm text-white/90">Check pending lab results</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {summary?.recentActivity?.length > 0 ? (
            summary.recentActivity.slice(0, 5).map((activity: any, idx: number) => (
              <div key={idx} className="flex items-center space-x-4 text-sm">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <ClockIcon className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-900">{activity.description}</p>
                  <p className="text-gray-500">{activity.date}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick Stat Card Component
function QuickStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  onClick
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  color: string;
  onClick: () => void;
}) {
  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-600' },
  };

  const classes = colorClasses[color] || colorClasses.blue;

  return (
    <button
      onClick={onClick}
      className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-5 text-left hover:shadow-xl transition-all w-full"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${classes.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${classes.icon}`} />
        </div>
        <ChevronRightIcon className="w-5 h-5 text-gray-300" />
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-bold ${classes.text} mt-1`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </button>
  );
}

// Helper function
function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export { default as SymptomChecker } from './SymptomChecker';
export { default as Dashboard } from './Dashboard';
