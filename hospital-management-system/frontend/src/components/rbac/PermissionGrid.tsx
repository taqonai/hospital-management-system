import { useState, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  CheckIcon,
  MinusIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category: string;
}

interface PermissionGridProps {
  permissions: Permission[];
  selectedPermissions: string[];
  onChange?: (selectedPermissions: string[]) => void;
  readOnly?: boolean;
  className?: string;
}

// Category configuration for colors and icons
const categoryConfig: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  'Patient Management': {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100/60 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  'Appointments': {
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100/60 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  'Laboratory': {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100/60 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  'Pharmacy': {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100/60 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  'Radiology': {
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100/60 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
  },
  'Billing': {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100/60 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  'HR': {
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-100/60 dark:bg-pink-900/30',
    borderColor: 'border-pink-200 dark:border-pink-800',
  },
  'Administration': {
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100/60 dark:bg-indigo-900/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  'Reports': {
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100/60 dark:bg-teal-900/30',
    borderColor: 'border-teal-200 dark:border-teal-800',
  },
  'Settings': {
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100/60 dark:bg-slate-900/30',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
};

function getCategoryConfig(category: string) {
  return (
    categoryConfig[category] || {
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100/60 dark:bg-gray-900/30',
      borderColor: 'border-gray-200 dark:border-gray-800',
    }
  );
}

// Group permissions by category
function groupByCategory(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce((acc, permission) => {
    const category = permission.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);
}

// Custom checkbox component
function PermissionCheckbox({
  permission,
  checked,
  onChange,
  readOnly,
}: {
  permission: Permission;
  checked: boolean;
  onChange: (checked: boolean) => void;
  readOnly?: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={clsx(
        'relative group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
        'bg-white/50 dark:bg-slate-800/50',
        checked
          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
        !readOnly && 'cursor-pointer hover:shadow-md'
      )}
      onClick={() => !readOnly && onChange(!checked)}
    >
      {/* Checkbox */}
      <div
        className={clsx(
          'flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200',
          checked
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 border-transparent'
            : 'border-slate-300 dark:border-slate-600',
          !readOnly && !checked && 'group-hover:border-indigo-400'
        )}
      >
        {checked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
      </div>

      {/* Permission Name */}
      <div className="flex-1 min-w-0">
        <span
          className={clsx(
            'text-sm font-medium truncate',
            checked
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-700 dark:text-slate-300'
          )}
        >
          {permission.name.split(':').pop()}
        </span>
      </div>

      {/* Info Icon with Tooltip */}
      {permission.description && (
        <div
          className="relative flex-shrink-0"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <InformationCircleIcon className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" />

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute z-50 bottom-full right-0 mb-2 w-64 p-3 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs shadow-xl">
              <div className="font-medium mb-1">{permission.name}</div>
              <div className="text-slate-300">{permission.description}</div>
              {/* Arrow */}
              <div className="absolute bottom-0 right-3 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 dark:bg-slate-700" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Category header with select all
function CategoryHeader({
  category,
  permissions,
  selectedCount,
  onSelectAll,
  readOnly,
}: {
  category: string;
  permissions: Permission[];
  selectedCount: number;
  onSelectAll: (selectAll: boolean) => void;
  readOnly?: boolean;
}) {
  const config = getCategoryConfig(category);
  const isAllSelected = selectedCount === permissions.length;
  const isSomeSelected = selectedCount > 0 && selectedCount < permissions.length;

  return (
    <div
      className={clsx(
        'flex items-center justify-between p-4 rounded-xl border backdrop-blur-sm',
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-center gap-3">
        <div className={clsx('text-lg font-semibold', config.color)}>{category}</div>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
          {selectedCount}/{permissions.length}
        </span>
      </div>

      {!readOnly && (
        <button
          onClick={() => onSelectAll(!isAllSelected)}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
            isAllSelected
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
              : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'
          )}
        >
          <div
            className={clsx(
              'w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
              isAllSelected
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 border-transparent'
                : isSomeSelected
                ? 'bg-indigo-200 dark:bg-indigo-800 border-transparent'
                : 'border-slate-300 dark:border-slate-600'
            )}
          >
            {isAllSelected ? (
              <CheckIcon className="h-3 w-3 text-white" />
            ) : isSomeSelected ? (
              <MinusIcon className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
            ) : null}
          </div>
          {isAllSelected ? 'Deselect All' : 'Select All'}
        </button>
      )}
    </div>
  );
}

export function PermissionGrid({
  permissions,
  selectedPermissions,
  onChange,
  readOnly = false,
  className = '',
}: PermissionGridProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter permissions based on search
  const filteredPermissions = useMemo(() => {
    if (!searchQuery.trim()) return permissions;
    const query = searchQuery.toLowerCase();
    return permissions.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }, [permissions, searchQuery]);

  // Group filtered permissions by category
  const groupedPermissions = useMemo(
    () => groupByCategory(filteredPermissions),
    [filteredPermissions]
  );

  // Handle permission toggle
  const handlePermissionToggle = (permissionId: string, checked: boolean) => {
    if (!onChange) return;

    if (checked) {
      onChange([...selectedPermissions, permissionId]);
    } else {
      onChange(selectedPermissions.filter((id) => id !== permissionId));
    }
  };

  // Handle select all for a category
  const handleCategorySelectAll = (category: string, selectAll: boolean) => {
    if (!onChange) return;

    const categoryPermissionIds = groupedPermissions[category].map((p) => p.id);

    if (selectAll) {
      const newSelected = new Set([...selectedPermissions, ...categoryPermissionIds]);
      onChange(Array.from(newSelected));
    } else {
      onChange(selectedPermissions.filter((id) => !categoryPermissionIds.includes(id)));
    }
  };

  // Get selected count for a category
  const getCategorySelectedCount = (category: string) => {
    const categoryPermissionIds = groupedPermissions[category].map((p) => p.id);
    return categoryPermissionIds.filter((id) => selectedPermissions.includes(id)).length;
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search permissions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={clsx(
            'w-full pl-12 pr-4 py-3 rounded-xl border transition-all duration-200',
            'bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm',
            'border-slate-200 dark:border-slate-700',
            'text-slate-900 dark:text-white placeholder-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
          )}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
        <span>
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {selectedPermissions.length}
          </span>{' '}
          of{' '}
          <span className="font-semibold">{permissions.length}</span> permissions selected
        </span>
        {searchQuery && (
          <span className="text-slate-500">
            ({filteredPermissions.length} matches)
          </span>
        )}
      </div>

      {/* Permission Groups */}
      <div className="space-y-6">
        {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
          <div key={category} className="space-y-3">
            {/* Category Header */}
            <CategoryHeader
              category={category}
              permissions={categoryPermissions}
              selectedCount={getCategorySelectedCount(category)}
              onSelectAll={(selectAll) => handleCategorySelectAll(category, selectAll)}
              readOnly={readOnly}
            />

            {/* Permissions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-4">
              {categoryPermissions.map((permission) => (
                <PermissionCheckbox
                  key={permission.id}
                  permission={permission}
                  checked={selectedPermissions.includes(permission.id)}
                  onChange={(checked) => handlePermissionToggle(permission.id, checked)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredPermissions.length === 0 && (
        <div className="text-center py-12">
          <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-slate-500 dark:text-slate-400">
            No permissions found matching "{searchQuery}"
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}

export default PermissionGrid;
