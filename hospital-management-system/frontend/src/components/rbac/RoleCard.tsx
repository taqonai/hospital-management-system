import { useState } from 'react';
import {
  ShieldCheckIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UsersIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isSystem?: boolean;
  permissions: Permission[];
  _count?: {
    users: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface RoleCardProps {
  role: Role;
  onEdit?: (role: Role) => void;
  onDelete?: (role: Role) => void;
  className?: string;
}

// Group permissions by category
function groupPermissionsByCategory(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce((acc, permission) => {
    const category = permission.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);
}

// Status badge component
function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border',
        isActive
          ? 'bg-green-100/60 text-green-700 border-green-200'
          : 'bg-gray-100/60 text-gray-700 border-gray-200'
      )}
    >
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          isActive ? 'bg-green-500' : 'bg-gray-500'
        )}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// Category colors for visual distinction
const categoryColors: Record<string, string> = {
  'Patient Management': 'from-blue-500 to-blue-600',
  'Appointments': 'from-purple-500 to-purple-600',
  'Laboratory': 'from-emerald-500 to-emerald-600',
  'Pharmacy': 'from-orange-500 to-orange-600',
  'Radiology': 'from-cyan-500 to-cyan-600',
  'Billing': 'from-yellow-500 to-yellow-600',
  'HR': 'from-pink-500 to-pink-600',
  'Administration': 'from-indigo-500 to-indigo-600',
  'Reports': 'from-teal-500 to-teal-600',
  'Settings': 'from-slate-500 to-slate-600',
};

function getCategoryColor(category: string): string {
  return categoryColors[category] || 'from-gray-500 to-gray-600';
}

export function RoleCard({ role, onEdit, onDelete, className = '' }: RoleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const permissionCount = role.permissions?.length || 0;
  const userCount = role._count?.users || 0;
  const groupedPermissions = groupPermissionsByCategory(role.permissions || []);
  const categoryCount = Object.keys(groupedPermissions).length;

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300',
        'bg-white/70 dark:bg-slate-800/70',
        'border-white/50 dark:border-white/10',
        'shadow-lg shadow-black/5 dark:shadow-black/20',
        'hover:shadow-xl hover:-translate-y-1',
        className
      )}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <ShieldCheckIcon className="h-6 w-6 text-white" />
            </div>

            {/* Role Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {role.name}
                </h3>
                <StatusBadge isActive={role.isActive} />
                {role.isSystem && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    <LockClosedIcon className="h-3 w-3" />
                    System
                  </span>
                )}
              </div>
              {role.description && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                  {role.description}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {!role.isSystem && (
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(role)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 hover:scale-105"
                  title="Edit Role"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(role)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 hover:scale-105"
                  title="Delete Role"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <LockClosedIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="font-medium">{permissionCount}</span>
            <span>permissions</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <UsersIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-medium">{userCount}</span>
            <span>users</span>
          </div>
        </div>

        {/* Expand Button */}
        {permissionCount > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-100/80 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium transition-all duration-200"
          >
            {isExpanded ? (
              <>
                <ChevronUpIcon className="h-4 w-4" />
                Hide Permissions
              </>
            ) : (
              <>
                <ChevronDownIcon className="h-4 w-4" />
                View {permissionCount} Permissions ({categoryCount} categories)
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded Permissions */}
      {isExpanded && permissionCount > 0 && (
        <div className="border-t border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(groupedPermissions).map(([category, permissions]) => (
              <div key={category}>
                {/* Category Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={clsx(
                      'w-2 h-2 rounded-full bg-gradient-to-r',
                      getCategoryColor(category)
                    )}
                  />
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {category}
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-500">
                    ({permissions.length})
                  </span>
                </div>

                {/* Permission Tags */}
                <div className="flex flex-wrap gap-2 ml-4">
                  {permissions.map((permission) => (
                    <span
                      key={permission.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm"
                      title={permission.description}
                    >
                      {permission.name.split(':').pop()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleCard;
