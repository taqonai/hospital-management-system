import { useState, useEffect } from 'react';
import {
  ClipboardDocumentCheckIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { insuranceCodingApi } from '../../services/api';

interface AuditEntry {
  id: string;
  patientId?: string;
  appointmentId?: string;
  action: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  dhaResponse?: Record<string, unknown>;
  reason?: string;
  performedBy: string;
  performedAt: string;
  ipAddress?: string;
  patient?: {
    firstName: string;
    lastName: string;
    mrn?: string;
  };
}

const actionLabels: Record<string, { label: string; color: string }> = {
  COPAY_COLLECTED: { label: 'Copay Collected', color: 'bg-green-100 text-green-800 border-green-200' },
  COPAY_WAIVED: { label: 'Copay Waived', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  COPAY_DEFERRED: { label: 'Copay Deferred', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  PREAUTH_OVERRIDE: { label: 'Pre-Auth Override', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  CONVERT_TO_SELFPAY: { label: 'Convert to Self-Pay', color: 'bg-red-100 text-red-800 border-red-200' },
};

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [filters, setFilters] = useState({
    action: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAuditLog();
  }, [pagination.page, filters.action, filters.startDate, filters.endDate]);

  const fetchAuditLog = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (filters.action) params.action = filters.action;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await insuranceCodingApi.getInsuranceAuditList(params);
      const data = response.data;
      setEntries(data.data || []);
      if (data.pagination) {
        setPagination(prev => ({ ...prev, total: data.pagination.total || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params: Record<string, string> = {};
      if (filters.action) params.action = filters.action;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await insuranceCodingApi.exportInsuranceAudit(params);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `insurance-audit-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Audit log exported');
    } catch (error) {
      console.error('Failed to export audit log:', error);
      toast.error('Failed to export audit log');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTJ2Mmgydi0yem0tNiAwSDI4djJoMnYtMnptMTIgMGgtMnYyaDJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Insurance Verification Audit</h1>
            <p className="mt-2 text-white/80">Track all copay decisions made during patient check-in</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-white/90 text-teal-600 font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="relative overflow-hidden backdrop-blur-xl bg-white/70 rounded-xl border border-gray-200/50 shadow-sm">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-700 hover:bg-gray-50/50"
        >
          <span className="flex items-center gap-2">
            <FunnelIcon className="h-4 w-4" />
            Filters
            {(filters.action || filters.startDate || filters.endDate) && (
              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs">Active</span>
            )}
          </span>
        </button>
        {showFilters && (
          <div className="p-4 pt-0 flex flex-wrap gap-4 border-t border-gray-200/50">
            <select
              value={filters.action}
              onChange={(e) => { setFilters(f => ({ ...f, action: e.target.value })); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">All Actions</option>
              <option value="COPAY_COLLECTED">Copay Collected</option>
              <option value="COPAY_WAIVED">Copay Waived</option>
              <option value="COPAY_DEFERRED">Copay Deferred</option>
              <option value="PREAUTH_OVERRIDE">Pre-Auth Override</option>
              <option value="CONVERT_TO_SELFPAY">Convert to Self-Pay</option>
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => { setFilters(f => ({ ...f, startDate: e.target.value })); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => { setFilters(f => ({ ...f, endDate: e.target.value })); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="End Date"
            />
            <button
              onClick={() => { setFilters({ action: '', startDate: '', endDate: '' }); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl border border-gray-200/50 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-200/40 to-transparent" />
        {loading ? (
          <div className="p-12 text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-teal-500" />
            <p className="mt-3 text-gray-500">Loading audit entries...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardDocumentCheckIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No audit entries found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/50 bg-gray-50/50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Date/Time</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Patient</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Details</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Performed By</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50">
                  {entries.map((entry) => {
                    const actionConfig = actionLabels[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-800 border-gray-200' };
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                          {new Date(entry.performedAt).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          <br />
                          <span className="text-xs text-gray-400">
                            {new Date(entry.performedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${actionConfig.color}`}>
                            {actionConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {entry.patient ? (
                            <div>
                              <span className="font-medium">{entry.patient.firstName} {entry.patient.lastName}</span>
                              {entry.patient.mrn && (
                                <span className="block text-xs text-gray-400">MRN: {entry.patient.mrn}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {entry.newData && (
                            <div className="text-xs text-gray-600 space-y-0.5">
                              {(entry.newData as Record<string, unknown>).amount && (
                                <div>Amount: <span className="font-medium">AED {Number((entry.newData as Record<string, unknown>).amount || 0).toFixed(2)}</span></div>
                              )}
                              {(entry.newData as Record<string, unknown>).paymentMethod && (
                                <div>Method: {String((entry.newData as Record<string, unknown>).paymentMethod)}</div>
                              )}
                              {(entry.newData as Record<string, unknown>).insuranceProvider && (
                                <div>Insurer: {String((entry.newData as Record<string, unknown>).insuranceProvider)}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{entry.performedBy}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate" title={entry.reason || ''}>
                          {entry.reason || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200/50">
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {totalPages} ({pagination.total} entries)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page >= totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
