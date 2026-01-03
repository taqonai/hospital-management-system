import { useState, useEffect } from 'react';
import {
  UsersIcon,
  ClockIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { hrApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  department?: {
    name: string;
  };
  designation: string;
  employeeType: string;
  employmentStatus: string;
  shift?: {
    name: string;
  };
  joiningDate: string;
}

interface Attendance {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  date: string;
  checkIn: string;
  checkOut?: string;
  status: string;
  workHours?: number;
  isLate: boolean;
}

interface LeaveRequest {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  leaveType: {
    name: string;
  };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
}

interface Payroll {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  month: number;
  year: number;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
}

interface HRStats {
  totalEmployees: number;
  activeEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  pendingLeaveRequests: number;
  pendingPayrolls: number;
}

// Glass-styled status badges with colored dots
const statusConfig: Record<string, { dot: string; bg: string; text: string }> = {
  ACTIVE: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700' },
  INACTIVE: { dot: 'bg-gray-500', bg: 'bg-gray-100/60', text: 'text-gray-700' },
  ON_LEAVE: { dot: 'bg-yellow-500', bg: 'bg-yellow-100/60', text: 'text-yellow-700' },
  TERMINATED: { dot: 'bg-red-500', bg: 'bg-red-100/60', text: 'text-red-700' },
  PRESENT: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700' },
  ABSENT: { dot: 'bg-red-500', bg: 'bg-red-100/60', text: 'text-red-700' },
  LATE: { dot: 'bg-orange-500', bg: 'bg-orange-100/60', text: 'text-orange-700' },
  HALF_DAY: { dot: 'bg-yellow-500', bg: 'bg-yellow-100/60', text: 'text-yellow-700' },
  PENDING: { dot: 'bg-yellow-500', bg: 'bg-yellow-100/60', text: 'text-yellow-700' },
  APPROVED: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700' },
  REJECTED: { dot: 'bg-red-500', bg: 'bg-red-100/60', text: 'text-red-700' },
  DRAFT: { dot: 'bg-gray-500', bg: 'bg-gray-100/60', text: 'text-gray-700' },
  PAID: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700' },
};

const employeeTypes: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
  CONSULTANT: 'Consultant',
};

// Glass status badge component
function GlassStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.DRAFT;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-gray-200',
      config.bg,
      config.text
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      {status.replace('_', ' ')}
    </span>
  );
}

