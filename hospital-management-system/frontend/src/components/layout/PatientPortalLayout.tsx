import { useState, useEffect, Fragment } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import {
  HomeIcon,
  CalendarDaysIcon,
  FolderIcon,
  BeakerIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  FireIcon,
  CakeIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import PatientNotificationDropdown from '../patient-portal/PatientNotificationDropdown';

// Interface for decoded JWT payload
interface PatientTokenPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  patientId?: string;
  hospitalId: string;
  photo?: string;
  avatarUrl?: string;
  exp: number;
  iat: number;
}

// Interface for patient info
interface PatientInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  avatarUrl?: string;
}

// Navigation items for the sidebar
interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

// Pill icon component (since Heroicons doesn't have one)
const PillIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
    />
  </svg>
);

// Helper function to decode JWT token
const decodeJWT = (token: string): PatientTokenPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
};

// Helper function to get patient info from localStorage
const getPatientInfo = (): PatientInfo | null => {
  try {
    // First, check if patient token exists
    const patientToken = localStorage.getItem('patientPortalToken');
    if (!patientToken) {
      return null;
    }

    // Try to get patient info from localStorage (stored during login)
    const patientUserStr = localStorage.getItem('patientUser');
    if (patientUserStr) {
      const patient = JSON.parse(patientUserStr);
      if (patient) {
        return {
          id: patient.id,
          email: patient.email,
          firstName: patient.firstName,
          lastName: patient.lastName,
          fullName: `${patient.firstName} ${patient.lastName}`,
          initials: `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase(),
          avatarUrl: patient.photo || patient.avatarUrl,
        };
      }
    }

    // Fallback: try to decode patient token
    const decoded = decodeJWT(patientToken);
    if (decoded) {
      return {
        id: decoded.patientId || decoded.id,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        fullName: `${decoded.firstName} ${decoded.lastName}`,
        initials: `${decoded.firstName?.[0] || ''}${decoded.lastName?.[0] || ''}`.toUpperCase(),
        avatarUrl: decoded.photo || decoded.avatarUrl,
      };
    }

    // Last fallback: try general auth token if it's a patient
    const authToken = localStorage.getItem('accessToken');
    if (authToken) {
      const authDecoded = decodeJWT(authToken);
      if (authDecoded && authDecoded.role === 'PATIENT') {
        return {
          id: authDecoded.id,
          email: authDecoded.email,
          firstName: authDecoded.firstName,
          lastName: authDecoded.lastName,
          fullName: `${authDecoded.firstName} ${authDecoded.lastName}`,
          initials: `${authDecoded.firstName?.[0] || ''}${authDecoded.lastName?.[0] || ''}`.toUpperCase(),
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get patient info:', error);
    return null;
  }
};

// AI Checker icon (from PNG using CSS mask for currentColor support)
const AICheckerIcon = ({ className }: { className?: string }) => (
  <div
    className={className}
    style={{
      backgroundColor: 'currentColor',
      filter: 'brightness(0.7)',
      WebkitMaskImage: 'url(/icons/AIChecker.png)',
      maskImage: 'url(/icons/AIChecker.png)',
      WebkitMaskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
    }}
  />
);

// AI Sparkles icon
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

// Navigation items configuration
const navigationItems: NavItem[] = [
  { name: 'Dashboard', href: '/patient-portal/dashboard', icon: HomeIcon },
  { name: 'My Appointments', href: '/patient-portal/appointments', icon: CalendarDaysIcon },
  { name: 'AI Health Assistant', href: '/patient-portal/health-assistant', icon: AICheckerIcon },
  { name: 'Health Insights', href: '/patient-portal/health-insights', icon: ChartBarIcon },
  { name: 'Symptom Checker', href: '/patient-portal/symptom-checker', icon: SparklesIcon },
  { name: 'Medical History', href: '/patient-portal/medical-history', icon: ClipboardDocumentListIcon },
  { name: 'Health Timeline', href: '/patient-portal/history', icon: ClockIcon },
  { name: 'Health Sync', href: '/patient-portal/health-sync', icon: DevicePhoneMobileIcon },
  { name: 'Fitness Tracker', href: '/patient-portal/fitness', icon: FireIcon },
  { name: 'Nutrition & Diet', href: '/patient-portal/nutrition', icon: CakeIcon },
  { name: 'Wellness Hub', href: '/patient-portal/wellness', icon: TrophyIcon },
  { name: 'Medical Records', href: '/patient-portal/records', icon: FolderIcon },
  { name: 'Prescriptions', href: '/patient-portal/prescriptions', icon: PillIcon },
  { name: 'Lab Results', href: '/patient-portal/labs', icon: BeakerIcon },
  { name: 'Bills & Payments', href: '/patient-portal/billing', icon: CreditCardIcon },
  { name: 'Messages', href: '/patient-portal/messages', icon: ChatBubbleLeftRightIcon },
  { name: 'My Profile', href: '/patient-portal/settings', icon: UserCircleIcon },
];

export default function PatientPortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Load patient info on mount
  useEffect(() => {
    const info = getPatientInfo();
    setPatientInfo(info);

    // If no patient info found, redirect to login
    if (!info) {
      navigate('/patient-portal/login');
    }
  }, [navigate]);

  // Handle logout
  const handleLogout = () => {
    // Clear patient portal specific token
    localStorage.removeItem('patientPortalToken');
    // Also clear general tokens if they belong to patient
    const authToken = localStorage.getItem('accessToken');
    if (authToken) {
      const decoded = decodeJWT(authToken);
      if (decoded?.role === 'PATIENT') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    }
    // Redirect to patient portal login
    navigate('/patient-portal/login');
  };

  // Get current page name for breadcrumb
  const getCurrentPageName = (): string => {
    const currentItem = navigationItems.find(
      (item) => location.pathname === item.href || location.pathname.startsWith(item.href + '/')
    );
    return currentItem?.name || 'Patient Portal';
  };

  // Get breadcrumb segments
  const getBreadcrumbs = (): { name: string; href?: string }[] => {
    const segments: { name: string; href?: string }[] = [{ name: 'Home', href: '/patient-portal/dashboard' }];
    const pageName = getCurrentPageName();
    if (pageName !== 'Dashboard') {
      segments.push({ name: pageName, href: undefined });
    }
    return segments;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-blue-50/40">
      {/* Mobile sidebar overlay */}
      <Transition show={sidebarOpen} as={Fragment}>
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          </Transition.Child>

          {/* Sidebar panel */}
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col h-screen overflow-hidden">
              {/* Mobile sidebar header */}
              <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100 bg-gradient-to-r from-teal-500 to-blue-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <HeartIcon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xl font-bold text-white">Patient Portal</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>

              {/* Mobile patient profile */}
              <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  {patientInfo?.avatarUrl ? (
                    <img src={patientInfo.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover shadow-lg" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg">
                      <span className="text-lg font-bold text-white">
                        {patientInfo?.initials || 'P'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{patientInfo?.fullName || 'Patient'}</p>
                    <p className="text-sm text-gray-500">{patientInfo?.email}</p>
                  </div>
                </div>
              </div>

              {/* Mobile navigation */}
              <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
                {navigationItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-lg shadow-teal-500/25'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                    onClick={() => setSidebarOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>

              {/* Mobile logout button */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  Logout
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Transition>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col h-screen bg-white/90 backdrop-blur-xl border-r border-gray-200/50 shadow-xl overflow-hidden">
          {/* Logo and Hospital Name */}
          <div className="flex h-20 items-center px-6 bg-gradient-to-r from-teal-500 to-blue-600">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <HeartIcon className="h-7 w-7 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-white">Patient Portal</span>
                <p className="text-xs text-white/80">Healthcare at your fingertips</p>
              </div>
            </div>
          </div>

          {/* Patient Profile Section */}
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg shadow-teal-500/25 ring-4 ring-white">
                  {patientInfo?.avatarUrl ? (
                    <img
                      src={patientInfo.avatarUrl}
                      alt={patientInfo.fullName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold text-white">
                      {patientInfo?.initials || 'P'}
                    </span>
                  )}
                </div>
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {patientInfo?.fullName || 'Welcome, Patient'}
                </p>
                <p className="text-sm text-gray-500 truncate">{patientInfo?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-1 portal-scrollbar">
            <p className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Menu
            </p>
            {navigationItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-lg shadow-teal-500/25'
                      : 'text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg transition-all ${
                          isActive
                            ? 'bg-white/20'
                            : 'bg-gradient-to-br from-teal-100 to-blue-100 group-hover:from-teal-200 group-hover:to-blue-200'
                        }`}
                      >
                        <item.icon
                          className={`h-5 w-5 ${
                            isActive ? 'text-white' : 'text-teal-600 group-hover:text-teal-700'
                          }`}
                        />
                      </div>
                      <span>{item.name}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-teal-100 text-teal-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {!item.badge && (
                      <ChevronRightIcon
                        className={`h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ${
                          isActive ? 'text-white/70' : 'text-gray-400'
                        }`}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Quick Help Section */}
          <div className="p-4 mx-4 mb-4 rounded-xl bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-100">
            <div className="flex items-center gap-3 mb-2">
              <QuestionMarkCircleIcon className="h-5 w-5 text-teal-600" />
              <span className="font-medium text-gray-900">Need Help?</span>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Our support team is available 24/7 to assist you.
            </p>
            <button className="w-full px-4 py-2 bg-white text-teal-600 rounded-lg text-sm font-medium hover:bg-teal-50 border border-teal-200 transition-colors">
              Contact Support
            </button>
          </div>

          {/* Logout */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-72">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
          <div className="flex h-16 items-center gap-x-4 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              type="button"
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 lg:hidden transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            <div className="h-6 w-px bg-gray-200 lg:hidden" />

            {/* Breadcrumb navigation */}
            <div className="flex flex-1 items-center">
              <nav className="flex items-center text-sm" aria-label="Breadcrumb">
                {getBreadcrumbs().map((crumb, index) => (
                  <Fragment key={crumb.name}>
                    {index > 0 && (
                      <ChevronRightIcon className="h-4 w-4 mx-2 text-gray-400 flex-shrink-0" />
                    )}
                    {crumb.href ? (
                      <NavLink
                        to={crumb.href}
                        className="text-gray-500 hover:text-teal-600 transition-colors"
                      >
                        {crumb.name}
                      </NavLink>
                    ) : (
                      <span className="font-medium text-gray-900">{crumb.name}</span>
                    )}
                  </Fragment>
                ))}
              </nav>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* Notification dropdown */}
              <PatientNotificationDropdown />

              <div className="hidden sm:block h-6 w-px bg-gray-200" />

              {/* Profile dropdown */}
              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-gray-100 transition-colors">
                  {patientInfo?.avatarUrl ? (
                    <img src={patientInfo.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shadow-md" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-md">
                      <span className="text-sm font-bold text-white">
                        {patientInfo?.initials || 'P'}
                      </span>
                    </div>
                  )}
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {patientInfo?.firstName || 'Patient'}
                    </p>
                    <p className="text-xs text-gray-500">View profile</p>
                  </div>
                  <ChevronDownIcon className="hidden sm:block h-4 w-4 text-gray-400" />
                </Menu.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <p className="text-sm font-medium text-gray-900">
                        {patientInfo?.fullName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{patientInfo?.email}</p>
                    </div>
                    <div className="py-1">
                      <Menu.Item>
                        {({ active }) => (
                          <NavLink
                            to="/patient-portal/settings"
                            className={`${
                              active ? 'bg-teal-50 text-teal-700' : 'text-gray-700'
                            } flex items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
                          >
                            <UserCircleIcon className="h-5 w-5" />
                            My Profile
                          </NavLink>
                        )}
                      </Menu.Item>
                    </div>
                    <div className="py-1 border-t border-gray-100">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogout}
                            className={`${
                              active ? 'bg-red-50 text-red-700' : 'text-red-600'
                            } flex items-center gap-3 px-4 py-2.5 text-sm w-full transition-colors`}
                          >
                            <ArrowRightOnRectangleIcon className="h-5 w-5" />
                            Logout
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-4rem-4rem)]">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-white/80 backdrop-blur-xl border-t border-gray-200/50 py-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Left side - Hospital branding */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center">
                  <HeartIcon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-gray-600">
                  &copy; {new Date().getFullYear()} Spetaar Pro. All rights reserved.
                </span>
              </div>

              {/* Right side - Links */}
              <div className="flex items-center gap-6">
                <a
                  href="/patient-portal/help"
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-teal-600 transition-colors"
                >
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                  Help & Support
                </a>
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-teal-600 transition-colors"
                >
                  <ShieldCheckIcon className="h-4 w-4" />
                  Privacy Policy
                </a>
                <a
                  href="/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-teal-600 transition-colors"
                >
                  <DocumentTextIcon className="h-4 w-4" />
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .portal-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #5eead4 #f0fdfa;
          scroll-behavior: smooth;
        }
        .portal-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .portal-scrollbar::-webkit-scrollbar-track {
          background: #f0fdfa;
          border-radius: 4px;
          margin: 8px 0;
        }
        .portal-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #5eead4 0%, #2dd4bf 100%);
          border-radius: 4px;
          border: 2px solid #f0fdfa;
          transition: background 0.2s ease;
        }
        .portal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #2dd4bf 0%, #14b8a6 100%);
        }
        .portal-scrollbar::-webkit-scrollbar-thumb:active {
          background: linear-gradient(180deg, #14b8a6 0%, #0d9488 100%);
        }
      `}</style>
    </div>
  );
}
