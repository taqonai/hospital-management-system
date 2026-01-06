import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheckIcon,
  UserGroupIcon,
  KeyIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserIcon,
  CalendarDaysIcon,
  EyeIcon,
  LockClosedIcon,
  DocumentTextIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { GlassCard, GlassCardHeader, GlassCardTitle } from '../../components/ui/GlassCard';
import { rbacApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Types
interface Permission {
  id: string;
  name: string;
  code: string;
  description?: string;
  category: string;
  isActive: boolean;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: Permission[];
  _count?: {
    users: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface UserWithRoles {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string; // Base role from UserRole enum
  isActive: boolean;
  customRoles: Role[];
  effectivePermissions?: Permission[];
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  details: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

interface RoleFormData {
  name: string;
  description: string;
  permissionIds: string[];
}

// Permission categories for grouping
const PERMISSION_CATEGORIES = [
  { id: 'patient', label: 'Patient Management', icon: UserGroupIcon },
  { id: 'appointment', label: 'Appointments', icon: CalendarDaysIcon },
  { id: 'laboratory', label: 'Laboratory', icon: DocumentTextIcon },
  { id: 'radiology', label: 'Radiology', icon: EyeIcon },
  { id: 'pharmacy', label: 'Pharmacy', icon: DocumentTextIcon },
  { id: 'billing', label: 'Billing', icon: DocumentTextIcon },
  { id: 'hr', label: 'Human Resources', icon: UserGroupIcon },
  { id: 'ipd', label: 'Inpatient (IPD)', icon: DocumentTextIcon },
  { id: 'opd', label: 'Outpatient (OPD)', icon: DocumentTextIcon },
  { id: 'emergency', label: 'Emergency', icon: ExclamationTriangleIcon },
  { id: 'surgery', label: 'Surgery', icon: DocumentTextIcon },
  { id: 'inventory', label: 'Inventory', icon: DocumentTextIcon },
  { id: 'reports', label: 'Reports', icon: ClipboardDocumentListIcon },
  { id: 'settings', label: 'Settings', icon: ShieldCheckIcon },
  { id: 'admin', label: 'Administration', icon: LockClosedIcon },
];

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
      <span className={clsx('w-1.5 h-1.5 rounded-full', isActive ? 'bg-green-500' : 'bg-gray-500')} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// Role Card Component
function RoleCard({
  role,
  onEdit,
  onDelete,
  onView,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    role.permissions.forEach((perm) => {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    });
    return grouped;
  }, [role.permissions]);

  return (
    <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                role.isSystem
                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                  : 'bg-gradient-to-br from-blue-500 to-cyan-600'
              )}
            >
              <ShieldCheckIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{role.name}</h3>
                {role.isSystem && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    System
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {role.description || 'No description'}
              </p>
            </div>
          </div>
          <StatusBadge isActive={role.isActive} />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <KeyIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-slate-300">
              {role.permissions.length} Permissions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UserGroupIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-slate-300">
              {role._count?.users || 0} Users
            </span>
          </div>
        </div>

        {/* Expandable Permissions */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          {expanded ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
          {expanded ? 'Hide Permissions' : 'View Permissions'}
        </button>

        {expanded && (
          <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(permissionsByCategory).map(([category, perms]) => (
              <div key={category} className="p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {PERMISSION_CATEGORIES.find((c) => c.id === category)?.label || category}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {perms.map((perm) => (
                    <span
                      key={perm.id}
                      className="px-2 py-1 rounded text-xs font-medium bg-blue-100/60 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {perm.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
          <button
            onClick={onView}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <EyeIcon className="h-4 w-4 inline mr-1" />
            View
          </button>
          {!role.isSystem && (
            <>
              <button
                onClick={onEdit}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
              >
                <PencilIcon className="h-4 w-4 inline mr-1" />
                Edit
              </button>
              <button
                onClick={onDelete}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
              >
                <TrashIcon className="h-4 w-4 inline mr-1" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Create/Edit Role Modal
function RoleModal({
  role,
  permissions,
  onClose,
  onSuccess,
}: {
  role?: Role | null;
  permissions: Permission[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<RoleFormData>({
    defaultValues: {
      name: role?.name || '',
      description: role?.description || '',
      permissionIds: role?.permissions.map((p) => p.id) || [],
    },
  });

  const selectedPermissions = watch('permissionIds');

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach((perm) => {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    });
    return grouped;
  }, [permissions]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((c) => c !== categoryId) : [...prev, categoryId]
    );
  };

  const selectAllInCategory = (categoryId: string) => {
    const categoryPerms = permissionsByCategory[categoryId] || [];
    const categoryPermIds = categoryPerms.map((p) => p.id);
    const allSelected = categoryPermIds.every((id) => selectedPermissions.includes(id));

    if (allSelected) {
      setValue(
        'permissionIds',
        selectedPermissions.filter((id) => !categoryPermIds.includes(id))
      );
    } else {
      setValue('permissionIds', [...new Set([...selectedPermissions, ...categoryPermIds])]);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: RoleFormData) => rbacApi.createRole(data),
    onSuccess: () => {
      toast.success('Role created successfully');
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create role');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: RoleFormData) => rbacApi.updateRole(role!.id, data),
    onSuccess: () => {
      toast.success('Role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update role');
    },
  });

  const onSubmit = async (data: RoleFormData) => {
    setLoading(true);
    try {
      if (role) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/20 to-transparent" />

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {role ? 'Edit Role' : 'Create New Role'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {role ? 'Modify role permissions' : 'Define a new custom role with specific permissions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Basic Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1">
                  Role Name *
                </label>
                <input
                  {...register('name', { required: 'Role name is required' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Senior Nurse, Lab Supervisor"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Brief description of this role's purpose"
                />
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                Permissions ({selectedPermissions.length} selected)
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue('permissionIds', permissions.map((p) => p.id))}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setValue('permissionIds', [])}
                  className="text-xs font-medium text-gray-500 hover:text-gray-600 dark:text-slate-400"
                >
                  Clear All
                </button>
              </div>
            </div>

            <Controller
              name="permissionIds"
              control={control}
              rules={{ required: 'Select at least one permission' }}
              render={({ field }) => (
                <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-xl">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => {
                    const categoryInfo = PERMISSION_CATEGORIES.find((c) => c.id === category);
                    const isExpanded = expandedCategories.includes(category);
                    const selectedInCategory = perms.filter((p) => field.value.includes(p.id)).length;
                    const allSelected = selectedInCategory === perms.length;

                    return (
                      <div key={category} className="border-b border-gray-100 dark:border-slate-700 last:border-0">
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                          onClick={() => toggleCategory(category)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                            )}
                            {categoryInfo && <categoryInfo.icon className="h-5 w-5 text-gray-500" />}
                            <span className="font-medium text-gray-700 dark:text-slate-300">
                              {categoryInfo?.label || category}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({selectedInCategory}/{perms.length})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllInCategory(category);
                            }}
                            className={clsx(
                              'px-2 py-1 rounded text-xs font-medium transition-colors',
                              allSelected
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-600 dark:text-slate-300'
                            )}
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {perms.map((perm) => (
                              <label
                                key={perm.id}
                                className={clsx(
                                  'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                                  field.value.includes(perm.id)
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                                    : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={field.value.includes(perm.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      field.onChange([...field.value, perm.id]);
                                    } else {
                                      field.onChange(field.value.filter((id: string) => id !== perm.id));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">
                                    {perm.name}
                                  </p>
                                  {perm.description && (
                                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                      {perm.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            />
            {errors.permissionIds && (
              <p className="text-red-500 text-xs">{errors.permissionIds.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
            >
              {loading ? 'Saving...' : role ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// User Role Assignment Modal
function UserRoleModal({
  user,
  roles,
  onClose,
  onSuccess,
}: {
  user: UserWithRoles;
  roles: Role[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    user.customRoles.map((r) => r.id)
  );
  const [showEffectivePermissions, setShowEffectivePermissions] = useState(false);

  // Get effective permissions query
  const { data: effectivePermissions } = useQuery({
    queryKey: ['user-permissions', user.id],
    queryFn: () => rbacApi.getUserEffectivePermissions(user.id),
    select: (res) => res.data.data?.permissions || [],
  });

  const assignMutation = useMutation({
    mutationFn: (roleIds: string[]) => rbacApi.assignRolesToUser(user.id, roleIds),
    onSuccess: () => {
      toast.success('Roles updated successfully');
      queryClient.invalidateQueries({ queryKey: ['rbac-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user.id] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update roles');
    },
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      await assignMutation.mutateAsync(selectedRoleIds);
    } finally {
      setLoading(false);
    }
  };

  // Group effective permissions by category
  const permissionsByCategory = useMemo(() => {
    if (!effectivePermissions) return {};
    const grouped: Record<string, Permission[]> = {};
    effectivePermissions.forEach((perm: Permission) => {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    });
    return grouped;
  }, [effectivePermissions]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/20 to-transparent" />

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-white/10 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-gray-500 dark:text-slate-400">{user.email}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Assign Custom Roles */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
              Assign Custom Roles
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Custom roles extend the base role permissions. Select additional roles to grant more permissions.
            </p>
            <div className="space-y-2">
              {roles.filter((r) => !r.isSystem).map((role) => (
                <label
                  key={role.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all',
                    selectedRoleIds.includes(role.id)
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700'
                      : 'border-2 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoleIds([...selectedRoleIds, role.id]);
                      } else {
                        setSelectedRoleIds(selectedRoleIds.filter((id) => id !== role.id));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 dark:text-slate-300">{role.name}</span>
                      <span className="text-xs text-gray-400">
                        {role.permissions.length} permissions
                      </span>
                    </div>
                    {role.description && (
                      <p className="text-sm text-gray-500 dark:text-slate-400">{role.description}</p>
                    )}
                  </div>
                </label>
              ))}
              {roles.filter((r) => !r.isSystem).length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <ShieldCheckIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No custom roles available</p>
                  <p className="text-sm">Create custom roles in the Roles tab first</p>
                </div>
              )}
            </div>
          </div>

          {/* Effective Permissions */}
          <div>
            <button
              onClick={() => setShowEffectivePermissions(!showEffectivePermissions)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {showEffectivePermissions ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
              View Effective Permissions ({effectivePermissions?.length || 0} total)
            </button>

            {showEffectivePermissions && (
              <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      {PERMISSION_CATEGORIES.find((c) => c.id === category)?.label || category}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(perms as Permission[]).map((perm) => (
                        <span
                          key={perm.id}
                          className="px-2 py-1 rounded text-xs font-medium bg-green-100/60 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        >
                          {perm.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(permissionsByCategory).length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
                    No permissions assigned
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 w-full max-w-md shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/20 to-transparent" />

        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{message}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium transition-all shadow-lg shadow-red-500/25 disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main RBAC Management Page
export default function RBACManagement() {
  const { user } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'permissions' | 'audit'>('roles');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [expandedPermissionCategories, setExpandedPermissionCategories] = useState<string[]>([]);

  // Fetch roles
  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ['rbac-roles', search],
    queryFn: () => rbacApi.getRoles({ search: search || undefined }),
    select: (res) => res.data.data?.roles || [],
  });

  // Fetch permissions
  const { data: permissionsData, isLoading: loadingPermissions } = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: () => rbacApi.getPermissions(),
    select: (res) => res.data.data?.permissions || [],
  });

  // Fetch users with roles
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['rbac-users', search, roleFilter],
    queryFn: () =>
      rbacApi.getUsersWithRoles({
        search: search || undefined,
        role: roleFilter || undefined,
      }),
    select: (res) => res.data.data?.users || [],
    enabled: activeTab === 'users',
  });

  // Fetch audit logs
  const { data: auditData, isLoading: loadingAudit } = useQuery({
    queryKey: ['rbac-audit', actionFilter, dateFilter],
    queryFn: () =>
      rbacApi.getAuditLogs({
        action: actionFilter || undefined,
        startDate: dateFilter || undefined,
      }),
    select: (res) => res.data.data?.logs || [],
    enabled: activeTab === 'audit',
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => rbacApi.deleteRole(roleId),
    onSuccess: () => {
      toast.success('Role deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      setShowDeleteModal(false);
      setRoleToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete role');
    },
  });

  const roles = rolesData || [];
  const permissions = permissionsData || [];
  const users = usersData || [];
  const auditLogs = auditData || [];

  // Group permissions by category for Permissions tab
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach((perm: Permission) => {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    });
    return grouped;
  }, [permissions]);

  const togglePermissionCategory = (categoryId: string) => {
    setExpandedPermissionCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((c) => c !== categoryId) : [...prev, categoryId]
    );
  };

  const loading =
    activeTab === 'roles'
      ? loadingRoles
      : activeTab === 'users'
      ? loadingUsers
      : activeTab === 'permissions'
      ? loadingPermissions
      : loadingAudit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white/90 text-sm font-medium mb-3">
              <ShieldCheckIcon className="h-4 w-4" />
              Role-Based Access Control
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">RBAC Management</h1>
            <p className="mt-2 text-indigo-100">
              Manage roles, permissions, and user access across the hospital system
            </p>
          </div>
          {activeTab === 'roles' && (
            <button
              onClick={() => {
                setSelectedRole(null);
                setShowRoleModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              <PlusIcon className="h-5 w-5" />
              Create Role
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Roles',
            value: roles.length,
            icon: ShieldCheckIcon,
            gradient: 'from-blue-500 to-blue-600',
          },
          {
            label: 'Custom Roles',
            value: roles.filter((r: Role) => !r.isSystem).length,
            icon: ShieldCheckIcon,
            gradient: 'from-purple-500 to-purple-600',
          },
          {
            label: 'Total Permissions',
            value: permissions.length,
            icon: KeyIcon,
            gradient: 'from-cyan-500 to-cyan-600',
          },
          {
            label: 'Permission Categories',
            value: Object.keys(permissionsByCategory).length,
            icon: ClipboardDocumentListIcon,
            gradient: 'from-emerald-500 to-emerald-600',
          },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
              <div className={clsx('p-2 rounded-lg bg-gradient-to-br', stat.gradient)}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 p-2 shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <nav className="flex space-x-2">
          {[
            { id: 'roles', label: 'Roles', icon: ShieldCheckIcon },
            { id: 'users', label: 'Users', icon: UserGroupIcon },
            { id: 'permissions', label: 'Permissions', icon: KeyIcon },
            { id: 'audit', label: 'Audit Log', icon: ClipboardDocumentListIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                setSearch('');
                setRoleFilter('');
                setActionFilter('');
              }}
              className={clsx(
                'relative flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 p-4 shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            {activeTab === 'users' && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              >
                <option value="">All Base Roles</option>
                <option value="HOSPITAL_ADMIN">Hospital Admin</option>
                <option value="DOCTOR">Doctor</option>
                <option value="NURSE">Nurse</option>
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="LAB_TECHNICIAN">Lab Technician</option>
                <option value="PHARMACIST">Pharmacist</option>
                <option value="RADIOLOGIST">Radiologist</option>
                <option value="ACCOUNTANT">Accountant</option>
              </select>
            )}
            {activeTab === 'audit' && (
              <>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                >
                  <option value="">All Actions</option>
                  <option value="CREATE_ROLE">Create Role</option>
                  <option value="UPDATE_ROLE">Update Role</option>
                  <option value="DELETE_ROLE">Delete Role</option>
                  <option value="ASSIGN_ROLE">Assign Role</option>
                  <option value="REMOVE_ROLE">Remove Role</option>
                </select>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 p-12 text-center shadow-lg">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <ArrowPathIcon className="h-10 w-10 animate-spin mx-auto text-indigo-500" />
          <p className="mt-3 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      ) : (
        <>
          {/* Roles Tab */}
          {activeTab === 'roles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.length === 0 ? (
                <div className="col-span-full relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 p-12 text-center shadow-lg">
                  <ShieldCheckIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
                  <p className="text-gray-600 dark:text-slate-400">No roles found</p>
                  <button
                    onClick={() => {
                      setSelectedRole(null);
                      setShowRoleModal(true);
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Create First Role
                  </button>
                </div>
              ) : (
                roles.map((role: Role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onEdit={() => {
                      setSelectedRole(role);
                      setShowRoleModal(true);
                    }}
                    onDelete={() => {
                      setRoleToDelete(role);
                      setShowDeleteModal(true);
                    }}
                    onView={() => {
                      setSelectedRole(role);
                      setShowRoleModal(true);
                    }}
                  />
                ))
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              {users.length === 0 ? (
                <div className="p-12 text-center">
                  <UserGroupIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
                  <p className="text-gray-600 dark:text-slate-400">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          Base Role
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          Custom Roles
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {users.map((usr: UserWithRoles) => (
                        <tr
                          key={usr.id}
                          className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                                <span className="text-white font-medium">
                                  {usr.firstName[0]}
                                  {usr.lastName[0]}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {usr.firstName} {usr.lastName}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-slate-400">
                                  {usr.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                              {usr.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {usr.customRoles.length === 0 ? (
                                <span className="text-sm text-gray-400 dark:text-slate-500">
                                  None
                                </span>
                              ) : (
                                usr.customRoles.map((role) => (
                                  <span
                                    key={role.id}
                                    className="px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                  >
                                    {role.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge isActive={usr.isActive} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => {
                                setSelectedUser(usr);
                                setShowUserModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all hover:shadow-md"
                            >
                              <ShieldCheckIcon className="h-4 w-4 inline mr-1" />
                              Manage Roles
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
                <div className="flex items-start gap-3">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800 dark:text-blue-300">
                      Permission Reference
                    </h4>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      This is a read-only view of all available permissions in the system. Use the
                      Roles tab to assign permissions to roles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                {Object.keys(permissionsByCategory).length === 0 ? (
                  <div className="p-12 text-center">
                    <KeyIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
                    <p className="text-gray-600 dark:text-slate-400">No permissions found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-slate-700">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => {
                      const categoryInfo = PERMISSION_CATEGORIES.find((c) => c.id === category);
                      const isExpanded = expandedPermissionCategories.includes(category);

                      return (
                        <div key={category}>
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                            onClick={() => togglePermissionCategory(category)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                              )}
                              {categoryInfo && (
                                <categoryInfo.icon className="h-5 w-5 text-indigo-500" />
                              )}
                              <span className="font-semibold text-gray-700 dark:text-slate-300">
                                {categoryInfo?.label || category}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-300">
                                {(perms as Permission[]).length} permissions
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4">
                              <div className="overflow-x-auto">
                                <table className="min-w-full">
                                  <thead>
                                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                      <th className="px-3 py-2">Permission</th>
                                      <th className="px-3 py-2">Code</th>
                                      <th className="px-3 py-2">Description</th>
                                      <th className="px-3 py-2">Roles with Access</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {(perms as Permission[]).map((perm) => {
                                      const rolesWithPerm = roles.filter((r: Role) =>
                                        r.permissions.some((p) => p.id === perm.id)
                                      );
                                      return (
                                        <tr
                                          key={perm.id}
                                          className="hover:bg-gray-50 dark:hover:bg-slate-700/30"
                                        >
                                          <td className="px-3 py-3">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                              {perm.name}
                                            </span>
                                          </td>
                                          <td className="px-3 py-3">
                                            <code className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                                              {perm.code}
                                            </code>
                                          </td>
                                          <td className="px-3 py-3 text-sm text-gray-500 dark:text-slate-400">
                                            {perm.description || '-'}
                                          </td>
                                          <td className="px-3 py-3">
                                            <div className="flex flex-wrap gap-1">
                                              {rolesWithPerm.length === 0 ? (
                                                <span className="text-xs text-gray-400">None</span>
                                              ) : (
                                                rolesWithPerm.slice(0, 3).map((role: Role) => (
                                                  <span
                                                    key={role.id}
                                                    className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                                  >
                                                    {role.name}
                                                  </span>
                                                ))
                                              )}
                                              {rolesWithPerm.length > 3 && (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-300">
                                                  +{rolesWithPerm.length - 3} more
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit' && (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              {auditLogs.length === 0 ? (
                <div className="p-12 text-center">
                  <ClipboardDocumentListIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
                  <p className="text-gray-600 dark:text-slate-400">No audit logs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          Entity
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {auditLogs.map((log: AuditLog) => (
                        <tr
                          key={log.id}
                          className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-300">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={clsx(
                                'px-2.5 py-1 rounded-full text-xs font-medium',
                                log.action.includes('CREATE')
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : log.action.includes('DELETE')
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : log.action.includes('UPDATE') || log.action.includes('ASSIGN')
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-slate-600 dark:text-slate-300'
                              )}
                            >
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {log.entityType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {log.user
                                ? `${log.user.firstName} ${log.user.lastName}`
                                : 'System'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">
                              {log.user?.email || ''}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400 max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showRoleModal && (
        <RoleModal
          role={selectedRole}
          permissions={permissions}
          onClose={() => {
            setShowRoleModal(false);
            setSelectedRole(null);
          }}
          onSuccess={() => {
            setShowRoleModal(false);
            setSelectedRole(null);
          }}
        />
      )}

      {showUserModal && selectedUser && (
        <UserRoleModal
          user={selectedUser}
          roles={roles}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {showDeleteModal && roleToDelete && (
        <DeleteConfirmModal
          title="Delete Role"
          message={`Are you sure you want to delete the role "${roleToDelete.name}"? This action cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(roleToDelete.id)}
          onCancel={() => {
            setShowDeleteModal(false);
            setRoleToDelete(null);
          }}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
