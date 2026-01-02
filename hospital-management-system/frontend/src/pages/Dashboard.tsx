import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BeakerIcon,
  BuildingOffice2Icon,
  HeartIcon,
  BanknotesIcon,
  ChartBarIcon,
  ArrowRightIcon,
  SparklesIcon,
  ClipboardDocumentListIcon,
  VideoCameraIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  BellAlertIcon,
  UserPlusIcon,
  CalendarIcon,
  CpuChipIcon,
  AcademicCapIcon,
  TruckIcon,
  ScissorsIcon,
  EyeDropperIcon,
  HomeModernIcon,
  PhoneArrowUpRightIcon,
  QueueListIcon,
  ChartPieIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  StarIcon,
  FireIcon,
  BoltIcon,
  SignalIcon,
  ServerStackIcon,
  CloudArrowUpIcon,
  PresentationChartLineIcon,
  RectangleGroupIcon,
} from '@heroicons/react/24/outline';
import {
  SparklesIcon as SparklesSolid,
  HeartIcon as HeartSolid,
  BellIcon as BellSolid,
  CheckBadgeIcon,
} from '@heroicons/react/24/solid';
import { appointmentApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'indigo' | 'emerald' | 'rose' | 'orange';
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, trend, color, subtitle }: StatCardProps) {
  const colorConfig = {
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-100' },
    green: { bg: 'bg-green-50', icon: 'bg-green-500', text: 'text-green-600', border: 'border-green-100' },
    amber: { bg: 'bg-amber-50', icon: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-100' },
    red: { bg: 'bg-red-50', icon: 'bg-red-500', text: 'text-red-600', border: 'border-red-100' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-100' },
    cyan: { bg: 'bg-cyan-50', icon: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-100' },
    indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-100' },
    rose: { bg: 'bg-rose-50', icon: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-100' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-100' },
  };

  const cfg = colorConfig[color];

  return (
    <div className={`relative overflow-hidden bg-white rounded-2xl border ${cfg.border} p-6 hover:shadow-lg transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${cfg.icon} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            trend.isPositive
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-red-50 text-red-600'
          }`}>
            {trend.isPositive ? (
              <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ArrowTrendingDownIcon className="h-3.5 w-3.5" />
            )}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-600 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {/* Decorative element */}
      <div className={`absolute -bottom-4 -right-4 w-24 h-24 ${cfg.bg} rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500`} />
    </div>
  );
}

interface QuickActionProps {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
  gradient: string;
}

function QuickAction({ href, icon: Icon, label, description, gradient }: QuickActionProps) {
  return (
    <Link
      to={href}
      className="flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300 group"
    >
      <div className={`p-3.5 rounded-xl ${gradient} shadow-md group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
          {label}
        </p>
        <p className="text-sm text-gray-500 truncate">{description}</p>
      </div>
      <ArrowRightIcon className="h-5 w-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const response = await appointmentApi.getDashboardStats();
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin mx-auto" />
            <CpuChipIcon className="h-6 w-6 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const aiFeatures = [
    {
      name: 'AI Diagnosis',
      href: '/ai-assistant',
      icon: SparklesIcon,
      description: 'Smart diagnosis assistant',
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    },
    {
      name: 'Drug Checker',
      href: '/drug-interactions',
      icon: BeakerIcon,
      description: 'Interaction analysis',
      gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    },
    {
      name: 'Clinical Notes',
      href: '/clinical-notes',
      icon: DocumentTextIcon,
      description: 'AI documentation',
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    },
    {
      name: 'Risk Assessment',
      href: '/patient-risk',
      icon: ShieldCheckIcon,
      description: 'Predictive analytics',
      gradient: 'bg-gradient-to-br from-orange-500 to-red-600',
    },
    {
      name: 'Medical Imaging',
      href: '/medical-imaging',
      icon: EyeDropperIcon,
      description: 'AI image analysis',
      gradient: 'bg-gradient-to-br from-pink-500 to-rose-600',
    },
    {
      name: 'Telemedicine',
      href: '/telemedicine',
      icon: VideoCameraIcon,
      description: 'Virtual consultations',
      gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    },
  ];

  const recentActivity = [
    { action: 'New patient registered', patient: 'John Doe', time: '5 min ago', type: 'patient', icon: UserPlusIcon },
    { action: 'Appointment completed', patient: 'Jane Smith', time: '15 min ago', type: 'appointment', icon: CheckCircleIcon },
    { action: 'Lab results ready', patient: 'Mike Johnson', time: '1 hour ago', type: 'lab', icon: BeakerIcon },
    { action: 'Prescription issued', patient: 'Sarah Williams', time: '2 hours ago', type: 'prescription', icon: ClipboardDocumentListIcon },
    { action: 'Emergency admission', patient: 'Tom Brown', time: '3 hours ago', type: 'emergency', icon: BellAlertIcon },
  ];

  const hospitalModules = [
    { name: 'OPD', href: '/opd', icon: UserGroupIcon, count: 156, color: 'text-blue-600 bg-blue-50' },
    { name: 'IPD', href: '/ipd', icon: BuildingOffice2Icon, count: 47, color: 'text-indigo-600 bg-indigo-50' },
    { name: 'Emergency', href: '/emergency', icon: BellAlertIcon, count: 8, color: 'text-red-600 bg-red-50' },
    { name: 'Laboratory', href: '/laboratory', icon: BeakerIcon, count: 34, color: 'text-cyan-600 bg-cyan-50' },
    { name: 'Radiology', href: '/radiology', icon: EyeDropperIcon, count: 12, color: 'text-purple-600 bg-purple-50' },
    { name: 'Pharmacy', href: '/pharmacy', icon: HeartIcon, count: 89, color: 'text-pink-600 bg-pink-50' },
    { name: 'Surgery', href: '/surgery', icon: ScissorsIcon, count: 5, color: 'text-orange-600 bg-orange-50' },
    { name: 'Blood Bank', href: '/blood-bank', icon: EyeDropperIcon, count: 23, color: 'text-rose-600 bg-rose-50' },
  ];

  const systemHealth = [
    { name: 'AI Services', status: 'operational', icon: CpuChipIcon },
    { name: 'Database', status: 'operational', icon: ServerStackIcon },
    { name: 'API Gateway', status: 'operational', icon: CloudArrowUpIcon },
    { name: 'Real-time Sync', status: 'operational', icon: ArrowPathIcon },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-8">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <SparklesSolid className="h-6 w-6 text-yellow-300" />
              </div>
              <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
                AI-Powered HMS
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white">
              Welcome back, {user?.firstName || 'Doctor'}!
            </h1>
            <p className="text-blue-100 mt-2 text-lg">
              Here's your hospital overview for today
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white/10 rounded-xl px-5 py-3 border border-white/20">
              <p className="text-blue-200 text-sm">Today's Date</p>
              <p className="text-white font-semibold text-lg">{new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-5 py-3 border border-white/20">
              <p className="text-blue-200 text-sm">Current Time</p>
              <p className="text-white font-semibold text-lg">{new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Today's Appointments"
          value={stats?.today?.total || 24}
          icon={CalendarDaysIcon}
          trend={{ value: 12, isPositive: true }}
          color="blue"
          subtitle="8 scheduled for morning"
        />
        <StatCard
          title="Completed Visits"
          value={stats?.today?.completed || 18}
          icon={CheckCircleIcon}
          trend={{ value: 8, isPositive: true }}
          color="emerald"
          subtitle="75% completion rate"
        />
        <StatCard
          title="Pending Patients"
          value={stats?.today?.pending || 5}
          icon={ClockIcon}
          color="amber"
          subtitle="Average wait: 12 min"
        />
        <StatCard
          title="Critical Alerts"
          value={stats?.today?.noShow || 2}
          icon={BellAlertIcon}
          trend={{ value: 3, isPositive: false }}
          color="red"
          subtitle="Requires attention"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500">
            <BuildingOffice2Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">47</p>
            <p className="text-sm text-gray-500">IPD Patients</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-rose-500">
            <HeartSolid className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">12</p>
            <p className="text-sm text-gray-500">ICU Patients</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500">
            <TruckIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">4</p>
            <p className="text-sm text-gray-500">Ambulances Active</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500">
            <ChartPieIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">78%</p>
            <p className="text-sm text-gray-500">Bed Occupancy</p>
          </div>
        </div>
      </div>

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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-blue-500">
              <RectangleGroupIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickAction
              href="/patients?action=new"
              icon={UserPlusIcon}
              label="Register Patient"
              description="Add a new patient record"
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <QuickAction
              href="/appointments?action=new"
              icon={CalendarDaysIcon}
              label="Book Appointment"
              description="Schedule a new appointment"
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <QuickAction
              href="/laboratory"
              icon={BeakerIcon}
              label="Lab Orders"
              description="Create or view lab orders"
              gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />
            <QuickAction
              href="/ai-assistant"
              icon={SparklesIcon}
              label="AI Assistant"
              description="Get AI-powered diagnosis help"
              gradient="bg-gradient-to-br from-violet-500 to-purple-600"
            />
            <QuickAction
              href="/pharmacy"
              icon={HeartIcon}
              label="Pharmacy"
              description="Manage prescriptions"
              gradient="bg-gradient-to-br from-pink-500 to-rose-600"
            />
            <QuickAction
              href="/billing"
              icon={CurrencyDollarIcon}
              label="Billing"
              description="Invoice & payments"
              gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            />
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-emerald-500">
              <SignalIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">System Health</h2>
          </div>
          <div className="space-y-3">
            {systemHealth.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-sm font-medium text-emerald-600">Active</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
            <div className="flex items-center gap-2">
              <CheckBadgeIcon className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-emerald-700">All systems operational</span>
            </div>
            <p className="text-sm text-emerald-600 mt-1">Last checked: Just now</p>
          </div>
        </div>
      </div>

      {/* Hospital Modules */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500">
              <HomeModernIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Hospital Modules</h2>
              <p className="text-sm text-gray-500">Quick access to all departments</p>
            </div>
          </div>
          <Link to="/reports" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View Reports <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {hospitalModules.map((module) => (
            <Link
              key={module.name}
              to={module.href}
              className="flex flex-col items-center p-4 rounded-xl bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-md transition-all group"
            >
              <div className={`p-3 rounded-xl ${module.color} group-hover:scale-110 transition-transform`}>
                <module.icon className="h-6 w-6" />
              </div>
              <p className="font-semibold text-gray-900 mt-3 text-sm">{module.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{module.count} active</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500">
                <QueueListIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            </div>
            <Link to="/reports" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`p-2.5 rounded-xl ${
                  activity.type === 'patient' ? 'bg-blue-100 text-blue-600' :
                  activity.type === 'appointment' ? 'bg-emerald-100 text-emerald-600' :
                  activity.type === 'lab' ? 'bg-cyan-100 text-cyan-600' :
                  activity.type === 'emergency' ? 'bg-red-100 text-red-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  <activity.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 font-medium">
                    {activity.action}
                  </p>
                  <p className="text-sm text-gray-600">{activity.patient}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500">
                <PresentationChartLineIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Financial Overview</h2>
            </div>
            <Link to="/billing" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View details
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <CurrencyDollarIcon className="h-5 w-5" />
                <span className="text-sm font-semibold">Today's Revenue</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">$24,580</p>
              <div className="flex items-center gap-1 mt-2">
                <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500" />
                <p className="text-xs font-medium text-emerald-600">+12% from yesterday</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <ClockIcon className="h-5 w-5" />
                <span className="text-sm font-semibold">Pending Bills</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">$8,420</p>
              <p className="text-xs text-blue-600 mt-2">23 invoices pending</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <ChartBarIcon className="h-5 w-5" />
                <span className="text-sm font-semibold">Monthly Target</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">68%</p>
              <div className="mt-2 h-2 bg-purple-200 rounded-full overflow-hidden">
                <div className="h-full w-[68%] bg-gradient-to-r from-purple-500 to-violet-500 rounded-full" />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <ExclamationTriangleIcon className="h-5 w-5" />
                <span className="text-sm font-semibold">Overdue</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">$3,150</p>
              <p className="text-xs text-amber-600 mt-2">7 invoices overdue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-orange-500">
            <FireIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Today's Performance</h2>
            <p className="text-sm text-gray-500">Real-time hospital metrics</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Avg Wait Time', value: '12 min', icon: ClockIcon, change: '-3 min', positive: true },
            { label: 'Patient Satisfaction', value: '94%', icon: StarIcon, change: '+2%', positive: true },
            { label: 'Staff Utilization', value: '87%', icon: UserGroupIcon, change: '+5%', positive: true },
            { label: 'Bed Turnover', value: '2.4x', icon: ArrowPathIcon, change: '+0.3', positive: true },
            { label: 'Lab TAT', value: '45 min', icon: BeakerIcon, change: '-10 min', positive: true },
            { label: 'No Shows', value: '3%', icon: ExclamationTriangleIcon, change: '-1%', positive: true },
          ].map((metric) => (
            <div key={metric.label} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <metric.icon className="h-4 w-4" />
                <span className="text-xs font-medium">{metric.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{metric.value}</p>
              <p className={`text-xs font-medium mt-1 ${metric.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                {metric.change}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
