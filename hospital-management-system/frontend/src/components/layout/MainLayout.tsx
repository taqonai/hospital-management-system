import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  BeakerIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  PhotoIcon,
  BuildingStorefrontIcon,
  CreditCardIcon,
  BriefcaseIcon,
  HomeModernIcon,
  HeartIcon,
  ChartBarIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
  ComputerDesktopIcon,
  PresentationChartLineIcon,
  SparklesIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  ClipboardDocumentCheckIcon,
  UserCircleIcon,
  DocumentMagnifyingGlassIcon,
  WrenchScrewdriverIcon,
  CakeIcon,
  ReceiptPercentIcon,
  ShoppingCartIcon,
  BanknotesIcon,
  DocumentChartBarIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import AICreationAssistant from '../ai/AICreationAssistant';
import NotificationDropdown from '../notifications/NotificationDropdown';
import opdIconPng from '../../assets/opd-icon.png';

const OpdIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src={opdIconPng} alt="" className={className || "h-4 w-4"} />
);

// Role-based access configuration
type UserRole = 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST' |
  'LAB_TECHNICIAN' | 'PHARMACIST' | 'RADIOLOGIST' | 'ACCOUNTANT' | 'PATIENT' |
  'HR_MANAGER' | 'HR_STAFF' | 'HOUSEKEEPING_MANAGER' | 'HOUSEKEEPING_STAFF' |
  'MAINTENANCE_STAFF' | 'SECURITY_STAFF' | 'DIETARY_STAFF' | 'MARKETING';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: boolean;
  roles?: UserRole[]; // If undefined, accessible to all authenticated users
  permission?: string; // RBAC permission code for dynamic access control
}

