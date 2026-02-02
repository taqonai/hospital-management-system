import { Link, useNavigate } from 'react-router-dom';
import { ClockIcon, ArrowRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  CalendarBillingIcon,
  HospitalBedIcon,
  HeartbeatIcon,
  PatientIcon,
} from '../../../icons/HMSIcons';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useAdminDashboard } from '../../../../hooks/useAdminDashboard';
import ChartSkeleton from '../ChartSkeleton';
import { barChartOptions, pieChartOptions, weeklyActivityColors, chartColorPalette } from '../chartSetup';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    executiveSummary,
    departmentPerformance,
    bedOccupancy,
    todayStats,
    weeklyActivity,
    todayAppointments,
    isLoading,
    errors,
    refetchAll,
  } = useAdminDashboard();

  // ── KPI Data ──────────────────────────────────────────────────────
  const totalPatients = executiveSummary?.patients?.total ?? 0;
  const patientsTrend = executiveSummary?.patients?.trend ?? 0;
  const appointmentsToday = todayStats?.today?.total ?? executiveSummary?.appointments?.todayTotal ?? 0;
  const appointmentsTrend = executiveSummary?.appointments?.trend ?? 0;
  const availableBeds = bedOccupancy?.available ?? executiveSummary?.bedOccupancy?.available ?? 0;
  const bedsTrend = executiveSummary?.bedOccupancy?.trend ?? 0;
  const activeDoctors = executiveSummary?.staff?.activeDoctors ?? 0;
  const doctorsTrend = executiveSummary?.staff?.trend ?? 0;

  const kpiCards = [
    {
      title: 'Total Patients',
      value: totalPatients.toLocaleString(),
      trend: patientsTrend,
      icon: PatientIcon,
      iconBg: 'bg-blue-500',
    },
    {
      title: 'Appointments Today',
      value: appointmentsToday.toLocaleString(),
      trend: appointmentsTrend,
      icon: CalendarBillingIcon,
      iconBg: 'bg-emerald-500',
    },
    {
      title: 'Available Beds',
      value: availableBeds.toLocaleString(),
      trend: bedsTrend,
      icon: HospitalBedIcon,
      iconBg: 'bg-purple-500',
    },
    {
      title: 'Active Doctors',
      value: activeDoctors.toLocaleString(),
      trend: doctorsTrend,
      icon: HeartbeatIcon,
      iconBg: 'bg-orange-500',
    },
  ];

  // ── Weekly Activity Bar Chart ─────────────────────────────────────
  const getWeeklyActivityData = () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (weeklyActivity?.trends && Array.isArray(weeklyActivity.trends)) {
      const labels = weeklyActivity.trends.map((t: any) => {
        if (t.period) {
          const date = new Date(t.period);
          return dayNames[date.getDay()];
        }
        return t.day || t.label || '';
      });

      return {
        labels: labels.length > 0 ? labels : dayNames.slice(1).concat(dayNames[0]),
        datasets: [
          {
            label: 'Appointments',
            data: weeklyActivity.trends.map((t: any) => t.total || t.appointments || t.count || 0),
            backgroundColor: weeklyActivityColors.appointments,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          },
          {
            label: 'Completed',
            data: weeklyActivity.trends.map((t: any) => t.completed || 0),
            backgroundColor: weeklyActivityColors.completed,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          },
        ],
      };
    }

    if (weeklyActivity?.trends && typeof weeklyActivity.trends === 'object') {
      const entries = Object.entries(weeklyActivity.trends);
      const last7 = entries.slice(-7);

      return {
        labels: last7.map(([date]) => {
          const d = new Date(date);
          return dayNames[d.getDay()];
        }),
        datasets: [
          {
            label: 'Appointments',
            data: last7.map(([, data]: [string, any]) => data.total || 0),
            backgroundColor: weeklyActivityColors.appointments,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          },
          {
            label: 'Completed',
            data: last7.map(([, data]: [string, any]) => data.completed || 0),
            backgroundColor: weeklyActivityColors.completed,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          },
        ],
      };
    }

    return {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Appointments',
          data: [0, 0, 0, 0, 0, 0, 0],
          backgroundColor: weeklyActivityColors.appointments,
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        },
        {
          label: 'Completed',
          data: [0, 0, 0, 0, 0, 0, 0],
          backgroundColor: weeklyActivityColors.completed,
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        },
      ],
    };
  };

  // ── Department Distribution Doughnut Chart ────────────────────────
  const getDepartmentDistributionData = () => {
    if (departmentPerformance && typeof departmentPerformance === 'object') {
      // Handle both { departments: {...} } wrapper and direct object
      const perfData = departmentPerformance.departments || departmentPerformance;
      const entries = Object.entries(perfData);

      if (entries.length > 0) {
        const departments = entries.slice(0, 5).map(([name, data]: [string, any]) => ({
          name,
          count: data.total || 0,
        }));

        const total = departments.reduce((sum, d) => sum + d.count, 0);

        return {
          departments,
          total,
          chartData: {
            labels: departments.map(d => d.name),
            datasets: [{
              data: departments.map(d => d.count),
              backgroundColor: chartColorPalette.slice(0, departments.length),
              borderWidth: 0,
            }],
          },
        };
      }
    }

    return {
      departments: [],
      total: 0,
      chartData: {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }],
      },
    };
  };

  const weeklyActivityData = getWeeklyActivityData();
  const departmentData = getDepartmentDistributionData();

  // ── Appointments Table Helpers ────────────────────────────────────
  const formatTime = (dateString: string) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'CONFIRMED':
      case 'COMPLETED':
        return 'bg-teal-100 text-teal-700';
      case 'PENDING':
      case 'SCHEDULED':
        return 'bg-yellow-100 text-yellow-700';
      case 'CANCELLED':
      case 'NO_SHOW':
        return 'bg-red-100 text-red-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatStatus = (status: string) => {
    if (!status) return 'Pending';
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleAppointmentClick = (appointmentId: string) => {
    navigate(`/appointments/${appointmentId}`);
  };

  const getAppointmentsList = () => {
    if (Array.isArray(todayAppointments)) return todayAppointments;
    if (todayAppointments?.appointments) return todayAppointments.appointments;
    if (todayAppointments?.data) return todayAppointments.data;
    return [];
  };

  const appointmentsList = getAppointmentsList();
  const isWeeklyLoading = !weeklyActivity && !errors.weeklyActivity;
  const isDeptLoading = !departmentPerformance && !errors.departmentPerformance;
  const isAppointmentsLoading = !todayAppointments && !errors.todayAppointments;

  const doughnutOptions = {
    ...pieChartOptions,
    cutout: '55%',
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-lg transition-shadow"
          >
            {isLoading ? (
              <div className="animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 bg-gray-200 rounded-xl" />
                  <div className="w-12 h-5 bg-gray-200 rounded" />
                </div>
                <div className="mt-4">
                  <div className="h-4 w-28 bg-gray-200 rounded mb-2" />
                  <div className="h-8 w-20 bg-gray-200 rounded" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${card.iconBg}`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  {card.trend !== 0 && (
                    <span
                      className={`text-sm font-semibold ${
                        card.trend > 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {card.trend > 0 ? '+' : ''}{card.trend}%
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Weekly Activity & Patient Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Weekly Activity</h3>
            {isWeeklyLoading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {isWeeklyLoading ? (
            <ChartSkeleton type="bar" height="h-64" />
          ) : errors.weeklyActivity ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-500">
              <ExclamationTriangleIcon className="h-10 w-10 text-amber-400 mb-2" />
              <p className="text-sm">Failed to load weekly activity</p>
              <button onClick={refetchAll} className="mt-2 text-blue-600 hover:underline text-sm">
                Retry
              </button>
            </div>
          ) : (
            <div className="h-64">
              <Bar data={weeklyActivityData} options={barChartOptions} />
            </div>
          )}
        </div>

        {/* Patient Distribution by Department Doughnut Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Patient Distribution by Department</h3>
            {isDeptLoading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {isDeptLoading ? (
            <ChartSkeleton type="pie" height="h-56" />
          ) : errors.departmentPerformance ? (
            <div className="h-56 flex flex-col items-center justify-center text-gray-500">
              <ExclamationTriangleIcon className="h-10 w-10 text-amber-400 mb-2" />
              <p className="text-sm">Failed to load department data</p>
              <button onClick={refetchAll} className="mt-2 text-blue-600 hover:underline text-sm">
                Retry
              </button>
            </div>
          ) : departmentData.departments.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-gray-500">
              <p className="text-sm">No department data available</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-8">
              <div className="h-56 w-56 relative">
                <Doughnut data={departmentData.chartData} options={doughnutOptions} />
              </div>
              <div className="space-y-3">
                {departmentData.departments.map((dept: any, index: number) => {
                  const percentage = departmentData.total > 0
                    ? Math.round((dept.count / departmentData.total) * 100)
                    : 0;
                  return (
                    <div key={dept.name || index} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: chartColorPalette[index % chartColorPalette.length] }}
                      />
                      <span className="text-sm font-medium" style={{ color: chartColorPalette[index % chartColorPalette.length] }}>
                        {dept.name} {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's Appointments Table */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">Today's Appointments</h3>
          <div className="flex items-center gap-3">
            {isAppointmentsLoading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <ClockIcon className="h-5 w-5 text-gray-400" />
          </div>
        </div>

        {isAppointmentsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 py-3">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-1/6" />
                <div className="h-6 bg-gray-200 rounded-full w-20" />
              </div>
            ))}
          </div>
        ) : errors.todayAppointments ? (
          <div className="py-8 flex flex-col items-center justify-center text-gray-500">
            <ExclamationTriangleIcon className="h-10 w-10 text-amber-400 mb-2" />
            <p className="text-sm">Failed to load appointments</p>
            <button onClick={refetchAll} className="mt-2 text-blue-600 hover:underline text-sm">
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-blue-600">Patient</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-blue-600">Doctor</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-blue-600">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-blue-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsList.slice(0, 4).map((apt: any, index: number) => (
                    <tr
                      key={apt.id || index}
                      className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors cursor-pointer"
                      onClick={() => handleAppointmentClick(apt.id)}
                    >
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-900">
                          {apt.patient?.firstName || apt.patientName?.split(' ')[0] || 'N/A'} {apt.patient?.lastName || apt.patientName?.split(' ')[1] || ''}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-900">
                          Dr. {apt.doctor?.user?.lastName || apt.doctor?.user?.firstName || apt.doctor?.lastName || apt.doctor?.firstName || apt.doctorName?.split(' ').pop() || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">
                          {formatTime(apt.appointmentTime || apt.scheduledTime || apt.time || apt.appointmentDate)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(apt.status)}`}>
                          {formatStatus(apt.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {appointmentsList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        No appointments scheduled for today
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {appointmentsList.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  to="/appointments"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  View all appointments <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
