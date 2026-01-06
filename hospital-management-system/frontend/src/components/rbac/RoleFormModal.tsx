import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { rbacApi } from '../../services/api';
import { PermissionGrid, Permission } from './PermissionGrid';

export interface Role {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isSystem?: boolean;
  permissions: Permission[];
}

interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  role?: Role | null;
  onSuccess?: () => void;
}

export function RoleFormModal({ isOpen, onClose, role, onSuccess }: RoleFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  const isEditMode = !!role;

  // Load available permissions
  useEffect(() => {
    if (!isOpen) return;

    const loadPermissions = async () => {
      setLoadingPermissions(true);
      try {
        const response = await rbacApi.getAvailablePermissions();
        setAvailablePermissions(response.data.data || []);
      } catch (error) {
        console.error('Failed to load permissions:', error);
        toast.error('Failed to load permissions');
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || '');
      setSelectedPermissions(role.permissions.map((p) => p.id));
    } else {
      setName('');
      setDescription('');
      setSelectedPermissions([]);
    }
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Role name is required');
      return;
    }

    if (selectedPermissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        permissionIds: selectedPermissions,
      };

      if (isEditMode && role) {
        await rbacApi.updateRole(role.id, payload);
        toast.success('Role updated successfully');
      } else {
        await rbacApi.createRole(payload);
        toast.success('Role created successfully');
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        `Failed to ${isEditMode ? 'update' : 'create'} role`;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
            'relative w-full max-w-4xl max-h-[90vh] overflow-hidden',
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
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                <ShieldCheckIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {isEditMode ? 'Edit Role' : 'Create New Role'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isEditMode
                    ? 'Modify role settings and permissions'
                    : 'Define a new role with specific permissions'}
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
          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="role-name"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Role Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="role-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Senior Nurse, Lab Manager"
                      className={clsx(
                        'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
                      )}
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      htmlFor="role-description"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Description
                    </label>
                    <textarea
                      id="role-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the purpose and scope of this role..."
                      rows={3}
                      className={clsx(
                        'w-full px-4 py-3 rounded-xl border transition-all duration-200 resize-none',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Permissions Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Permissions <span className="text-red-500">*</span>
                </h3>

                {loadingPermissions ? (
                  <div className="flex items-center justify-center py-12">
                    <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="ml-3 text-slate-500 dark:text-slate-400">
                      Loading permissions...
                    </span>
                  </div>
                ) : (
                  <div
                    className={clsx(
                      'p-4 rounded-xl border',
                      'bg-slate-50/50 dark:bg-slate-900/30',
                      'border-slate-200/50 dark:border-slate-700/50'
                    )}
                  >
                    <PermissionGrid
                      permissions={availablePermissions}
                      selectedPermissions={selectedPermissions}
                      onChange={setSelectedPermissions}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
              <button
                type="button"
                onClick={onClose}
                className={clsx(
                  'px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                  'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
                  'text-slate-700 dark:text-slate-300'
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || loadingPermissions}
                className={clsx(
                  'px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                  'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700',
                  'text-white shadow-lg shadow-indigo-500/25',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'hover:scale-105 hover:shadow-xl'
                )}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </span>
                ) : isEditMode ? (
                  'Update Role'
                ) : (
                  'Create Role'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RoleFormModal;
