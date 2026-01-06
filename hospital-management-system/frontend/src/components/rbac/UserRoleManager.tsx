import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  UserIcon,
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { rbacApi } from '../../services/api';

interface Permission {
  id: string;
  name: string;
  description?: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  permissions: Permission[];
}

interface UserRoleManagerProps {
  userId: string;
  userName: string;
  baseRole: string;
  onClose: () => void;
}

// Group permissions by category for display
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

// Badge for base role
function BaseRoleBadge({ role }: { role: string }) {
  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'from-red-500 to-rose-600',
    HOSPITAL_ADMIN: 'from-purple-500 to-indigo-600',
    DOCTOR: 'from-blue-500 to-cyan-600',
    NURSE: 'from-pink-500 to-rose-500',
    RECEPTIONIST: 'from-green-500 to-emerald-600',
    LAB_TECHNICIAN: 'from-yellow-500 to-amber-600',
    PHARMACIST: 'from-orange-500 to-red-500',
    RADIOLOGIST: 'from-cyan-500 to-blue-600',
    ACCOUNTANT: 'from-emerald-500 to-teal-600',
    PATIENT: 'from-slate-500 to-gray-600',
  };

  const gradient = roleColors[role] || 'from-gray-500 to-gray-600';

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white',
        'bg-gradient-to-r shadow-lg',
        gradient
      )}
    >
      <ShieldCheckIcon className="h-4 w-4" />
      {role.replace(/_/g, ' ')}
    </span>
  );
}

