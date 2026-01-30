import { useState, useEffect, useRef, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import {
  BellIcon,
  CalendarIcon,
  BeakerIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';
import { patientPortalApi } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'APPOINTMENT' | 'LAB_RESULT' | 'PRESCRIPTION' | 'ALERT' | 'SYSTEM' | 'AI_INSIGHT' | 'EMERGENCY' | 'BILLING' | 'TEAM_BROADCAST';
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

const typeConfig: Record<string, { icon: typeof BellIcon; color: string; bgColor: string }> = {
  APPOINTMENT: { icon: CalendarIcon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  LAB_RESULT: { icon: BeakerIcon, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  PRESCRIPTION: { icon: SparklesIcon, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  ALERT: { icon: ExclamationTriangleIcon, color: 'text-red-600', bgColor: 'bg-red-100' },
  SYSTEM: { icon: CpuChipIcon, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  AI_INSIGHT: { icon: SparklesIcon, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  EMERGENCY: { icon: ExclamationTriangleIcon, color: 'text-red-600', bgColor: 'bg-red-100' },
  BILLING: { icon: CurrencyDollarIcon, color: 'text-green-600', bgColor: 'bg-green-100' },
  TEAM_BROADCAST: { icon: BellIcon, color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

export default function PatientNotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await patientPortalApi.getNotifications({ limit: 10, unreadOnly: false });
      setNotifications(response.data.data.data || []);
      setUnreadCount(response.data.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch patient notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await patientPortalApi.getUnreadNotificationCount();
      setUnreadCount(response.data.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch patient unread count:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    pollIntervalRef.current = setInterval(fetchUnreadCount, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      await patientPortalApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await patientPortalApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return (
    <Menu as="div" className="relative">
      {({ open }) => {
        if (open !== isOpen) {
          setIsOpen(open);
        }

        return (
          <>
            <Menu.Button className="relative p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2">
              {unreadCount > 0 ? (
                <BellIconSolid className="h-5 w-5 text-teal-600" />
              ) : (
                <BellIcon className="h-5 w-5" />
              )}
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </span>
              )}
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-150"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-96 origin-top-right rounded-2xl bg-white shadow-xl ring-1 ring-black/5 focus:outline-none overflow-hidden z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium text-teal-600 bg-teal-100 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs font-medium text-teal-600 hover:text-teal-700"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-teal-600" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                      <BellIcon className="h-12 w-12 text-gray-300 mb-2" />
                      <p className="text-sm font-medium">No notifications</p>
                      <p className="text-xs text-gray-400">You're all caught up!</p>
                    </div>
                  ) : (
                    <div>
                      {notifications.map((notification) => {
                        const config = typeConfig[notification.type] || typeConfig.SYSTEM;
                        const Icon = config.icon;

                        return (
                          <Menu.Item key={notification.id}>
                            {({ active }) => (
                              <div
                                onClick={() => !notification.isRead && markAsRead(notification.id)}
                                className={`
                                  relative px-4 py-3 cursor-pointer transition-colors
                                  ${active ? 'bg-gray-50' : ''}
                                  ${!notification.isRead ? 'bg-teal-50/50' : ''}
                                `}
                              >
                                <div className="flex gap-3">
                                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                                    <Icon className={`h-5 w-5 ${config.color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                                        {notification.title}
                                      </p>
                                      {!notification.isRead && (
                                        <span className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" />
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                                      {notification.message}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Menu.Item>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 p-2">
                  <Link
                    to="/patient-portal/messages"
                    className="block w-full px-4 py-2 text-center text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
                  >
                    View all notifications
                  </Link>
                </div>
              </Menu.Items>
            </Transition>
          </>
        );
      }}
    </Menu>
  );
}
