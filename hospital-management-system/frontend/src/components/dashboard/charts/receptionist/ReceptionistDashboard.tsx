import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  MegaphoneIcon,
  UserPlusIcon,
  PhoneIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { PatientIcon, CalendarBillingIcon, HeartbeatIcon, MedicalShieldIcon, NotificationBellIcon } from '../../../icons/HMSIcons';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useReceptionistDashboard } from '../../../../hooks/useReceptionistDashboard';
import KPICard from '../shared/KPICard';
import ChartCard from '../ChartCard';
import { doughnutChartOptions, barChartOptions, chartColors } from '../chartSetup';

export default function ReceptionistDashboard() {
  const {
    opdStats,
    queueDisplay,
    opdQueue,
    todayAppointments,
    isLoading,
    refetchAll,
  } = useReceptionistDashboard();

  // Calculate stats
  const waiting = opdStats?.waiting || opdQueue?.filter((q: any) => q.status === 'CHECKED_IN' || q.status === 'WAITING').length || 0;
  const inProgress = opdStats?.inProgress || opdQueue?.filter((q: any) => q.status === 'IN_PROGRESS').length || 0;
  const completed = opdStats?.completed || 0;
  const noShow = opdStats?.noShow || 0;
  const total = opdStats?.totalAppointments || todayAppointments?.appointments?.length || 0;

  const noShowRate = total > 0 ? ((noShow / total) * 100).toFixed(1) : '0';

  // Check-in status donut data
  const checkInData = {
    labels: ['Checked In', 'Pending', 'No Show'],
    datasets: [{
      data: [
        opdStats?.checkedIn || waiting + inProgress + completed,
        total - (opdStats?.checkedIn || waiting + inProgress + completed + noShow) - noShow,
        noShow,
      ],
      backgroundColor: [
        chartColors.success.main,
        chartColors.warning.main,
        chartColors.danger.main,
      ],
      borderWidth: 0,
    }],
  };

  // Hourly distribution (simulated from appointments)
  const hourlyData = (() => {
    const hours: Record<string, number> = {};
    for (let i = 8; i <= 17; i++) {
      hours[`${i}:00`] = 0;
    }

    todayAppointments?.appointments?.forEach((apt: any) => {
      const hour = apt.startTime?.split(':')[0];
      if (hour && hours[`${hour}:00`] !== undefined) {
        hours[`${hour}:00`]++;
      }
    });

    return {
      labels: Object.keys(hours),
      datasets: [{
        label: 'Appointments',
        data: Object.values(hours),
        backgroundColor: chartColors.primary.main,
        borderRadius: 6,
      }],
    };
  })();

  // Find next patients to call
  const nextInQueue = opdQueue?.filter((q: any) =>
    q.status === 'CHECKED_IN' || q.status === 'WAITING'
  ).slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Waiting"
          value={waiting}
          icon={HeartbeatIcon}
          color="amber"
          subtitle="In queue"
          isLoading={isLoading}
        />
        <KPICard
          title="In Progress"
          value={inProgress}
          icon={PatientIcon}
          color="blue"
          subtitle="Being served"
          isLoading={isLoading}
        />
        <KPICard
          title="Completed"
          value={completed}
          icon={MedicalShieldIcon}
          color="emerald"
          subtitle="Today's visits"
          isLoading={isLoading}
        />
        <KPICard
          title="No-Show Rate"
          value={`${noShowRate}%`}
          icon={NotificationBellIcon}
          color="red"
          subtitle={`${noShow} patients`}
          isLoading={isLoading}
        />
      </div>

      {/* Queue Status Display */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Queue Status Board</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm">Live</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {queueDisplay?.currentlyServing?.slice(0, 4).map((item: any) => (
            <div key={item.doctorId} className="bg-white/10 rounded-xl p-4">
              <p className="text-blue-200 text-sm mb-1">
                Dr. {item.doctorName?.split(' ')[1] || item.doctorName}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {item.currentToken || '-'}
                </span>
                <span className="text-blue-200 text-sm">current</span>
              </div>
              <p className="text-sm text-blue-200 mt-1">
                {item.waitingCount || 0} waiting
              </p>
            </div>
          ))}

          {(!queueDisplay?.currentlyServing || queueDisplay.currentlyServing.length === 0) && (
            <div className="col-span-4 text-center py-8">
              <p className="text-blue-200">No active queues at the moment</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Check-in Rate Donut */}
        <ChartCard
          title="Check-in Status"
          subtitle="Today's appointments"
          isLoading={isLoading}
          height="h-64"
        >
          <Doughnut data={checkInData} options={doughnutChartOptions} />
        </ChartCard>

        {/* Hourly Distribution */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Appointment Distribution"
            subtitle="By hour today"
            isLoading={!todayAppointments}
          >
            <Bar data={hourlyData} options={barChartOptions} />
          </ChartCard>
        </div>
      </div>

      {/* Queue Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next in Queue */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Next in Queue</h3>
            <Link
              to="/opd"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              Manage queue <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {nextInQueue.map((patient: any, idx: number) => (
              <div
                key={patient.id}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  idx === 0 ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    idx === 0 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    <span className="font-bold">{patient.tokenNumber}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {patient.patient?.firstName} {patient.patient?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Dr. {patient.doctor?.user?.firstName} {patient.doctor?.user?.lastName}
                    </p>
                  </div>
                </div>
                {idx === 0 && (
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium">
                    <MegaphoneIcon className="h-4 w-4" />
                    Call
                  </button>
                )}
              </div>
            ))}

            {nextInQueue.length === 0 && (
              <div className="text-center py-8">
                <MedicalShieldIcon className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-500">No patients waiting in queue</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h3>
            <Link
              to="/appointments"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {todayAppointments?.appointments
              ?.filter((apt: any) => apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED')
              .slice(0, 6)
              .map((apt: any) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[50px]">
                      <p className="text-sm font-bold text-gray-900">{apt.startTime}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {apt.patient?.firstName} {apt.patient?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Dr. {apt.doctor?.user?.firstName} • {apt.type}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/opd/check-in/${apt.id}`}
                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium"
                  >
                    Check In
                  </Link>
                </div>
              ))}

            {(!todayAppointments?.appointments ||
              todayAppointments.appointments.filter((apt: any) =>
                apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED'
              ).length === 0) && (
              <div className="text-center py-8">
                <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming appointments</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/opd/check-in"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-emerald-500 group-hover:scale-110 transition-transform">
            <MedicalShieldIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Check In Patient</p>
            <p className="text-xs text-gray-500">Walk-in or appointment</p>
          </div>
        </Link>
        <Link
          to="/appointments?action=new"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <CalendarDaysIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Book Appointment</p>
            <p className="text-xs text-gray-500">Schedule new visit</p>
          </div>
        </Link>
        <Link
          to="/patients?action=new"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-purple-500 group-hover:scale-110 transition-transform">
            <UserPlusIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Register Patient</p>
            <p className="text-xs text-gray-500">New patient</p>
          </div>
        </Link>
        <Link
          to="/opd/call"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-amber-500 group-hover:scale-110 transition-transform">
            <PhoneIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Call Next</p>
            <p className="text-xs text-gray-500">Announce patient</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
