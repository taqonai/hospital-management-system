import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  SparklesIcon as SparklesSolid,
} from '@heroicons/react/24/solid';
import {
  CpuChipIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  BeakerIcon,
  BuildingOffice2Icon,
  BellAlertIcon,
  EyeDropperIcon,
  HeartIcon,
  ScissorsIcon,
  HomeModernIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

// Import role-specific dashboards
import {
  AdminDashboard,
  DoctorDashboard,
  NurseDashboard,
  ReceptionistDashboard,
  MarketingDashboard,
  LabDashboard,
  PharmacyDashboard,
  RadiologyDashboard,
  HRDashboard,
  AccountantDashboard,
  ProcurementDashboard,
} from '../components/dashboard/charts';

// Welcome Header Component
function WelcomeHeader({ user, isFirstVisit }: { user: any; isFirstVisit: boolean }) {
  return (
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
            {isFirstVisit ? 'Welcome' : 'Welcome back'}, {user?.firstName || ''} {user?.lastName || ''}!
          </h1>
          <p className="text-blue-100 mt-2 text-lg">
            Here's your overview for today
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
            <p className="text-blue-200 text-sm">Your Role</p>
            <p className="text-white font-semibold text-lg">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
    </div>
  );
}

// Default Dashboard for roles without specific dashboards
function DefaultDashboard() {
  const hospitalModules = [
    { name: 'OPD', href: '/opd', icon: UserGroupIcon, count: 0, color: 'text-blue-600 bg-blue-50' },
    { name: 'IPD', href: '/ipd', icon: BuildingOffice2Icon, count: 0, color: 'text-indigo-600 bg-indigo-50' },
    { name: 'Emergency', href: '/emergency', icon: BellAlertIcon, count: 0, color: 'text-red-600 bg-red-50' },
    { name: 'Laboratory', href: '/laboratory', icon: BeakerIcon, count: 0, color: 'text-cyan-600 bg-cyan-50' },
    { name: 'Radiology', href: '/radiology', icon: EyeDropperIcon, count: 0, color: 'text-purple-600 bg-purple-50' },
    { name: 'Pharmacy', href: '/pharmacy', icon: HeartIcon, count: 0, color: 'text-pink-600 bg-pink-50' },
    { name: 'Surgery', href: '/surgery', icon: ScissorsIcon, count: 0, color: 'text-orange-600 bg-orange-50' },
    { name: 'Blood Bank', href: '/blood-bank', icon: EyeDropperIcon, count: 0, color: 'text-rose-600 bg-rose-50' },
  ];

  return (
    <div className="space-y-6">
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
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
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

  // Render role-specific dashboard
  const renderDashboard = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
      case 'HOSPITAL_ADMIN':
        return <AdminDashboard />;
      case 'DOCTOR':
        return <DoctorDashboard />;
      case 'NURSE':
        return <NurseDashboard />;
      case 'RECEPTIONIST':
        return <ReceptionistDashboard />;
      case 'MARKETING':
        return <MarketingDashboard />;
      case 'LAB_TECHNICIAN':
        return <LabDashboard />;
      case 'PHARMACIST':
        return <PharmacyDashboard />;
      case 'RADIOLOGIST':
        return <RadiologyDashboard />;
      case 'HR_MANAGER':
      case 'HR_STAFF':
        return <HRDashboard />;
      case 'ACCOUNTANT':
        return <AccountantDashboard />;
      case 'PROCUREMENT_MANAGER':
      case 'PROCUREMENT_STAFF':
        return <ProcurementDashboard />;
      default:
        return <DefaultDashboard />;
    }
  };

  // Loading state
  if (!user) {
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

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Header */}
      <WelcomeHeader user={user} isFirstVisit={isFirstVisit} />

      {/* Role-specific Dashboard Content */}
      {renderDashboard()}
    </div>
  );
}