// Add Employee Modal Component
function AddEmployeeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    designation: '',
    employeeType: 'FULL_TIME' as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'CONSULTANT',
    joiningDate: new Date().toISOString().split('T')[0],
    basicSalary: '',
    shiftId: '',
  });

  useEffect(() => {
    hrApi.getShifts().then(res => {
      setShifts(res.data.data || []);
    }).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await hrApi.createEmployee({
        ...formData,
        dateOfBirth: new Date(formData.dateOfBirth).toISOString(),
        joiningDate: new Date(formData.joiningDate).toISOString(),
        basicSalary: parseFloat(formData.basicSalary) || 0,
      });
      toast.success('Employee created successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add New Employee</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XCircleIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Gender *</label>
                <select
                  value={formData.gender}
                  onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Zip Code</label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={e => setFormData({ ...formData, zipCode: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Designation *</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={e => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Software Engineer"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Employee Type *</label>
                <select
                  value={formData.employeeType}
                  onChange={e => setFormData({ ...formData, employeeType: e.target.value as any })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                  <option value="CONSULTANT">Consultant</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Joining Date *</label>
                <input
                  type="date"
                  value={formData.joiningDate}
                  onChange={e => setFormData({ ...formData, joiningDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Shift</label>
                <select
                  value={formData.shiftId}
                  onChange={e => setFormData({ ...formData, shiftId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Shift</option>
                  {shifts.map(shift => (
                    <option key={shift.id} value={shift.id}>{shift.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Basic Salary</label>
                <input
                  type="number"
                  value={formData.basicSalary}
                  onChange={e => setFormData({ ...formData, basicSalary: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HR() {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leave' | 'payroll'>('employees');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [stats, setStats] = useState<HRStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    presentToday: 0,
    onLeaveToday: 0,
    pendingLeaveRequests: 0,
    pendingPayrolls: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch employees
  useEffect(() => {
    if (activeTab !== 'employees') return;

    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const response = await hrApi.getEmployees({
          page,
          limit: 20,
          status: statusFilter || undefined,
          department: departmentFilter || undefined,
          search: search || undefined,
        });
        setEmployees(response.data.data?.employees || []);
        if (response.data.data?.pagination) {
          setTotalPages(response.data.data.pagination.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch employees:', error);
        toast.error('Failed to load employees');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [activeTab, page, statusFilter, departmentFilter, search]);

  // Fetch attendance
  useEffect(() => {
    if (activeTab !== 'attendance') return;

    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const response = await hrApi.getAttendance({
          page,
          limit: 50,
          status: statusFilter || undefined,
        });
        setAttendance(response.data.data?.attendance || []);
        if (response.data.data?.pagination) {
          setTotalPages(response.data.data.pagination.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
        toast.error('Failed to load attendance records');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [activeTab, page, statusFilter]);

  // Fetch leave requests
  useEffect(() => {
    if (activeTab !== 'leave') return;

    const fetchLeave = async () => {
      try {
        setLoading(true);
        const response = await hrApi.getLeaveRequests({
          page,
          limit: 20,
          status: statusFilter || undefined,
        });
        setLeaveRequests(response.data.data?.leaveRequests || []);
        if (response.data.data?.pagination) {
          setTotalPages(response.data.data.pagination.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch leave requests:', error);
        toast.error('Failed to load leave requests');
      } finally {
        setLoading(false);
      }
    };

    fetchLeave();
  }, [activeTab, page, statusFilter]);

  // Fetch payrolls
  useEffect(() => {
    if (activeTab !== 'payroll') return;

    const fetchPayrolls = async () => {
      try {
        setLoading(true);
        const response = await hrApi.getPayrolls({
          page,
          limit: 20,
          status: statusFilter || undefined,
        });
        setPayrolls(response.data.data?.payrolls || []);
        if (response.data.data?.pagination) {
          setTotalPages(response.data.data.pagination.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch payrolls:', error);
        toast.error('Failed to load payroll records');
      } finally {
        setLoading(false);
      }
    };

    fetchPayrolls();
  }, [activeTab, page, statusFilter]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await hrApi.getDashboard();
        setStats(response.data.data || {
          totalEmployees: 0,
          activeEmployees: 0,
          presentToday: 0,
          onLeaveToday: 0,
          pendingLeaveRequests: 0,
          pendingPayrolls: 0,
        });
      } catch (error) {
        console.error('Failed to fetch HR stats:', error);
      }
    };

    fetchStats();
  }, []);

  const handleApproveLeave = async (id: string) => {
    try {
      await hrApi.processLeave(id, 'APPROVED');
      toast.success('Leave request approved');
      // Refresh leave requests
      const response = await hrApi.getLeaveRequests({ page, limit: 20, status: statusFilter || undefined });
      setLeaveRequests(response.data.data?.leaveRequests || []);
    } catch (error) {
      console.error('Failed to approve leave:', error);
      toast.error('Failed to approve leave request');
    }
  };

  const handleRejectLeave = async (id: string) => {
    try {
      await hrApi.processLeave(id, 'REJECTED', 'Rejected by HR');
      toast.success('Leave request rejected');
      // Refresh leave requests
      const response = await hrApi.getLeaveRequests({ page, limit: 20, status: statusFilter || undefined });
      setLeaveRequests(response.data.data?.leaveRequests || []);
    } catch (error) {
      console.error('Failed to reject leave:', error);
      toast.error('Failed to reject leave request');
    }
  };

  const handleProcessPayroll = async (id: string, action: string) => {
    try {
      await hrApi.processPayroll(id, action);
      toast.success(`Payroll ${action.toLowerCase()}d successfully`);
      // Refresh payrolls
      const response = await hrApi.getPayrolls({ page, limit: 20, status: statusFilter || undefined });
      setPayrolls(response.data.data?.payrolls || []);
    } catch (error) {
      console.error('Failed to process payroll:', error);
      toast.error('Failed to process payroll');
    }
  };

  const handleGeneratePayroll = async () => {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    try {
      const response = await hrApi.generatePayroll(month, year);
      toast.success(`Generated ${response.data.data?.length || 0} payroll records`);
      // Refresh payrolls
      const payrollResponse = await hrApi.getPayrolls({ page, limit: 20, status: statusFilter || undefined });
      setPayrolls(payrollResponse.data.data?.payrolls || []);
    } catch (error) {
      console.error('Failed to generate payroll:', error);
      toast.error('Failed to generate payroll');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const tabs = [
    { id: 'employees', label: 'Employees', icon: UsersIcon },
    { id: 'attendance', label: 'Attendance', icon: ClockIcon },
    { id: 'leave', label: 'Leave Management', icon: CalendarDaysIcon },
    { id: 'payroll', label: 'Payroll', icon: BanknotesIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 p-8 shadow-xl">
        {/* Floating Orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-teal-300/20 rounded-full blur-2xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white/90 text-sm font-medium mb-3">
              <UserGroupIcon className="h-4 w-4" />
              Human Resources
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">HR Management</h1>
            <p className="mt-2 text-teal-100">
              Manage employees, attendance, leave, and payroll
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'employees' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5" />
                Add Employee
              </button>
            )}
            {activeTab === 'payroll' && (
              <button
                onClick={handleGeneratePayroll}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                <BanknotesIcon className="h-5 w-5" />
                Generate Payroll
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards with Glassmorphism */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Employees', value: stats.totalEmployees, icon: UserGroupIcon, gradient: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: stats.activeEmployees, icon: CheckCircleIcon, gradient: 'from-green-500 to-green-600' },
          { label: 'Present Today', value: stats.presentToday, icon: ClockIcon, gradient: 'from-emerald-500 to-emerald-600' },
          { label: 'On Leave', value: stats.onLeaveToday, icon: CalendarDaysIcon, gradient: 'from-yellow-500 to-yellow-600' },
          { label: 'Pending Leave', value: stats.pendingLeaveRequests, icon: ExclamationTriangleIcon, gradient: 'from-orange-500 to-orange-600' },
          { label: 'Pending Payroll', value: stats.pendingPayrolls, icon: BanknotesIcon, gradient: 'from-purple-500 to-purple-600' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={clsx('p-2 rounded-lg bg-gradient-to-br', stat.gradient)}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Animated Gradient Tabs */}
      <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-2 shadow-lg">
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <nav className="flex space-x-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                setPage(1);
                setStatusFilter('');
              }}
              className={clsx(
                'relative flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filters */}
      <div
        className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg"
        style={{ animationDelay: '100ms' }}
      >
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
            >
              <option value="">All Status</option>
              {activeTab === 'employees' && (
                <>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ON_LEAVE">On Leave</option>
                </>
              )}
              {activeTab === 'attendance' && (
                <>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half Day</option>
                </>
              )}
              {activeTab === 'leave' && (
                <>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </>
              )}
              {activeTab === 'payroll' && (
                <>
                  <option value="DRAFT">Draft</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PAID">Paid</option>
                </>
              )}
            </select>
            {activeTab === 'employees' && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
              >
                <option value="">All Departments</option>
                <option value="HR">HR</option>
                <option value="Administration">Administration</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Security">Security</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Kitchen">Kitchen</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      {loading ? (
        <div
          className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-12 text-center shadow-lg"
          style={{ animationDelay: '150ms' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <ArrowPathIcon className="h-10 w-10 animate-spin mx-auto text-teal-500" />
          <p className="mt-3 text-gray-600">Loading...</p>
        </div>
      ) : (
        <>
          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div
              className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg"
              style={{ animationDelay: '150ms' }}
            >
              {/* Shine line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              {employees.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mb-4">
                    <UsersIcon className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-gray-600">No employees found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Shift
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {employees.map((employee, index) => (
                        <tr
                          key={employee.id}
                          className="hover:bg-gray-50 transition-colors"
                          style={{ animationDelay: `${(index + 1) * 50}ms` }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-md">
                                <span className="text-white font-medium text-sm">
                                  {employee.firstName[0]}{employee.lastName[0]}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {employee.firstName} {employee.lastName}
                                </div>
                                <div className="text-sm text-gray-500">{employee.employeeCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {employee.department?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {employee.designation}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {employeeTypes[employee.employeeType] || employee.employeeType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <GlassStatusBadge status={employee.employmentStatus} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {employee.shift?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium hover:from-teal-600 hover:to-cyan-600 transition-all hover:shadow-md">
                              View
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

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div
              className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg"
              style={{ animationDelay: '150ms' }}
            >
              {/* Shine line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              {attendance.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mb-4">
                    <ClockIcon className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-gray-600">No attendance records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Check In
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Check Out
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Work Hours
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {attendance.map((record, index) => (
                        <tr
                          key={record.id}
                          className="hover:bg-gray-50 transition-colors"
                          style={{ animationDelay: `${(index + 1) * 50}ms` }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {record.employee.firstName} {record.employee.lastName}
                              </div>
                              <div className="text-sm text-gray-500">{record.employee.employeeCode}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(record.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {record.checkIn ? new Date(record.checkIn).toLocaleTimeString() : '-'}
                            {record.isLate && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100/60 text-red-700 backdrop-blur-sm">
                                Late
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {record.checkOut ? new Date(record.checkOut).toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {record.workHours ? `${record.workHours.toFixed(1)} hrs` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <GlassStatusBadge status={record.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Leave Management Tab */}
          {activeTab === 'leave' && (
            <div
              className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg"
              style={{ animationDelay: '150ms' }}
            >
              {/* Shine line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              {leaveRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mb-4">
                    <CalendarDaysIcon className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-gray-600">No leave requests found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {leaveRequests.map((request, index) => (
                    <div
                      key={request.id}
                      className="p-5 hover:bg-gray-50 transition-colors"
                      style={{ animationDelay: `${(index + 1) * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-gray-900">
                              {request.employee.firstName} {request.employee.lastName}
                            </h3>
                            <GlassStatusBadge status={request.status} />
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {request.employee.employeeCode} | {request.leaveType.name}
                          </p>
                          <div className="mt-2 text-sm">
                            <span className="text-gray-700">
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </span>
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                              {request.totalDays} days
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-600">{request.reason}</p>
                        </div>
                        {request.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveLeave(request.id)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium hover:from-green-600 hover:to-emerald-600 transition-all hover:shadow-md hover:scale-105"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectLeave(request.id)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 text-white text-sm font-medium hover:from-red-600 hover:to-rose-600 transition-all hover:shadow-md hover:scale-105"
                            >
                              <XCircleIcon className="h-4 w-4" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payroll Tab */}
          {activeTab === 'payroll' && (
            <div
              className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg"
              style={{ animationDelay: '150ms' }}
            >
              {/* Shine line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              {payrolls.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mb-4">
                    <BanknotesIcon className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-gray-600 mb-4">No payroll records found</p>
                  <button
                    onClick={handleGeneratePayroll}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
                  >
                    <BanknotesIcon className="h-5 w-5" />
                    Generate This Month's Payroll
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Period
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Basic Salary
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Earnings
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Deductions
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Net Salary
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {payrolls.map((payroll, index) => (
                        <tr
                          key={payroll.id}
                          className="hover:bg-gray-50 transition-colors"
                          style={{ animationDelay: `${(index + 1) * 50}ms` }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {payroll.employee.firstName} {payroll.employee.lastName}
                              </div>
                              <div className="text-sm text-gray-500">{payroll.employee.employeeCode}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(payroll.year, payroll.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(payroll.basicSalary)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium">
                            +{formatCurrency(payroll.totalEarnings)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-medium">
                            -{formatCurrency(payroll.totalDeductions)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                            {formatCurrency(payroll.netSalary)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <GlassStatusBadge status={payroll.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {payroll.status === 'DRAFT' && (
                              <button
                                onClick={() => handleProcessPayroll(payroll.id, 'APPROVED')}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium hover:from-green-600 hover:to-emerald-600 transition-all hover:shadow-md"
                              >
                                Approve
                              </button>
                            )}
                            {payroll.status === 'APPROVED' && (
                              <button
                                onClick={() => handleProcessPayroll(payroll.id, 'PAID')}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium hover:from-teal-600 hover:to-cyan-600 transition-all hover:shadow-md"
                              >
                                Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex justify-center gap-3"
              style={{ animationDelay: '200ms' }}
            >
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-5 py-2.5 rounded-xl backdrop-blur-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md"
              >
                Previous
              </button>
              <span className="px-5 py-2.5 rounded-xl backdrop-blur-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium shadow-md">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-5 py-2.5 rounded-xl backdrop-blur-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Employee Modal with Form */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            // Refresh employees
            hrApi.getEmployees({ page: 1, limit: 10 }).then(res => {
              setEmployees(res.data.data || []);
            });
          }}
        />
      )}
    </div>
  );
}
