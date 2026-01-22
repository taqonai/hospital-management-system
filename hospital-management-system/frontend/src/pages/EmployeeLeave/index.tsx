import { useState, useEffect } from 'react';
import {
  CalendarDaysIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { hrApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string;
  shift?: {
    name: string;
  };
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  defaultDays: number;
  isPaid: boolean;
  requiresDocument: boolean;
}

interface LeaveBalance {
  id: string;
  leaveType: LeaveType;
  year: number;
  entitled: number;
  taken: number;
  pending: number;
  balance: number;
}

interface LeaveRequest {
  id: string;
  leaveType: {
    id: string;
    name: string;
    code: string;
  };
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  appliedAt: string;
  approvedAt?: string;
  rejectionReason?: string;
}

// Status badge configuration
const statusConfig: Record<string, { dot: string; bg: string; text: string }> = {
  PENDING: { dot: 'bg-yellow-500', bg: 'bg-yellow-100/60', text: 'text-yellow-700' },
  APPROVED: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700' },
  REJECTED: { dot: 'bg-red-500', bg: 'bg-red-100/60', text: 'text-red-700' },
  WITHDRAWN: { dot: 'bg-gray-500', bg: 'bg-gray-100/60', text: 'text-gray-700' },
  CANCELLED: { dot: 'bg-gray-500', bg: 'bg-gray-100/60', text: 'text-gray-700' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status] || statusConfig.PENDING;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      {status}
    </span>
  );
};

