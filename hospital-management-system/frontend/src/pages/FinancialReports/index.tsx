import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ChartPieIcon,
  DocumentChartBarIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  ArrowTrendingUpIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { financialReportsApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Date range selector
function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

// Write-off modal
function WriteOffModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    reason: '',
    category: 'BAD_DEBT',
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ invoiceId: '', amount: '', reason: '', category: 'BAD_DEBT', notes: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Create Write-Off Request</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice ID *
              </label>
              <input
                type="text"
                value={formData.invoiceId}
                onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="BAD_DEBT">Bad Debt</option>
                <option value="CHARITY_CARE">Charity Care</option>
                <option value="CONTRACTUAL_ADJUSTMENT">Contractual Adjustment</option>
                <option value="ADMINISTRATIVE_ERROR">Administrative Error</option>
                <option value="UNCOLLECTIBLE">Uncollectible</option>
                <option value="DECEASED_PATIENT">Deceased Patient</option>
                <option value="SMALL_BALANCE">Small Balance</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FinancialReports() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'ar-aging' | 'revenue' | 'collection' | 'writeoffs' | 'income-statement' | 'balance-sheet'
  >('overview');

  // Data states
  const [arAging, setArAging] = useState<any>(null);
  const [revenueDept, setRevenueDept] = useState<any[]>([]);
  const [revenueDoctor, setRevenueDoctor] = useState<any[]>([]);
  const [revenuePayer, setRevenuePayer] = useState<any[]>([]);
  const [collectionRate, setCollectionRate] = useState<any>(null);
  const [taxSummary, setTaxSummary] = useState<any>(null);
  const [writeOffSummary, setWriteOffSummary] = useState<any>(null);
  const [writeOffs, setWriteOffs] = useState<any[]>([]);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [bsAsOfDate, setBsAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  // Colors for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

  // Load data
  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        arData,
        deptData,
        doctorData,
        payerData,
        collectionData,
        taxData,
        writeOffData,
      ] = await Promise.all([
        financialReportsApi.getARAgingReport(endDate),
        financialReportsApi.getRevenueByDepartment(startDate, endDate),
        financialReportsApi.getRevenueByDoctor(startDate, endDate),
        financialReportsApi.getRevenueByPayer(startDate, endDate),
        financialReportsApi.getCollectionRate(startDate, endDate, 'month'),
        financialReportsApi.getTaxSummary(startDate, endDate),
        financialReportsApi.getWriteOffSummary(startDate, endDate),
      ]);

      setArAging(arData);
      setRevenueDept(deptData);
      setRevenueDoctor(doctorData);
      setRevenuePayer(payerData);
      setCollectionRate(collectionData);
      setTaxSummary(taxData);
      setWriteOffSummary(writeOffData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load financial reports');
    } finally {
      setLoading(false);
    }
  };

  const loadIncomeStatement = async () => {
    try {
      const data = await financialReportsApi.getIncomeStatement(startDate, endDate);
      setIncomeStatement(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load income statement');
    }
  };

  const loadBalanceSheet = async (date?: string) => {
    try {
      const data = await financialReportsApi.getBalanceSheet(date || bsAsOfDate);
      setBalanceSheet(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load balance sheet');
    }
  };

  // Load income statement/balance sheet when their tabs are selected
  useEffect(() => {
    if (activeTab === 'income-statement') loadIncomeStatement();
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    if (activeTab === 'balance-sheet') loadBalanceSheet();
  }, [activeTab, bsAsOfDate]);

  const loadWriteOffs = async () => {
    try {
      const data = await financialReportsApi.getWriteOffs({ page: 1, limit: 50 });
      setWriteOffs(data.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load write-offs');
    }
  };

  const handleExport = async (reportType: string) => {
    try {
      await financialReportsApi.exportReport(reportType, startDate, endDate);
      toast.success('Report exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export report');
    }
  };

  const handleCreateWriteOff = async (data: any) => {
    try {
      await financialReportsApi.createWriteOff(data);
      toast.success('Write-off request submitted successfully');
      setShowWriteOffModal(false);
      loadWriteOffs();
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create write-off');
    }
  };

  const handleWriteOffAction = async (id: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      if (action === 'approve') {
        await financialReportsApi.approveWriteOff(id, notes);
        toast.success('Write-off approved');
      } else {
        await financialReportsApi.rejectWriteOff(id, notes);
        toast.success('Write-off rejected');
      }
      loadWriteOffs();
      loadData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} write-off`);
    }
  };

  // AR Aging chart data
  const arAgingChartData = arAging
    ? [
        { name: 'Current', value: arAging.buckets.current },
        { name: '30-60 days', value: arAging.buckets.days30to60 },
        { name: '60-90 days', value: arAging.buckets.days60to90 },
        { name: '90+ days', value: arAging.buckets.days90plus },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive financial analytics and reporting</p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: DocumentChartBarIcon },
            { id: 'ar-aging', label: 'AR Aging', icon: ClockIcon },
            { id: 'revenue', label: 'Revenue Analysis', icon: ChartBarIcon },
            { id: 'collection', label: 'Collection Rate', icon: ArrowTrendingUpIcon },
            { id: 'writeoffs', label: 'Write-Offs', icon: ReceiptPercentIcon },
            { id: 'income-statement', label: 'Income Statement', icon: BanknotesIcon },
            { id: 'balance-sheet', label: 'Balance Sheet', icon: ChartPieIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <tab.icon className="mr-2 h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Outstanding</p>
                      <p className="text-2xl font-bold text-gray-900">
                        AED {arAging?.totalOutstanding.toLocaleString() || 0}
                      </p>
                    </div>
                    <ClockIcon className="h-10 w-10 text-yellow-500" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Collection Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {collectionRate?.overallCollectionRate.toFixed(1) || 0}%
                      </p>
                    </div>
                    <ArrowTrendingUpIcon className="h-10 w-10 text-green-500" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Tax</p>
                      <p className="text-2xl font-bold text-gray-900">
                        AED {taxSummary?.totalTax.toLocaleString() || 0}
                      </p>
                    </div>
                    <ReceiptPercentIcon className="h-10 w-10 text-blue-500" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Write-Offs</p>
                      <p className="text-2xl font-bold text-gray-900">
                        AED {writeOffSummary?.totalWriteOff.toLocaleString() || 0}
                      </p>
                    </div>
                    <XCircleIcon className="h-10 w-10 text-red-500" />
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AR Aging */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">AR Aging</h3>
                    <button
                      onClick={() => handleExport('ar-aging')}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5 inline mr-1" />
                      Export
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={arAgingChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue by Payer */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Revenue by Payer</h3>
                    <button
                      onClick={() => handleExport('revenue-payer')}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5 inline mr-1" />
                      Export
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={revenuePayer}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {revenuePayer.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* AR Aging Tab */}
          {activeTab === 'ar-aging' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">AR Aging Report</h3>
                    <button
                      onClick={() => handleExport('ar-aging')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                      Export CSV
                    </button>
                  </div>

                  {/* AR Aging Chart */}
                  <div className="mb-8">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={arAgingChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" fill="#3B82F6" name="Outstanding Amount (AED)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Details Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Invoice
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Patient
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Days Overdue
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Bucket
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {arAging?.details.slice(0, 20).map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {item.invoiceNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.patientName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              AED {item.totalAmount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              AED {item.balanceAmount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.daysOverdue} days
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {item.bucket}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && (
            <div className="space-y-6">
              {/* Revenue by Department */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Revenue by Department</h3>
                  <button
                    onClick={() => handleExport('revenue-department')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Export CSV
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={revenueDept}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10B981" name="Revenue (AED)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue by Doctor */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Top Revenue-Generating Doctors</h3>
                  <button
                    onClick={() => handleExport('revenue-doctor')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Doctor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Specialization
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Invoices
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {revenueDoctor.map((doctor, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {doctor.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {doctor.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            AED {doctor.revenue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {doctor.invoiceCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {doctor.percentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Collection Rate Tab */}
          {activeTab === 'collection' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Collection Rate Trend</h3>
                <button
                  onClick={() => handleExport('collection-rate')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Export CSV
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Total Billed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    AED {collectionRate?.totalBilled.toLocaleString() || 0}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Total Collected</p>
                  <p className="text-2xl font-bold text-gray-900">
                    AED {collectionRate?.totalCollected.toLocaleString() || 0}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Collection Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {collectionRate?.overallCollectionRate.toFixed(1) || 0}%
                  </p>
                </div>
              </div>

              {/* Trend Chart */}
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={collectionRate?.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="collectionRate"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    name="Collection Rate (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Write-Offs Tab */}
          {activeTab === 'writeoffs' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600">Total Write-Offs</p>
                    <p className="text-2xl font-bold">
                      AED {writeOffSummary?.totalWriteOff.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600">Write-Off Count</p>
                    <p className="text-2xl font-bold">{writeOffSummary?.writeOffCount || 0}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowWriteOffModal(true);
                      loadWriteOffs();
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <PlusIcon className="h-5 w-5" />
                    New Write-Off
                  </button>
                </div>
              </div>

              {/* Write-Offs Table */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Write-Off Requests</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Invoice
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Reason
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {writeOffs.map((wo: any) => (
                          <tr key={wo.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {wo.invoice?.invoiceNumber || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              AED {Number(wo.amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {wo.category}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{wo.reason}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={clsx(
                                  'px-2 py-1 text-xs font-medium rounded-full',
                                  wo.status === 'PENDING' && 'bg-yellow-100 text-yellow-800',
                                  wo.status === 'APPROVED' && 'bg-green-100 text-green-800',
                                  wo.status === 'REJECTED' && 'bg-red-100 text-red-800'
                                )}
                              >
                                {wo.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {wo.status === 'PENDING' && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleWriteOffAction(wo.id, 'approve')}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <CheckCircleIcon className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={() => handleWriteOffAction(wo.id, 'reject')}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <XCircleIcon className="h-5 w-5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Income Statement Tab */}
          {activeTab === 'income-statement' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Income Statement</h3>
                  <button
                    onClick={() => financialReportsApi.exportXLSX('income-statement', { startDate, endDate })}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Export XLSX
                  </button>
                </div>

                {incomeStatement ? (
                  <div className="space-y-8">
                    {/* Revenue vs Expenses Chart */}
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          { name: 'Revenue', amount: incomeStatement.totalRevenue },
                          { name: 'Expenses', amount: incomeStatement.totalExpenses },
                          { name: 'Net Income', amount: incomeStatement.netIncome },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="amount" name="Amount (AED)">
                          <Cell fill="#10B981" />
                          <Cell fill="#EF4444" />
                          <Cell fill={incomeStatement.netIncome >= 0 ? '#3B82F6' : '#F59E0B'} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Revenue Section */}
                    <div>
                      <h4 className="text-md font-semibold text-green-700 mb-3">Revenue</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-green-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount (AED)</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {incomeStatement.revenue.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-6 py-3 text-sm text-gray-500">{item.accountCode}</td>
                                <td className="px-6 py-3 text-sm text-gray-900">{item.accountName}</td>
                                <td className="px-6 py-3 text-sm text-right text-green-700 font-medium">
                                  {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-green-50 font-bold">
                              <td className="px-6 py-3" colSpan={2}>Total Revenue</td>
                              <td className="px-6 py-3 text-right text-green-700">
                                {incomeStatement.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Expenses Section */}
                    <div>
                      <h4 className="text-md font-semibold text-red-700 mb-3">Expenses</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-red-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount (AED)</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {incomeStatement.expenses.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-6 py-3 text-sm text-gray-500">{item.accountCode}</td>
                                <td className="px-6 py-3 text-sm text-gray-900">{item.accountName}</td>
                                <td className="px-6 py-3 text-sm text-right text-red-700 font-medium">
                                  {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-red-50 font-bold">
                              <td className="px-6 py-3" colSpan={2}>Total Expenses</td>
                              <td className="px-6 py-3 text-right text-red-700">
                                {incomeStatement.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Net Income */}
                    <div className={clsx(
                      'p-6 rounded-lg text-center',
                      incomeStatement.netIncome >= 0 ? 'bg-blue-50' : 'bg-yellow-50'
                    )}>
                      <p className="text-sm text-gray-600 mb-1">Net Income</p>
                      <p className={clsx(
                        'text-3xl font-bold',
                        incomeStatement.netIncome >= 0 ? 'text-blue-700' : 'text-yellow-700'
                      )}>
                        AED {incomeStatement.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No data available for the selected period.</p>
                )}
              </div>
            </div>
          )}

          {/* Balance Sheet Tab */}
          {activeTab === 'balance-sheet' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">Balance Sheet</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">As of Date</label>
                      <input
                        type="date"
                        value={bsAsOfDate}
                        onChange={(e) => setBsAsOfDate(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => financialReportsApi.exportXLSX('balance-sheet', { asOfDate: bsAsOfDate })}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Export XLSX
                  </button>
                </div>

                {balanceSheet ? (
                  <div className="space-y-8">
                    {/* Balanced Indicator */}
                    <div className={clsx(
                      'flex items-center gap-2 p-3 rounded-lg',
                      balanceSheet.isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    )}>
                      {balanceSheet.isBalanced ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        <XCircleIcon className="h-5 w-5" />
                      )}
                      <span className="font-medium">
                        {balanceSheet.isBalanced
                          ? 'Balanced — Assets = Liabilities + Equity'
                          : 'Not Balanced — Assets ≠ Liabilities + Equity'}
                      </span>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Total Assets</p>
                        <p className="text-2xl font-bold text-blue-700">
                          AED {balanceSheet.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Total Liabilities</p>
                        <p className="text-2xl font-bold text-orange-700">
                          AED {balanceSheet.totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Total Equity</p>
                        <p className="text-2xl font-bold text-purple-700">
                          AED {balanceSheet.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Assets Section */}
                    <div>
                      <h4 className="text-md font-semibold text-blue-700 mb-3">Assets</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance (AED)</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {balanceSheet.assets.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-6 py-3 text-sm text-gray-500">{item.accountCode}</td>
                                <td className="px-6 py-3 text-sm text-gray-900">{item.accountName}</td>
                                <td className="px-6 py-3 text-sm text-right font-medium">
                                  {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-blue-50 font-bold">
                              <td className="px-6 py-3" colSpan={2}>Total Assets</td>
                              <td className="px-6 py-3 text-right text-blue-700">
                                {balanceSheet.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Liabilities Section */}
                    <div>
                      <h4 className="text-md font-semibold text-orange-700 mb-3">Liabilities</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-orange-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance (AED)</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {balanceSheet.liabilities.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-6 py-3 text-sm text-gray-500">{item.accountCode}</td>
                                <td className="px-6 py-3 text-sm text-gray-900">{item.accountName}</td>
                                <td className="px-6 py-3 text-sm text-right font-medium">
                                  {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-orange-50 font-bold">
                              <td className="px-6 py-3" colSpan={2}>Total Liabilities</td>
                              <td className="px-6 py-3 text-right text-orange-700">
                                {balanceSheet.totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Equity Section */}
                    <div>
                      <h4 className="text-md font-semibold text-purple-700 mb-3">Equity</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-purple-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance (AED)</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {balanceSheet.equity.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-6 py-3 text-sm text-gray-500">{item.accountCode}</td>
                                <td className="px-6 py-3 text-sm text-gray-900">{item.accountName}</td>
                                <td className="px-6 py-3 text-sm text-right font-medium">
                                  {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-purple-50 font-bold">
                              <td className="px-6 py-3" colSpan={2}>Total Equity</td>
                              <td className="px-6 py-3 text-right text-purple-700">
                                {balanceSheet.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No data available.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Write-Off Modal */}
      <WriteOffModal
        isOpen={showWriteOffModal}
        onClose={() => setShowWriteOffModal(false)}
        onSubmit={handleCreateWriteOff}
      />
    </div>
  );
}
