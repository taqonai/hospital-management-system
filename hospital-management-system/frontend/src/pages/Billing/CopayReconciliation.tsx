/**
 * Copay Reconciliation Report - Phase 3 Feature #3
 * Daily reconciliation dashboard for copay payments
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';
import { CurrencyDisplay } from '../../components/common';
import { Link } from 'react-router-dom';

interface ReconciliationReport {
  dateRange: { start: string; end: string };
  expected: { count: number; amount: number };
  actual: {
    count: number;
    amount: number;
    online: { count: number; amount: number };
    cash: { count: number; amount: number };
  };
  variance: number;
  discrepancies: Array<{
    appointmentId: string;
    patientName: string;
    mrn: string;
    doctorName: string;
    appointmentDate: string;
    expected: number;
    paid: number;
    difference: number;
    type: 'missing' | 'underpayment' | 'overpayment';
    copayWaived: boolean;
  }>;
  byPaymentMethod: Record<string, { count: number; amount: number }>;
}

const staffCopayApi = {
  getReconciliation: (startDate: string, endDate: string) =>
    api.get('/staff/copay/reconciliation', { params: { startDate, endDate } }),
};

export default function CopayReconciliation() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(today, 'yyyy-MM-dd'));
  const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'custom'>('today');

  const handlePresetChange = (preset: 'today' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    switch (preset) {
      case 'today':
        setStartDate(format(now, 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case 'week':
        setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case 'month':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
    }
  };

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['copay-reconciliation', startDate, endDate],
    queryFn: async () => {
      const response = await staffCopayApi.getReconciliation(startDate, endDate);
      return response.data?.data || response.data as ReconciliationReport;
    },
  });

  const exportToCSV = () => {
    if (!report) return;

    const headers = ['Patient Name', 'MRN', 'Doctor', 'Date', 'Expected', 'Paid', 'Difference', 'Type'];
    const rows = report.discrepancies.map(d => [
      d.patientName,
      d.mrn,
      d.doctorName,
      format(new Date(d.appointmentDate), 'yyyy-MM-dd'),
      d.expected.toFixed(2),
      d.paid.toFixed(2),
      d.difference.toFixed(2),
      d.type,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copay-reconciliation-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const variancePercent = report && report.expected.amount > 0
    ? ((report.variance / report.expected.amount) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  to="/copay-verification"
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  ← Back to Verification
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Copay Reconciliation Report</h1>
              <p className="text-gray-500 mt-1">Daily summary of expected vs actual copay collections</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Presets */}
              <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                <button
                  onClick={() => handlePresetChange('today')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    datePreset === 'today'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => handlePresetChange('week')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    datePreset === 'week'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => handlePresetChange('month')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    datePreset === 'month'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => handlePresetChange('custom')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    datePreset === 'custom'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Date Pickers */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={() => refetch()}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5 text-gray-500" />
              </button>

              <button
                onClick={exportToCSV}
                disabled={!report || report.discrepancies.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-gray-500 mt-2">Loading reconciliation data...</p>
          </div>
        ) : report ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Expected Collection</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      <CurrencyDisplay amount={report.expected.amount} />
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{report.expected.count} appointments</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <CalendarDaysIcon className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Actual Collection</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">
                      <CurrencyDisplay amount={report.actual.amount} />
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{report.actual.count} payments</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-xl">
                    <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className={`bg-white rounded-xl shadow-sm p-5 ${
                report.variance < 0 ? 'ring-2 ring-red-200' : report.variance > 0 ? 'ring-2 ring-purple-200' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Variance</p>
                    <p className={`text-2xl font-bold mt-1 ${
                      report.variance < 0 ? 'text-red-700' : report.variance > 0 ? 'text-purple-700' : 'text-green-700'
                    }`}>
                      {report.variance >= 0 ? '+' : ''}<CurrencyDisplay amount={report.variance} />
                    </p>
                    <p className={`text-xs mt-1 ${
                      report.variance < 0 ? 'text-red-500' : report.variance > 0 ? 'text-purple-500' : 'text-green-500'
                    }`}>
                      {variancePercent}% {report.variance < 0 ? 'under' : report.variance > 0 ? 'over' : 'on target'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${
                    report.variance < 0 ? 'bg-red-100' : report.variance > 0 ? 'bg-purple-100' : 'bg-green-100'
                  }`}>
                    {report.variance < 0 ? (
                      <ArrowTrendingDownIcon className="h-6 w-6 text-red-600" />
                    ) : report.variance > 0 ? (
                      <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
                    ) : (
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Discrepancies</p>
                    <p className={`text-2xl font-bold mt-1 ${
                      report.discrepancies.length > 0 ? 'text-orange-700' : 'text-green-700'
                    }`}>
                      {report.discrepancies.length}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {report.discrepancies.filter(d => d.type === 'missing').length} missing, 
                      {report.discrepancies.filter(d => d.type !== 'missing').length} mismatched
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${
                    report.discrepancies.length > 0 ? 'bg-orange-100' : 'bg-green-100'
                  }`}>
                    <ExclamationTriangleIcon className={`h-6 w-6 ${
                      report.discrepancies.length > 0 ? 'text-orange-600' : 'text-green-600'
                    }`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Breakdown by Payment Method</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCardIcon className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Online</span>
                  </div>
                  <p className="text-xl font-bold text-green-800">
                    <CurrencyDisplay amount={report.actual.online.amount} />
                  </p>
                  <p className="text-xs text-green-600">{report.actual.online.count} transactions</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <BanknotesIcon className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Cash</span>
                  </div>
                  <p className="text-xl font-bold text-blue-800">
                    <CurrencyDisplay amount={report.actual.cash.amount} />
                  </p>
                  <p className="text-xs text-blue-600">{report.actual.cash.count} transactions</p>
                </div>

                {Object.entries(report.byPaymentMethod || {}).filter(([key]) => 
                  !['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'ONLINE'].includes(key)
                ).map(([method, data]) => {
                  const methodData = data as { count: number; amount: number };
                  return (
                    <div key={method} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <ChartBarIcon className="h-5 w-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">{method}</span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">
                        <CurrencyDisplay amount={methodData.amount} />
                      </p>
                      <p className="text-xs text-gray-600">{methodData.count} transactions</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Discrepancies Table */}
            {report.discrepancies.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Discrepancies</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Payments that need attention - missing payments, underpayments, or overpayments
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Patient</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Doctor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Expected</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Paid</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {report.discrepancies.map((d, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{d.patientName}</p>
                              <p className="text-sm text-gray-500">MRN: {d.mrn}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{d.doctorName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {format(new Date(d.appointmentDate), 'MMM d, yyyy')}
                          </td>
                          <td className="px-4 py-3">
                            {d.copayWaived ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                Waived
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                d.type === 'missing'
                                  ? 'bg-gray-100 text-gray-700'
                                  : d.type === 'underpayment'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {d.type === 'missing' ? (
                                  <XCircleIcon className="h-3 w-3" />
                                ) : d.type === 'underpayment' ? (
                                  <ArrowTrendingDownIcon className="h-3 w-3" />
                                ) : (
                                  <ArrowTrendingUpIcon className="h-3 w-3" />
                                )}
                                {d.type === 'missing' ? 'Missing' : d.type === 'underpayment' ? 'Underpaid' : 'Overpaid'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            <CurrencyDisplay amount={d.expected} />
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium">
                            <span className={d.paid === 0 ? 'text-gray-400' : 'text-gray-900'}>
                              <CurrencyDisplay amount={d.paid} />
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-medium ${
                              d.difference < 0 ? 'text-red-600' : d.difference > 0 ? 'text-purple-600' : 'text-gray-600'
                            }`}>
                              {d.difference >= 0 ? '+' : ''}<CurrencyDisplay amount={d.difference} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {report.discrepancies.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-900">All Clear!</p>
                <p className="text-gray-500 mt-1">No discrepancies found for the selected date range.</p>
              </div>
            )}
          </>
        ) : (
          /* P1 Fix: Empty state when no reconciliation data is available */
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-900">No Reconciliation Data</p>
            <p className="text-gray-500 mt-1">
              No copay data found for the selected date range ({startDate} to {endDate}).
            </p>
            <p className="text-sm text-gray-400 mt-2">
              This could mean no appointments with copay requirements were scheduled for this period.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