// Leave Balance Card Component
const LeaveBalanceCard = ({ balance }: { balance: LeaveBalance }) => {
  const usedPercentage = balance.entitled > 0
    ? Math.round(((Number(balance.taken) + Number(balance.pending)) / Number(balance.entitled)) * 100)
    : 0;

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">{balance.leaveType.name}</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {balance.leaveType.code}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Entitled</span>
          <span className="font-medium">{Number(balance.entitled)} days</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Taken</span>
          <span className="font-medium text-red-600">{Number(balance.taken)} days</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Pending</span>
          <span className="font-medium text-yellow-600">{Number(balance.pending)} days</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
          <span className="text-gray-600 font-medium">Available</span>
          <span className="font-semibold text-green-600">{Number(balance.balance)} days</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={clsx(
              'h-2 rounded-full transition-all',
              usedPercentage >= 90 ? 'bg-red-500' : usedPercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
            )}
            style={{ width: `${Math.min(usedPercentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1 text-right">{usedPercentage}% used</p>
      </div>
    </div>
  );
};

// Leave Application Form Component
const LeaveApplicationForm = ({
  employeeId,
  leaveTypes,
  balances,
  onSuccess,
  onCancel,
}: {
  employeeId: string;
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  onSuccess: () => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    isEmergency: false,
    contactNumber: '',
    handoverTo: '',
    handoverNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(null);

  // Update selected balance when leave type changes
  useEffect(() => {
    if (formData.leaveTypeId) {
      const balance = balances.find(b => b.leaveType.id === formData.leaveTypeId);
      setSelectedBalance(balance || null);
    } else {
      setSelectedBalance(null);
    }
  }, [formData.leaveTypeId, balances]);

  // Calculate days between dates
  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  };

  const daysRequested = calculateDays();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.leaveTypeId || !formData.startDate || !formData.endDate || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (daysRequested <= 0) {
      toast.error('End date must be after start date');
      return;
    }

    if (selectedBalance && daysRequested > Number(selectedBalance.balance)) {
      toast.error(`Insufficient leave balance. Available: ${Number(selectedBalance.balance)} days`);
      return;
    }

    setSubmitting(true);
    try {
      await hrApi.applyLeave({
        employeeId,
        leaveTypeId: formData.leaveTypeId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        isEmergency: formData.isEmergency,
        contactNumber: formData.contactNumber || undefined,
        handoverTo: formData.handoverTo || undefined,
        handoverNotes: formData.handoverNotes || undefined,
      });
      toast.success('Leave request submitted successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Apply for Leave</h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircleIcon className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leave Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.leaveTypeId}
              onChange={e => setFormData({ ...formData, leaveTypeId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select leave type</option>
              {leaveTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.code})
                </option>
              ))}
            </select>
            {selectedBalance && (
              <p className="mt-1 text-xs text-gray-500">
                Available: <span className="font-medium text-green-600">{Number(selectedBalance.balance)} days</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isEmergency}
                onChange={e => setFormData({ ...formData, isEmergency: e.target.checked })}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Emergency Leave</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={e => setFormData({ ...formData, endDate: e.target.value })}
              min={formData.startDate || new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            {daysRequested > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Duration: <span className="font-medium">{daysRequested} day{daysRequested > 1 ? 's' : ''}</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.reason}
            onChange={e => setFormData({ ...formData, reason: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Please provide a reason for your leave request..."
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact Number
            </label>
            <input
              type="tel"
              value={formData.contactNumber}
              onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+1234567890"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Handover To (Employee Code/Name)
            </label>
            <input
              type="text"
              value={formData.handoverTo}
              onChange={e => setFormData({ ...formData, handoverTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter colleague name or code"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Handover Notes
          </label>
          <textarea
            value={formData.handoverNotes}
            onChange={e => setFormData({ ...formData, handoverNotes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any pending tasks or notes for the person covering your duties..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {submitting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
            Submit Request
          </button>
        </div>
      </form>
    </div>
  );
};

// Leave Requests List Component
const LeaveRequestsList = ({
  requests,
  onWithdraw,
  loading,
}: {
  requests: LeaveRequest[];
  onWithdraw: (id: string) => void;
  loading: boolean;
}) => {
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const handleWithdraw = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this leave request?')) return;

    setWithdrawingId(id);
    try {
      await hrApi.withdrawLeaveRequest(id);
      toast.success('Leave request withdrawn successfully');
      onWithdraw(id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to withdraw leave request');
    } finally {
      setWithdrawingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm text-center">
        <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">No Leave Requests</h3>
        <p className="text-gray-500 text-sm mt-1">You haven't applied for any leave yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50/50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Leave Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Days
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Applied On
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requests.map(request => (
              <tr key={request.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{request.leaveType.name}</p>
                    <p className="text-xs text-gray-500">{request.leaveType.code}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
                    {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {Number(request.days)} day{Number(request.days) > 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={request.status} />
                  {request.rejectionReason && (
                    <p className="text-xs text-red-500 mt-1">{request.rejectionReason}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(request.appliedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {request.status === 'PENDING' && (
                    <button
                      onClick={() => handleWithdraw(request.id)}
                      disabled={withdrawingId === request.id}
                      className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50 flex items-center gap-1 ml-auto"
                    >
                      {withdrawingId === request.id ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircleIcon className="w-4 h-4" />
                      )}
                      Withdraw
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Main Employee Leave Page
export default function EmployeeLeavePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch employee info and balances
      const [balanceRes, requestsRes, leaveTypesRes] = await Promise.all([
        hrApi.getMyLeaveBalance(),
        hrApi.getMyLeaveRequests({ status: statusFilter || undefined }),
        hrApi.getLeaveTypes(),
      ]);

      if (balanceRes.data.data?.employee) {
        setEmployee(balanceRes.data.data.employee);
        setBalances(balanceRes.data.data.balances || []);
      }

      setRequests(requestsRes.data.data?.requests || []);
      setLeaveTypes(leaveTypesRes.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch leave data:', error);
      if (error.response?.status !== 404) {
        toast.error('Failed to load leave data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleApplicationSuccess = () => {
    setShowApplicationForm(false);
    fetchData();
  };

  const handleWithdraw = () => {
    fetchData();
  };

  if (loading && !employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-40 bg-gray-200 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl p-8 shadow-sm text-center">
            <ExclamationTriangleIcon className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Employee Record Found</h2>
            <p className="text-gray-600 mb-4">
              Your user account is not linked to an employee record. Please contact HR to set up your employee profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Leave</h1>
            <p className="text-gray-600 text-sm">
              {employee.firstName} {employee.lastName} ({employee.employeeCode}) - {employee.designation}
            </p>
          </div>

          <button
            onClick={() => setShowApplicationForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            Apply for Leave
          </button>
        </div>

        {/* Leave Application Form */}
        {showApplicationForm && (
          <LeaveApplicationForm
            employeeId={employee.id}
            leaveTypes={leaveTypes}
            balances={balances}
            onSuccess={handleApplicationSuccess}
            onCancel={() => setShowApplicationForm(false)}
          />
        )}

        {/* Leave Balances */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leave Balances</h2>
          {balances.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {balances.map(balance => (
                <LeaveBalanceCard key={balance.id} balance={balance} />
              ))}
            </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm text-center">
              <p className="text-gray-500">No leave balances available. Please contact HR to initialize your leave entitlements.</p>
            </div>
          )}
        </div>

        {/* Leave Requests */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Leave Requests</h2>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
              <button
                onClick={fetchData}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <LeaveRequestsList
            requests={requests}
            onWithdraw={handleWithdraw}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
