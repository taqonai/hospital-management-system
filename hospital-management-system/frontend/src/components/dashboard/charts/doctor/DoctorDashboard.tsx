import { Link } from 'react-router-dom';
import {
  ClockIcon,
  PlayIcon,
  ArrowRightIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import {
  CalendarBillingIcon,
  PatientIcon,
  StethoscopeAIIcon,
} from '../../../icons/HMSIcons';
import { useDoctorDashboard } from '../../../../hooks/useDoctorDashboard';
import { useAuth } from '../../../../hooks/useAuth';
import KPICard from '../shared/KPICard';
import ChartCard from '../ChartCard';
import AppointmentTrendsChart from '../shared/AppointmentTrendsChart';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const doctorId = (user as any)?.doctorId;

  const {
    stats,
    todayAppointments,
    currentQueue,
    weeklyAppointments,
    isLoading,
    refetchAll,
  } = useDoctorDashboard(doctorId);

  // Process weekly data for chart
  const weeklyChartData = (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts: Record<string, number> = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      counts[dayName] = 0;
    }

    // Count appointments per day
    weeklyAppointments?.forEach((apt: any) => {
      const date = new Date(apt.appointmentDate);
      const dayName = days[date.getDay()];
      if (counts[dayName] !== undefined) {
        counts[dayName]++;
      }
    });

    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  })();

  // Filter queue to show waiting patients (checked in and ready for consultation)
  const waitingPatients = currentQueue?.filter((q: any) =>
    q.status === 'CHECKED_IN'
  ) || [];

  const inProgressPatient = currentQueue?.find((q: any) =>
    q.status === 'IN_PROGRESS'
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Today's Appointments"
          value={stats?.todayAppointments || todayAppointments?.appointments?.length || 0}
          icon={CalendarBillingIcon}
          color="blue"
          subtitle={`${stats?.completedToday || 0} completed`}
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Consultations"
          value={stats?.pendingConsultations || waitingPatients.length}
          icon={ClockIcon}
          color="amber"
          subtitle="Waiting in queue"
          isLoading={isLoading}
        />
        <KPICard
          title="Monthly Consultations"
          value={stats?.monthlyAppointments || 0}
          icon={StethoscopeAIIcon}
          color="purple"
          subtitle="This month"
          isLoading={isLoading}
        />
        <KPICard
          title="Total Patients"
          value={stats?.totalPatients || 0}
          icon={PatientIcon}
          color="emerald"
          subtitle="All time"
          isLoading={isLoading}
        />
      </div>

      {/* Current Patient Alert */}
      {inProgressPatient && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500">
                <PlayIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">Currently Consulting</p>
                <p className="text-sm text-blue-700">
                  {inProgressPatient.patient?.firstName || 'Unknown'} {inProgressPatient.patient?.lastName || 'Patient'} -
                  Token #{inProgressPatient.tokenNumber || 'N/A'}
                </p>
              </div>
            </div>
            <Link
              to={`/consultation/${inProgressPatient.id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Continue Consultation
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend Chart */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Weekly Appointments"
            subtitle="Last 7 days"
            isLoading={!weeklyAppointments}
          >
            <AppointmentTrendsChart
              data={weeklyChartData}
              primaryLabel="Appointments"
            />
          </ChartCard>
        </div>

        {/* Current Queue */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Patient Queue</h3>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
                {waitingPatients.length} waiting
              </span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {waitingPatients.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircleIcon className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-gray-500">No patients waiting</p>
                </div>
              ) : (
                waitingPatients.slice(0, 6).map((patient: any, idx: number) => (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">
                          {patient.tokenNumber || idx + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {patient.patient?.firstName || 'Unknown'} {patient.patient?.lastName || 'Patient'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {patient.startTime || 'N/A'} - {patient.type || 'General'}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/consultation/${patient.id}`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </div>
                ))
              )}
            </div>

            {waitingPatients.length > 6 && (
              <Link
                to="/opd"
                className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all {waitingPatients.length} patients
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Today's Schedule</h3>
          <Link
            to="/appointments"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Time</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Patient</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {todayAppointments?.appointments?.slice(0, 8).map((apt: any) => (
                <tr key={apt.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">{apt.startTime}</td>
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-gray-900">
                      {apt.patient?.firstName || 'Unknown'} {apt.patient?.lastName || 'Patient'}
                    </p>
                    <p className="text-xs text-gray-500">{apt.patient?.mrn || 'No MRN'}</p>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{apt.type}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      apt.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                      apt.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' :
                      apt.status === 'CHECKED_IN' ? 'bg-amber-50 text-amber-700' :
                      apt.status === 'CANCELLED' ? 'bg-red-50 text-red-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {apt.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {(apt.status === 'CHECKED_IN' || apt.status === 'IN_PROGRESS') && (
                      <Link
                        to={`/consultation/${apt.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {apt.status === 'IN_PROGRESS' ? 'Continue' : 'Start'}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!todayAppointments?.appointments || todayAppointments.appointments.length === 0) && (
            <div className="text-center py-8">
              <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No appointments scheduled for today</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/opd"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <PlayIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Start Consultation</p>
            <p className="text-xs text-gray-500">Call next patient</p>
          </div>
        </Link>
        <Link
          to="/patients"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-purple-500 group-hover:scale-110 transition-transform">
            <UserGroupIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Patient Records</p>
            <p className="text-xs text-gray-500">View history</p>
          </div>
        </Link>
        <Link
          to="/ai-assistant"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 group-hover:scale-110 transition-transform">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">AI Assistant</p>
            <p className="text-xs text-gray-500">Diagnosis support</p>
          </div>
        </Link>
        <Link
          to="/telemedicine"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-cyan-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-cyan-500 group-hover:scale-110 transition-transform">
            <ClipboardDocumentListIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Telemedicine</p>
            <p className="text-xs text-gray-500">Virtual consults</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