// Define which roles can access each module
// Optimized role-based access following principle of least privilege
const navigationGroups: { name: string; items: NavItem[] }[] = [
  {
    name: 'Main',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Squares2X2Icon, color: 'from-blue-500 to-blue-600' },
      { name: 'Patients', href: '/patients', icon: UsersIcon, color: 'from-emerald-500 to-emerald-600',
        permission: 'patients:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
      { name: 'Appointments', href: '/appointments', icon: CalendarDaysIcon, color: 'from-purple-500 to-purple-600',
        permission: 'appointments:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
      { name: 'Doctors', href: '/doctors', icon: UserGroupIcon, color: 'from-cyan-500 to-cyan-600',
        permission: 'doctors:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST'] },
      { name: 'Departments', href: '/departments', icon: BuildingOffice2Icon, color: 'from-blue-500 to-indigo-600',
        permission: 'departments:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN'] },
    ],
  },
  {
    name: 'Clinical',
    items: [
      { name: 'Precision Health', href: '/clinician', icon: HeartIcon, color: 'from-rose-500 to-pink-600',
        permission: 'opd:consultations',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
      { name: 'OPD', href: '/opd', icon: OpdIcon, color: 'from-indigo-500 to-indigo-600',
        permission: 'opd:visits:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
      { name: 'IPD', href: '/ipd', icon: BuildingOffice2Icon, color: 'from-violet-500 to-violet-600',
        permission: 'ipd:admissions:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
      { name: 'Emergency', href: '/emergency', icon: ExclamationTriangleIcon, color: 'from-red-500 to-red-600', badge: true,
        permission: 'emergency:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
      { name: 'Nurse Station', href: '/nurse-station', icon: ClipboardDocumentCheckIcon, color: 'from-indigo-500 to-blue-600',
        permission: 'nursing:dashboard',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'NURSE'] },
      { name: 'Early Warning', href: '/early-warning', icon: BellIcon, color: 'from-orange-500 to-red-600',
        permission: 'ai:early_warning',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
      { name: 'Med Safety', href: '/medication-safety', icon: ShieldCheckIcon, color: 'from-blue-500 to-cyan-600',
        permission: 'ai:med_safety',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST'] },
      { name: 'Laboratory', href: '/laboratory', icon: BeakerIcon, color: 'from-amber-500 to-amber-600',
        permission: 'lab:orders:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN'] },
      { name: 'Radiology', href: '/radiology', icon: PhotoIcon, color: 'from-pink-500 to-pink-600',
        permission: 'radiology:orders:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RADIOLOGIST'] },
      { name: 'Pharmacy', href: '/pharmacy', icon: BuildingStorefrontIcon, color: 'from-teal-500 to-teal-600',
        permission: 'pharmacy:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PHARMACIST'] },
      { name: 'Surgery', href: '/surgery', icon: HeartIcon, color: 'from-rose-500 to-rose-600',
        permission: 'surgery:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'] },
      { name: 'Blood Bank', href: '/blood-bank', icon: HeartIcon, color: 'from-red-500 to-red-600',
        permission: 'blood_bank:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN'] },
    ],
  },
  {
    name: 'AI Features',
    items: [
      { name: 'Diagnostic AI', href: '/diagnostic-assistant', icon: SparklesIcon, color: 'from-fuchsia-500 to-fuchsia-600',
        permission: 'ai:diagnostic',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
      { name: 'AI Scribe', href: '/ai-scribe', icon: DocumentTextIcon, color: 'from-violet-500 to-violet-600',
        permission: 'ai:scribe',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'] },
      { name: 'Smart Orders', href: '/smart-orders', icon: SparklesIcon, color: 'from-indigo-500 to-purple-600',
        permission: 'ai:smart_orders',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'] },
      { name: 'Clinical Notes', href: '/clinical-notes', icon: DocumentTextIcon, color: 'from-sky-500 to-sky-600',
        permission: 'ai:diagnostic',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
      { name: 'Patient Risk', href: '/patient-risk', icon: ShieldCheckIcon, color: 'from-orange-500 to-orange-600',
        permission: 'ai:predictive',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
      { name: 'Drug Checker', href: '/drug-interactions', icon: BeakerIcon, color: 'from-lime-500 to-lime-600',
        permission: 'ai:med_safety',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST'] },
      { name: 'Medical Imaging', href: '/medical-imaging', icon: PhotoIcon, color: 'from-cyan-500 to-cyan-600',
        permission: 'ai:imaging',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RADIOLOGIST'] },
      { name: 'PDF Analysis', href: '/pdf-analysis', icon: DocumentMagnifyingGlassIcon, color: 'from-violet-500 to-purple-600',
        permission: 'ai:diagnostic',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'LAB_TECHNICIAN', 'RADIOLOGIST'] },
      { name: 'Telemedicine', href: '/telemedicine', icon: VideoCameraIcon, color: 'from-blue-500 to-blue-600',
        permission: 'telemedicine:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'] },
      { name: 'Symptom Checker', href: '/symptom-checker', icon: MagnifyingGlassIcon, color: 'from-emerald-500 to-teal-600',
        permission: 'ai:symptom_checker',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
    ],
  },
  {
    name: 'Operations',
    items: [
      { name: 'Billing', href: '/billing', icon: CreditCardIcon, color: 'from-green-500 to-green-600',
        permission: 'billing:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'] },
      { name: 'Accounting', href: '/accounting', icon: BanknotesIcon, color: 'from-emerald-500 to-green-600',
        permission: 'billing:reports',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT'] },
      { name: 'Financial Reports', href: '/financial-reports', icon: DocumentChartBarIcon, color: 'from-green-500 to-teal-600',
        permission: 'reports:financial',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT'] },
      { name: 'Insurance Coding', href: '/insurance-coding', icon: ReceiptPercentIcon, color: 'from-teal-500 to-cyan-600',
        permission: 'insurance_coding:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT'] },
      { name: 'Insurance Audit', href: '/insurance-audit', icon: ClipboardDocumentCheckIcon, color: 'from-cyan-500 to-teal-600',
        permission: 'insurance_coding:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT'] },
      { name: 'Insurance Verification', href: '/insurance/verifications', icon: ShieldCheckIcon, color: 'from-yellow-500 to-amber-600',
        permission: 'patients:write',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'] },
      { name: 'Insurance Providers', href: '/insurance-providers', icon: ShieldCheckIcon, color: 'from-blue-500 to-indigo-600',
        permission: 'patients:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'] },
      { name: 'Copay Refunds', href: '/copay-refunds', icon: ArrowUturnLeftIcon, color: 'from-amber-500 to-orange-600',
        permission: 'billing:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'] },
      { name: 'Procurement', href: '/procurement', icon: ShoppingCartIcon, color: 'from-indigo-500 to-blue-600',
        permission: 'procurement:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT'] },
      { name: 'HR', href: '/hr', icon: BriefcaseIcon, color: 'from-slate-500 to-slate-600',
        permission: 'hr:employees:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'HR_MANAGER', 'HR_STAFF'] },
      { name: 'My Leave', href: '/my-leave', icon: CalendarDaysIcon, color: 'from-teal-500 to-teal-600',
        permission: 'hr:leave:manage',
        roles: ['NURSE', 'LAB_TECHNICIAN', 'PHARMACIST', 'RADIOLOGIST', 'ACCOUNTANT', 'HR_STAFF', 'HOUSEKEEPING_STAFF', 'MAINTENANCE_STAFF', 'SECURITY_STAFF', 'DIETARY_STAFF', 'RECEPTIONIST'] },
      { name: 'Housekeeping', href: '/housekeeping', icon: HomeModernIcon, color: 'from-amber-500 to-amber-600',
        permission: 'housekeeping:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF'] },
      { name: 'Queue', href: '/queue', icon: QueueListIcon, color: 'from-indigo-500 to-indigo-600',
        permission: 'queue:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE'] },
      { name: 'Kiosk', href: '/kiosk', icon: ComputerDesktopIcon, color: 'from-gray-500 to-gray-600',
        permission: 'queue:manage',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST'] },
      { name: 'Quality', href: '/quality', icon: ClipboardDocumentCheckIcon, color: 'from-emerald-500 to-teal-600',
        permission: 'quality:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN'] },
      { name: 'Assets', href: '/asset-management', icon: WrenchScrewdriverIcon, color: 'from-amber-500 to-orange-600',
        permission: 'assets:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAINTENANCE_STAFF'] },
      { name: 'Dietary', href: '/dietary', icon: CakeIcon, color: 'from-lime-500 to-green-600',
        permission: 'dietary:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DIETARY_STAFF'] },
      { name: 'CRM', href: '/crm', icon: UserGroupIcon, color: 'from-purple-500 to-violet-600',
        permission: 'crm:read',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'MARKETING'] },
      { name: 'Access Control', href: '/rbac', icon: ShieldCheckIcon, color: 'from-indigo-500 to-purple-600',
        permission: 'rbac:manage',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN'] },
      { name: 'AI Settings', href: '/ai-settings', icon: CpuChipIcon, color: 'from-cyan-500 to-blue-600',
        permission: 'settings:write',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN'] },
    ],
  },
  {
    name: 'Analytics',
    items: [
      { name: 'Reports', href: '/reports', icon: ChartBarIcon, color: 'from-violet-500 to-violet-600',
        permission: 'reports:view',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'ACCOUNTANT', 'HR_MANAGER', 'MARKETING'] },
      { name: 'Risk Analytics', href: '/risk-analytics', icon: PresentationChartLineIcon, color: 'from-rose-500 to-rose-600',
        permission: 'reports:analytics',
        roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'] },
    ],
  },
];

