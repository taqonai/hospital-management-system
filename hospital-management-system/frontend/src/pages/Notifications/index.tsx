import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BellIcon,
  CheckIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  BeakerIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'APPOINTMENT' | 'LAB_RESULT' | 'PRESCRIPTION' | 'ALERT' | 'SYSTEM' | 'AI_INSIGHT' | 'EMERGENCY' | 'BILLING' | 'TEAM_BROADCAST';
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const typeConfig: Record<string, { icon: typeof BellIcon; color: string; bgColor: string; label: string }> = {
  APPOINTMENT: { icon: CalendarIcon, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Appointment' },
  LAB_RESULT: { icon: BeakerIcon, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Lab Result' },
  PRESCRIPTION: { icon: SparklesIcon, color: 'text-teal-600', bgColor: 'bg-teal-100', label: 'Prescription' },
  ALERT: { icon: ExclamationTriangleIcon, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Alert' },
  SYSTEM: { icon: CpuChipIcon, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'System' },
  AI_INSIGHT: { icon: SparklesIcon, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'AI Insight' },
  EMERGENCY: { icon: ExclamationTriangleIcon, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Emergency' },
  BILLING: { icon: CurrencyDollarIcon, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Billing' },
  TEAM_BROADCAST: { icon: BellIcon, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Broadcast' },
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HOSPITAL_ADMIN';

  const fetchNotifications = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: pagination.limit };
      if (selectedType) params.type = selectedType;
      if (showUnreadOnly) params.unreadOnly = true;

      const response = await api.get('/notifications', { params });
      const data = response.data.data;
      setNotifications(data.data || []);
      setPagination({
        page: data.pagination.page,
        limit: data.pagination.limit,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      });
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [selectedType, showUnreadOnly]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchNotifications(pagination.page);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            >
              <CheckIcon className="h-4 w-4" />
              Mark all read
            </button>
          )}
          {isAdmin && (
            <Link
              to="/settings/notifications"
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              Settings
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Types</option>
            {Object.entries(typeConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Unread only</span>
          </label>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BellIcon className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm text-gray-400 mt-1">
              {showUnreadOnly ? 'No unread notifications' : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const config = typeConfig[notification.type] || typeConfig.SYSTEM;
              const Icon = config.icon;

              return (
                <div
                  key={notification.id}
                  className={`
                    relative px-6 py-4 transition-colors hover:bg-gray-50
                    ${!notification.isRead ? 'bg-blue-50/30' : ''}
                  `}
                >
                  <div className="flex gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </p>
                            <span className={`px-2 py-0.5 text-[10px] font-medium ${config.bgColor} ${config.color} rounded-full`}>
                              {config.label}
                            </span>
                            {!notification.isRead && (
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {format(new Date(notification.createdAt), 'MMM d, yyyy h:mm a')}
                            <span className="mx-2">•</span>
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Mark as read"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchNotifications(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchNotifications(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