// Role dropdown selector
function RoleSelector({
  availableRoles,
  onSelect,
  assignedRoleIds,
}: {
  availableRoles: Role[];
  onSelect: (roleId: string) => void;
  assignedRoleIds: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRoles = availableRoles.filter(
    (role) =>
      !assignedRoleIds.includes(role.id) &&
      (role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition-all duration-200',
          'bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm',
          'border-slate-200 dark:border-slate-700',
          'text-slate-700 dark:text-slate-300',
          'hover:border-indigo-400 hover:shadow-md',
          isOpen && 'ring-2 ring-indigo-500/50 border-indigo-500'
        )}
      >
        <span className="flex items-center gap-2">
          <PlusIcon className="h-5 w-5 text-indigo-500" />
          Add Custom Role
        </span>
        <ChevronDownIcon
          className={clsx(
            'h-5 w-5 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 top-full left-0 right-0 mt-2',
            'rounded-xl border shadow-2xl overflow-hidden',
            'bg-white dark:bg-slate-800',
            'border-slate-200 dark:border-slate-700'
          )}
        >
          {/* Search */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={clsx(
                  'w-full pl-9 pr-4 py-2 rounded-lg text-sm',
                  'bg-slate-50 dark:bg-slate-900',
                  'border-none',
                  'text-slate-900 dark:text-white placeholder-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
                )}
              />
            </div>
          </div>

          {/* Role List */}
          <div className="max-h-60 overflow-y-auto p-2">
            {filteredRoles.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {searchQuery ? 'No roles found' : 'All roles are assigned'}
              </div>
            ) : (
              filteredRoles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => {
                    onSelect(role.id);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={clsx(
                    'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all duration-200',
                    'hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                  )}
                >
                  <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
                    <ShieldCheckIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {role.name}
                    </div>
                    {role.description && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {role.description}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {role.permissions.length} permissions
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Assigned role card
function AssignedRoleCard({
  role,
  onRemove,
}: {
  role: Role;
  onRemove: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const groupedPermissions = groupPermissionsByCategory(role.permissions);

  return (
    <div
      className={clsx(
        'rounded-xl border transition-all duration-200',
        'bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm',
        'border-slate-200 dark:border-slate-700',
        'hover:shadow-md'
      )}
    >
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <ShieldCheckIcon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 dark:text-white truncate">
              {role.name}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {role.permissions.length} permissions
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
              'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
              'text-slate-600 dark:text-slate-400'
            )}
          >
            {isExpanded ? 'Hide' : 'Show'} Permissions
          </button>
          <button
            onClick={onRemove}
            className={clsx(
              'p-2 rounded-lg transition-all duration-200',
              'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50',
              'text-red-600 dark:text-red-400'
            )}
            title="Remove Role"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded Permissions */}
      {isExpanded && role.permissions.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-200/50 dark:border-slate-700/50 pt-4">
          <div className="space-y-3">
            {Object.entries(groupedPermissions).map(([category, permissions]) => (
              <div key={category}>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {category}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {permissions.map((permission) => (
                    <span
                      key={permission.id}
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        'bg-slate-100 dark:bg-slate-700',
                        'text-slate-600 dark:text-slate-400'
                      )}
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

export function UserRoleManager({
  userId,
  userName,
  baseRole,
  onClose,
}: UserRoleManagerProps) {
  const [assignedRoles, setAssignedRoles] = useState<Role[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Load user roles and available roles
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [userRolesRes, allRolesRes, permissionsRes] = await Promise.all([
          rbacApi.getUserRoles(userId),
          rbacApi.getRoles(),
          rbacApi.getMyPermissions(),
        ]);

        setAssignedRoles(userRolesRes.data.data?.roles || []);
        setAvailableRoles(allRolesRes.data.data || []);
        setEffectivePermissions(permissionsRes.data.data?.permissions || []);
      } catch (error) {
        console.error('Failed to load role data:', error);
        toast.error('Failed to load role information');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  const handleAssignRole = async (roleId: string) => {
    setActionLoading(true);
    try {
      await rbacApi.assignRoleToUser(userId, roleId);
      toast.success('Role assigned successfully');

      // Refresh assigned roles
      const response = await rbacApi.getUserRoles(userId);
      setAssignedRoles(response.data.data?.roles || []);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to assign role';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    setActionLoading(true);
    try {
      await rbacApi.removeRoleFromUser(userId, roleId);
      toast.success('Role removed successfully');

      // Update local state
      setAssignedRoles((prev) => prev.filter((r) => r.id !== roleId));
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to remove role';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate effective permissions summary
  const effectivePermissionsByCategory = groupPermissionsByCategory(effectivePermissions);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={clsx(
            'relative w-full max-w-3xl max-h-[90vh] overflow-hidden',
            'rounded-2xl backdrop-blur-xl border shadow-2xl',
            'bg-white/95 dark:bg-slate-800/95',
            'border-white/50 dark:border-white/10'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Manage User Roles
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {userName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 transition-all duration-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
                <span className="ml-3 text-slate-500 dark:text-slate-400">
                  Loading role information...
                </span>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Base Role Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <LockClosedIcon className="h-4 w-4" />
                    Base Role (Read Only)
                  </h3>
                  <div
                    className={clsx(
                      'p-4 rounded-xl border',
                      'bg-slate-50/50 dark:bg-slate-900/30',
                      'border-slate-200/50 dark:border-slate-700/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BaseRoleBadge role={baseRole} />
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          System-assigned role
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Roles Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Custom Roles
                  </h3>

                  {/* Role Selector */}
                  <RoleSelector
                    availableRoles={availableRoles}
                    assignedRoleIds={assignedRoles.map((r) => r.id)}
                    onSelect={handleAssignRole}
                  />

                  {/* Assigned Roles */}
                  {assignedRoles.length === 0 ? (
                    <div
                      className={clsx(
                        'p-6 rounded-xl border text-center',
                        'bg-slate-50/50 dark:bg-slate-900/30',
                        'border-slate-200/50 dark:border-slate-700/50'
                      )}
                    >
                      <ShieldCheckIcon className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="mt-3 text-slate-500 dark:text-slate-400">
                        No custom roles assigned
                      </p>
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        Add custom roles to extend permissions
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assignedRoles.map((role) => (
                        <AssignedRoleCard
                          key={role.id}
                          role={role}
                          onRemove={() => handleRemoveRole(role.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Effective Permissions Summary */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" />
                    Effective Permissions ({effectivePermissions.length})
                  </h3>

                  <div
                    className={clsx(
                      'p-4 rounded-xl border',
                      'bg-green-50/50 dark:bg-green-900/10',
                      'border-green-200/50 dark:border-green-700/30'
                    )}
                  >
                    {effectivePermissions.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                        No permissions available
                      </p>
                    ) : (
                      <div className="space-y-4 max-h-64 overflow-y-auto">
                        {Object.entries(effectivePermissionsByCategory).map(
                          ([category, permissions]) => (
                            <div key={category}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">
                                  {category}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-xs bg-green-200/50 dark:bg-green-800/30 text-green-700 dark:text-green-400">
                                  {permissions.length}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {permissions.map((permission) => (
                                  <span
                                    key={permission.id}
                                    className={clsx(
                                      'px-2 py-0.5 rounded text-xs font-medium',
                                      'bg-white dark:bg-slate-800',
                                      'text-green-700 dark:text-green-400',
                                      'border border-green-200 dark:border-green-800'
                                    )}
                                    title={permission.description}
                                  >
                                    {permission.name.split(':').pop()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Loading Overlay */}
          {actionLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserRoleManager;