// Helper function to filter navigation based on permissions (with role fallback)
const filterNavigationByPermissions = (
  groups: typeof navigationGroups,
  userRole?: string,
  hasPermission?: (permission: string) => boolean,
  permissionsLoaded?: boolean,
) => {
  return groups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Items without permission or roles are accessible to all authenticated users
      if (!item.roles && !item.permission) return true;

      // If permissions are loaded AND item has a permission field → use permission check
      if (permissionsLoaded && item.permission && hasPermission) {
        return hasPermission(item.permission);
      }

      // Fallback: role-based check (when permissions not loaded yet or item has no permission)
      if (!item.roles) return true;
      return item.roles.includes(userRole as UserRole);
    })
  })).filter(group => group.items.length > 0); // Remove empty groups
};

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const { hasPermission, loaded: permissionsLoaded } = usePermissions();
  const location = useLocation();

  // Filter navigation based on permissions (with role fallback)
  const filteredNavGroups = filterNavigationByPermissions(
    navigationGroups,
    user?.role,
    hasPermission,
    permissionsLoaded,
  );

  // Get current page name
  const getCurrentPageName = () => {
    for (const group of navigationGroups) {
      for (const item of group.items) {
        if (location.pathname.startsWith(item.href)) {
          return item.name;
        }
      }
    }
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col h-screen overflow-hidden">
            {/* Mobile sidebar header */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <span className="text-white font-bold text-lg">H</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">HMS Pro</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            {/* Mobile nav */}
            <nav className="flex-1 min-h-0 overflow-y-auto p-4 scroll-smooth sidebar-scrollbar">
              {filteredNavGroups.map((group) => (
                <div key={group.name} className="mb-6">
                  <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {group.name}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`
                        }
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col h-screen bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-xl overflow-hidden">
          {/* Logo */}
          <div className="flex h-16 items-center px-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Spetaar Pro</span>
                <p className="text-xs text-gray-400">Healthcare Management</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Navigation - with custom scrollbar */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 scroll-smooth sidebar-scrollbar">
            {filteredNavGroups.map((group) => (
              <div key={group.name} className="mb-6">
                <p className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  {group.name}
                </p>
                <div className="space-y-1">
                  {group.items
                    .filter((item) =>
                      item.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) =>
                          `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? `bg-gradient-to-r ${item.color} text-white shadow-lg shadow-${item.color.split('-')[1]}-500/25`
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className={`p-1.5 rounded-lg transition-all ${
                              isActive
                                ? 'bg-white/20'
                                : `bg-gradient-to-br ${item.color} shadow-sm`
                            }`}>
                              <item.icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-white'}`} />
                            </div>
                            <span>{item.name}</span>
                            {item.badge && (
                              <span className="ml-auto h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/50">
            {/* User profile - visible to all roles */}
            <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-white">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            {(user?.role === 'SUPER_ADMIN' || user?.role === 'HOSPITAL_ADMIN') && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <div className="p-1.5 rounded-lg bg-gray-200">
                  <Cog6ToothIcon className="h-4 w-4 text-gray-600" />
                </div>
                Settings
              </NavLink>
            )}
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all mt-1"
            >
              <div className="p-1.5 rounded-lg bg-red-100">
                <ArrowRightOnRectangleIcon className="h-4 w-4 text-red-600" />
              </div>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
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

            {/* Page title & breadcrumb */}
            <div className="flex flex-1 items-center gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-0.5">
                  <HomeIcon className="h-3.5 w-3.5" />
                  <span>/</span>
                  <span className="text-gray-600 font-medium">{getCurrentPageName()}</span>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  {getCurrentPageName()}
                </h1>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* AI Status */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl text-sm font-medium border border-emerald-200/50">
                <div className="relative">
                  <CpuChipIcon className="h-4 w-4" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <span>AI Active</span>
              </div>

              {/* Notifications */}
              <NotificationDropdown />

              <div className="hidden lg:block h-6 w-px bg-gray-200" />

              {/* User profile */}
              <div className="flex items-center gap-3 pl-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <span className="text-sm font-bold text-white">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.role?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* AI Creation Assistant - Floating Button */}
      <AICreationAssistant />

      {/* Custom Scrollbar Styles */}
      <style>{`
        .sidebar-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 #f1f5f9;
          scroll-behavior: smooth;
        }
        .sidebar-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .sidebar-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
          margin: 8px 0;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
          border-radius: 4px;
          border: 2px solid #f1f5f9;
          transition: background 0.2s ease;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #64748b 0%, #475569 100%);
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb:active {
          background: linear-gradient(180deg, #475569 0%, #334155 100%);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
      `}</style>
    </div>
  );
}
