import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircleIcon,
  ClockIcon,
  ChartPieIcon,
  SparklesIcon,
  BeakerIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  EyeDropperIcon,
  VideoCameraIcon,
  ArrowRightIcon,
  BoltIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  CalendarBillingIcon,
  NotificationBellIcon,
  HospitalBedIcon,
  HospitalAIIcon,
} from '../../../icons/HMSIcons';
import { Bar, Pie } from 'react-chartjs-2';
import { useAdminDashboard } from '../../../../hooks/useAdminDashboard';
import KPICard from '../shared/KPICard';
import OccupancyGauge from '../shared/OccupancyGauge';
import RevenueTrendsChart from './RevenueTrendsChart';
import DepartmentPerformanceChart from './DepartmentPerformanceChart';
import PatientDemographicsChart from './PatientDemographicsChart';
import AppointmentTrendsChart from '../shared/AppointmentTrendsChart';
import ChartCard from '../ChartCard';
import ChartSkeleton from '../ChartSkeleton';
import { barChartOptions, pieChartOptions, weeklyActivityColors, chartColorPalette } from '../chartSetup';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    todayStats,
    patientTrends,
    revenueTrends,
    departmentPerformance,
    patientDemographics,
    bedOccupancy,
    weeklyActivity,
    todayAppointments,
    isLoading,
    errors,
    refetchAll,
  } = useAdminDashboard();

  const aiFeatures = [
    { name: 'AI Diagnosis', href: '/ai-assistant', icon: SparklesIcon, description: 'Smart diagnosis assistant', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
    { name: 'Drug Checker', href: '/drug-interactions', icon: BeakerIcon, description: 'Interaction analysis', gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600' },
    { name: 'Clinical Notes', href: '/clinical-notes', icon: DocumentTextIcon, description: 'AI documentation', gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
    { name: 'Risk Assessment', href: '/patient-risk', icon: ShieldCheckIcon, description: 'Predictive analytics', gradient: 'bg-gradient-to-br from-orange-500 to-red-600' },
    { name: 'Medical Imaging', href: '/medical-imaging', icon: EyeDropperIcon, description: 'AI image analysis', gradient: 'bg-gradient-to-br from-pink-500 to-rose-600' },
    { name: 'Telemedicine', href: '/telemedicine', icon: VideoCameraIcon, description: 'Virtual consultations', gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600' },
  ];

  // Format trends data for chart
  const appointmentTrendsData = patientTrends?.trends?.map((t: any) => ({
    label: t.period || t.month,
    value: t.appointments || t.count || t.total || 0,
  })) || [];

  // Transform Weekly Activity API data to chart format
  const getWeeklyActivityData = () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // If we have trends data from API
    if (weeklyActivity?.trends && Array.isArray(weeklyActivity.trends)) {
      const labels = weeklyActivity.trends.map((t: any) => {
        if (t.period) {
          const date = new Date(t.period);
          return dayNames[date.getDay()];
        }
        return t.day || t.label || '';
      });

      return {
        labels: labels.length > 0 ? labels : dayNames.slice(1).concat(dayNames[0]), // Mon-Sun
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

    // If trends is an object with date keys
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

    // Empty state
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

  // Transform Department Performance API data to pie chart format
  const getDepartmentDistributionData = () => {
    // departmentPerformance from API returns: { [departmentName]: { total, completed, cancelled, noShow } }
    if (departmentPerformance && typeof departmentPerformance === 'object') {
      const entries = Object.entries(departmentPerformance);

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

    // Empty state
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

  // Format time for appointments
  const formatTime = (dateString: string) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Get status badge style
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

  // Handle appointment row click
  const handleAppointmentClick = (appointmentId: string) => {
    navigate(`/appointments/${appointmentId}`);
  };

  // Get appointments array from API response
  const getAppointmentsList = () => {
    if (Array.isArray(todayAppointments)) {
      return todayAppointments;
    }
    if (todayAppointments?.appointments) {
      return todayAppointments.appointments;
    }
    if (todayAppointments?.data) {
      return todayAppointments.data;
    }
    return [];
  };

  const appointmentsList = getAppointmentsList();
  const isWeeklyLoading = !weeklyActivity && !errors.weeklyActivity;
  const isDeptLoading = !departmentPerformance && !errors.departmentPerformance;
  const isAppointmentsLoading = !todayAppointments && !errors.todayAppointments;

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Today's Appointments"
          value={todayStats?.today?.total || 0}
          icon={CalendarBillingIcon}
          trend={todayStats?.today?.total > 0 ? { value: 12, isPositive: true } : undefined}
          color="blue"
          subtitle={`${todayStats?.today?.completed || 0} completed`}
          isLoading={isLoading}
        />
        <KPICard
          title="Completed Visits"
          value={todayStats?.today?.completed || 0}
          icon={CheckCircleIcon}
          trend={todayStats?.today?.completed > 0 ? { value: 8, isPositive: true } : undefined}
          color="emerald"
          subtitle={`${todayStats?.today?.total > 0 ? Math.round((todayStats.today.completed / todayStats.today.total) * 100) : 0}% completion rate`}
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Patients"
          value={todayStats?.today?.pending || 0}
          icon={ClockIcon}
          color="amber"
          subtitle="Waiting for consultation"
          isLoading={isLoading}
        />
        <KPICard
          title="No Shows"
          value={todayStats?.today?.noShow || 0}
          icon={NotificationBellIcon}
          trend={todayStats?.today?.noShow > 0 ? { value: 3, isPositive: false } : undefined}
          color="red"
          subtitle="Missed appointments"
          isLoading={isLoading}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 rounded-xl bg-indigo-500">
            <HospitalBedIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{bedOccupancy?.occupiedBeds || 0}</p>
            <p className="text-sm text-gray-500">IPD Patients</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 rounded-xl bg-emerald-500">
            <ChartPieIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{bedOccupancy?.occupancyRate?.toFixed(0) || 0}%</p>
            <p className="text-sm text-gray-500">Bed Occupancy</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 rounded-xl bg-blue-500">
            <CalendarBillingIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{todayStats?.weeklyTotal || 0}</p>
            <p className="text-sm text-gray-500">Weekly Appointments</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 rounded-xl bg-purple-500">
            <HospitalAIIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{bedOccupancy?.totalBeds || 0}</p>
            <p className="text-sm text-gray-500">Total Beds</p>
          </div>
        </div>
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

        {/* Patient Distribution by Department Pie Chart */}
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
                <Pie data={departmentData.chartData} options={pieChartOptions} />
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
                      <span className="text-sm" style={{ color: chartColorPalette[index % chartColorPalette.length] }}>
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
            {[1, 2, 3, 4, 5].map((i) => (
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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Patient</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Doctor</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsList.slice(0, 5).map((apt: any, index: number) => (
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

      {/* Appointment Trends & Revenue Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Appointment Trends"
          subtitle="6-month appointment volume"
          isLoading={!patientTrends && !errors.patientTrends}
          error={errors.patientTrends ? 'Failed to load trends' : null}
          onRetry={refetchAll}
        >
          <AppointmentTrendsChart
            data={appointmentTrendsData}
            primaryLabel="Appointments"
          />
        </ChartCard>

        <RevenueTrendsChart
          data={revenueTrends}
          isLoading={!revenueTrends && !errors.revenueTrends}
          error={errors.revenueTrends ? 'Failed to load revenue data' : null}
          onRetry={refetchAll}
        />
      </div>

      {/* Department Performance & Patient Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DepartmentPerformanceChart
          data={departmentPerformance}
          isLoading={!departmentPerformance && !errors.departmentPerformance}
          error={errors.departmentPerformance ? 'Failed to load department data' : null}
          onRetry={refetchAll}
        />

        <PatientDemographicsChart
          data={patientDemographics}
          isLoading={!patientDemographics && !errors.patientDemographics}
          error={errors.patientDemographics ? 'Failed to load demographics' : null}
          onRetry={refetchAll}
        />
      </div>

      {/* Bed Occupancy by Ward */}
      {bedOccupancy?.byWard && bedOccupancy.byWard.length > 0 && (
        <ChartCard
          title="Bed Occupancy by Ward"
          subtitle="Real-time bed availability"
          height="h-48"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 h-full items-center justify-center">
            {bedOccupancy.byWard.slice(0, 6).map((ward: any) => (
              <OccupancyGauge
                key={ward.wardName}
                percentage={ward.total > 0 ? (ward.occupied / ward.total) * 100 : 0}
                label={ward.wardName}
                sublabel={`${ward.occupied}/${ward.total} beds`}
                size="sm"
              />
            ))}
          </div>
        </ChartCard>
      )}

      {/* AI Features Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <BoltIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI-Powered Features</h2>
              <p className="text-sm text-gray-500">Intelligent healthcare assistance</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-emerald-700">All Systems Online</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {aiFeatures.map((feature) => (
            <Link
              key={feature.name}
              to={feature.href}
              className="group flex flex-col items-center p-5 rounded-xl bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-lg transition-all duration-300"
            >
              <div className={`p-4 rounded-2xl ${feature.gradient} shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                <feature.icon className="h-7 w-7 text-white" />
              </div>
              <p className="font-semibold text-gray-900 mt-4 text-center">{feature.name}</p>
              <p className="text-xs text-gray-500 mt-1 text-center">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
