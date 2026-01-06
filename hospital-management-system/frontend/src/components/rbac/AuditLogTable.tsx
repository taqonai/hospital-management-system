import { useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface AuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'REVOKE' | 'LOGIN' | 'LOGOUT';
  entityType: string;
  entityId?: string;
  entityName?: string;
  performedBy: {
    id: string;
    name: string;
    email?: string;
    role?: string;
  };
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface AuditLogTableProps {
  logs: AuditLog[];
  loading?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

// Action badge configuration
const actionConfig: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  CREATE: {
    label: 'Created',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100/60 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  UPDATE: {
    label: 'Updated',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100/60 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  DELETE: {
    label: 'Deleted',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100/60 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  ASSIGN: {
    label: 'Assigned',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100/60 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  REVOKE: {
    label: 'Revoked',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100/60 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  LOGIN: {
    label: 'Login',
    color: 'text-cyan-700 dark:text-cyan-400',
    bgColor: 'bg-cyan-100/60 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
  },
  LOGOUT: {
    label: 'Logout',
    color: 'text-slate-700 dark:text-slate-400',
    bgColor: 'bg-slate-100/60 dark:bg-slate-900/30',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
};

// Action badge component
function ActionBadge({ action }: { action: string }) {
  const config = actionConfig[action] || {
    label: action,
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100/60 dark:bg-gray-900/30',
    borderColor: 'border-gray-200 dark:border-gray-800',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border',
        config.bgColor,
        config.color,
        config.borderColor
      )}
    >
      {config.label}
    </span>
  );
}

// Format date
function formatDateTime(dateString: string): { date: string; time: string } {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

// Time ago function
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDateTime(dateString).date;
}

// Expandable row component
function AuditLogRow({ log }: { log: AuditLog }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { date, time } = formatDateTime(log.createdAt);
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <>
      {/* Main Row */}
      <tr
        className={clsx(
          'transition-colors duration-200',
          hasDetails && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        {/* Date/Time */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700">
              <ClockIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {date}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {time} ({timeAgo(log.createdAt)})
              </div>
            </div>
          </div>
        </td>

        {/* Action */}
        <td className="px-6 py-4 whitespace-nowrap">
          <ActionBadge action={log.action} />
        </td>

        {/* Entity Type */}
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {log.entityType.replace(/_/g, ' ')}
          </span>
        </td>

        {/* Entity */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <DocumentTextIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="max-w-[200px]">
              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {log.entityName || 'N/A'}
              </div>
              {log.entityId && (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                  {log.entityId.slice(0, 8)}...
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Performed By */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <span className="text-white text-xs font-medium">
                {log.performedBy.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </span>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {log.performedBy.name}
              </div>
              {log.performedBy.role && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {log.performedBy.role.replace(/_/g, ' ')}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Expand Button */}
        <td className="px-6 py-4 whitespace-nowrap text-right">
          {hasDetails && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={clsx(
                'p-2 rounded-lg transition-all duration-200',
                'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
                'text-slate-500 dark:text-slate-400'
              )}
            >
              {isExpanded ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && hasDetails && (
        <tr>
          <td colSpan={6} className="px-6 pb-4">
            <div
              className={clsx(
                'p-4 rounded-xl border',
                'bg-slate-50/50 dark:bg-slate-900/30',
                'border-slate-200/50 dark:border-slate-700/50'
              )}
            >
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {log.details &&
                  Object.entries(log.details).map(([key, value]) => (
                    <div key={key} className="flex flex-col">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-900 dark:text-white mt-0.5">
                        {typeof value === 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                      </span>
                    </div>
                  ))}

                {log.ipAddress && (
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      IP Address
                    </span>
                    <span className="text-slate-900 dark:text-white mt-0.5 font-mono">
                      {log.ipAddress}
                    </span>
                  </div>
                )}

                {log.userAgent && (
                  <div className="flex flex-col md:col-span-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      User Agent
                    </span>
                    <span className="text-slate-900 dark:text-white mt-0.5 text-xs font-mono truncate">
                      {log.userAgent}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Pagination component
function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = [];
  const showPages = 5;
  let startPage = Math.max(1, page - Math.floor(showPages / 2));
  const endPage = Math.min(totalPages, startPage + showPages - 1);

  if (endPage - startPage + 1 < showPages) {
    startPage = Math.max(1, endPage - showPages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-200/50 dark:border-slate-700/50">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Page <span className="font-medium">{page}</span> of{' '}
        <span className="font-medium">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Previous */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={clsx(
            'p-2 rounded-lg transition-all duration-200',
            'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
            'text-slate-600 dark:text-slate-400',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        {/* Page Numbers */}
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
                'text-slate-600 dark:text-slate-400'
              )}
            >
              1
            </button>
            {startPage > 2 && (
              <span className="text-slate-400 dark:text-slate-500">...</span>
            )}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
              p === page
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400'
            )}
          >
            {p}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="text-slate-400 dark:text-slate-500">...</span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
                'text-slate-600 dark:text-slate-400'
              )}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={clsx(
            'p-2 rounded-lg transition-all duration-200',
            'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
            'text-slate-600 dark:text-slate-400',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AuditLogTable({
  logs,
  loading = false,
  page = 1,
  totalPages = 1,
  onPageChange,
  className = '',
}: AuditLogTableProps) {
  if (loading) {
    return (
      <div
        className={clsx(
          'relative overflow-hidden rounded-2xl backdrop-blur-xl border',
          'bg-white/70 dark:bg-slate-800/70',
          'border-white/50 dark:border-white/10',
          'shadow-lg',
          className
        )}
      >
        {/* Top shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="flex items-center justify-center py-16">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-slate-500 dark:text-slate-400">
            Loading audit logs...
          </span>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div
        className={clsx(
          'relative overflow-hidden rounded-2xl backdrop-blur-xl border',
          'bg-white/70 dark:bg-slate-800/70',
          'border-white/50 dark:border-white/10',
          'shadow-lg',
          className
        )}
      >
        {/* Top shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="flex flex-col items-center justify-center py-16">
          <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
            <DocumentTextIcon className="h-12 w-12 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
            No audit logs found
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Activity will appear here when actions are performed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border',
        'bg-white/70 dark:bg-slate-800/70',
        'border-white/50 dark:border-white/10',
        'shadow-lg',
        className
      )}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-700/50">
          <thead className="bg-slate-50/50 dark:bg-slate-900/30">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Entity Type
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Entity
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Performed By
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
            {logs.map((log) => (
              <AuditLogRow key={log.id} log={log} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {onPageChange && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

export default AuditLogTable;
