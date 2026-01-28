import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { format, formatDistanceToNow } from 'date-fns';

interface DeliveryLog {
  id: string;
  channel: string;
  recipient: string;
  recipientName: string | null;
  message: string;
  status: 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'CANCELLED';
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  externalMessageId: string | null;
  retryCount: number;
  createdAt: string;
  teamContact?: {
    name: string;
    role: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
  successRate: number;
}

const statusConfig: Record<string, { color: string; bgColor: string; icon: typeof CheckCircleIcon }> = {
  PENDING: { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: ClockIcon },
  QUEUED: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: ClockIcon },
  SENT: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: PaperAirplaneIcon },
  DELIVERED: { color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircleIcon },
  READ: { color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: CheckCircleIcon },
  FAILED: { color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircleIcon },
  CANCELLED: { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: XCircleIcon },
};

const channelConfig: Record<string, { icon: typeof DevicePhoneMobileIcon; label: string }> = {
  sms: { icon: DevicePhoneMobileIcon, label: 'SMS' },
  email: { icon: EnvelopeIcon, label: 'Email' },
  whatsapp: { icon: ChatBubbleLeftRightIcon, label: 'WhatsApp' },
  pager: { icon: DevicePhoneMobileIcon, label: 'Pager' },
  in_app: { icon: PaperAirplaneIcon, label: 'In-App' },
};

export default function DeliveryLogs() {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: pagination.limit };
      if (selectedChannel) params.channel = selectedChannel;
      if (selectedStatus) params.status = selectedStatus;

      const response = await api.get('/admin/notifications/delivery-logs', { params });
      const data = response.data.data;
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/notifications/delivery-logs/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [selectedChannel, selectedStatus]);

  const handleRetry = async (logId: string) => {
    setRetrying(logId);
    setMessage(null);
    try {
      const response = await api.post(`/admin/notifications/delivery-logs/${logId}/retry`);
      if (response.data.data.success) {
        setMessage({ type: 'success', text: 'Message retry successful!' });
      } else {
        setMessage({ type: 'error', text: response.data.data.error || 'Retry failed' });
      }
      fetchLogs(pagination.page);
      fetchStats();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to retry' });
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/settings/notifications"
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Delivery Logs</h1>
            <p className="text-gray-500 text-sm mt-1">Track notification delivery status</p>
          </div>
        </div>
        <button
          onClick={() => { fetchLogs(); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Alert Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-red-600" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500">Total Messages</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500">Success Rate</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.successRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500">Delivered</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {((stats.byStatus.SENT || 0) + (stats.byStatus.DELIVERED || 0)).toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500">Failed</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{(stats.byStatus.FAILED || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Channels</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="pager">Pager</option>
            <option value="in_app">In-App</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="DELIVERED">Delivered</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <PaperAirplaneIcon className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium">No delivery logs</p>
            <p className="text-sm text-gray-400 mt-1">Logs will appear when notifications are sent</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Recipient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const channel = channelConfig[log.channel] || channelConfig.sms;
                  const status = statusConfig[log.status] || statusConfig.PENDING;
                  const ChannelIcon = channel.icon;
                  const StatusIcon = status.icon;

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChannelIcon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900">{channel.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{log.recipient}</p>
                          {log.teamContact && (
                            <p className="text-xs text-gray-500">{log.teamContact.name} • {log.teamContact.role}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm text-gray-600 truncate" title={log.message}>
                          {log.message}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {log.status}
                          </span>
                          {log.retryCount > 0 && (
                            <span className="text-[10px] text-gray-400">({log.retryCount} retries)</span>
                          )}
                        </div>
                        {log.failureReason && (
                          <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={log.failureReason}>
                            {log.failureReason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-gray-900">
                            {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {log.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetry(log.id)}
                            disabled={retrying === log.id}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <ArrowPathIcon className={`h-3.5 w-3.5 ${retrying === log.id ? 'animate-spin' : ''}`} />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
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
