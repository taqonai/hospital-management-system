import { Link } from 'react-router-dom';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  BellAlertIcon,
  BuildingOffice2Icon,
  ChartPieIcon,
  SparklesIcon,
  BeakerIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  EyeDropperIcon,
  VideoCameraIcon,
  ArrowRightIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { useAdminDashboard } from '../../../../hooks/useAdminDashboard';
import KPICard from '../shared/KPICard';
import OccupancyGauge from '../shared/OccupancyGauge';
import RevenueTrendsChart from './RevenueTrendsChart';
import DepartmentPerformanceChart from './DepartmentPerformanceChart';
import PatientDemographicsChart from './PatientDemographicsChart';
import AppointmentTrendsChart from '../shared/AppointmentTrendsChart';
import ChartCard from '../ChartCard';

export default function AdminDashboard() {
  const {
    todayStats,
    patientTrends,
    revenueTrends,
    departmentPerformance,
    patientDemographics,
    bedOccupancy,
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
    value: t.appointments || t.count || 0,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Today's Appointments"
          value={todayStats?.today?.total || 0}
          icon={CalendarDaysIcon}
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
          icon={BellAlertIcon}
          trend={todayStats?.today?.noShow > 0 ? { value: 3, isPositive: false } : undefined}
          color="red"
          subtitle="Missed appointments"
          isLoading={isLoading}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500">
            <BuildingOffice2Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{bedOccupancy?.occupiedBeds || 0}</p>
            <p className="text-sm text-gray-500">IPD Patients</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500">
            <ChartPieIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{bedOccupancy?.occupancyRate?.toFixed(0) || 0}%</p>
            <p className="text-sm text-gray-500">Bed Occupancy</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500">
            <CalendarDaysIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{todayStats?.weeklyTotal || 0}</p>
            <p className="text-sm text-gray-500">Weekly Appointments</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-500">
            <BuildingOffice2Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{bedOccupancy?.totalBeds || 0}</p>
            <p className="text-sm text-gray-500">Total Beds</p>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Appointment Trends"
          subtitle="6-month appointment volume"
          isLoading={!patientTrends}
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

      {/* Charts Row 2 */}
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
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
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
