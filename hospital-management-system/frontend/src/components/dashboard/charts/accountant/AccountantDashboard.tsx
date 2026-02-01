import { Link } from 'react-router-dom';
import {
  ClockIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { CalendarBillingIcon } from '../../../icons/HMSIcons';
import { Line, Doughnut } from 'react-chartjs-2';
import { useAccountantDashboard } from '../../../../hooks/useAccountantDashboard';
import KPICard from '../shared/KPICard';
import OccupancyGauge from '../shared/OccupancyGauge';
import ChartCard from '../ChartCard';
import { lineChartOptions, doughnutChartOptions, chartColors } from '../chartSetup';

export default function AccountantDashboard() {
  const {
    billingStats,
    outstanding,
    revenueTrends,
    recentInvoices,
    claims,
    isLoading,
  } = useAccountantDashboard();

  // Revenue trend chart
  const revenueChartData = {
    labels: revenueTrends?.trends?.map((t: any) => t.month) || [],
    datasets: [
      {
        label: 'Billed',
        data: revenueTrends?.trends?.map((t: any) => t.billed) || [],
        borderColor: chartColors.primary.main,
        backgroundColor: chartColors.primary.light,
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Collected',
        data: revenueTrends?.trends?.map((t: any) => t.collected) || [],
        borderColor: chartColors.success.main,
        backgroundColor: chartColors.success.light,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Payment status donut
  const paymentStatusData = {
    labels: ['Paid', 'Partial', 'Pending', 'Overdue'],
    datasets: [{
      data: [
        billingStats?.paid || 0,
        billingStats?.partial || 0,
        billingStats?.pending || 0,
        billingStats?.overdue || 0,
      ],
      backgroundColor: [
        chartColors.success.main,
        chartColors.cyan.main,
        chartColors.warning.main,
        chartColors.danger.main,
      ],
      borderWidth: 0,
    }],
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const collectionRate = billingStats?.collectionRate || (
    billingStats?.totalRevenue && billingStats?.collected
      ? (billingStats.collected / billingStats.totalRevenue) * 100
      : 0
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(billingStats?.totalRevenue || 0)}
          icon={CalendarBillingIcon}
          color="emerald"
          subtitle="This month"
          isLoading={isLoading}
        />
        <KPICard
          title="Today's Revenue"
          value={formatCurrency(billingStats?.todayRevenue || 0)}
          icon={BanknotesIcon}
          color="blue"
          subtitle="Collected today"
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Payments"
          value={formatCurrency(billingStats?.pendingPayments || 0)}
          icon={ClockIcon}
          color="amber"
          subtitle="Outstanding"
          isLoading={isLoading}
        />
        <KPICard
          title="Claims Submitted"
          value={billingStats?.claimsSubmitted || 0}
          icon={DocumentTextIcon}
          color="purple"
          subtitle={`${billingStats?.claimsDenied || 0} denied`}
          isLoading={isLoading}
        />
      </div>

      {/* Revenue Trend Chart */}
      <ChartCard
        title="Revenue Trends"
        subtitle="12-month billed vs collected"
        isLoading={!revenueTrends}
      >
        <Line data={revenueChartData} options={{
          ...lineChartOptions,
          scales: {
            ...lineChartOptions.scales,
            y: {
              ...lineChartOptions.scales.y,
              ticks: {
                ...lineChartOptions.scales.y.ticks,
                callback: (value: any) => `$${(value / 1000).toFixed(0)}k`,
              },
            },
          },
        }} />
      </ChartCard>

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Status */}
        <ChartCard
          title="Payment Status"
          subtitle="Invoice distribution"
          isLoading={isLoading}
          height="h-64"
        >
          <Doughnut data={paymentStatusData} options={doughnutChartOptions} />
        </ChartCard>

        {/* Collection Rate */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Rate</h3>
          <div className="flex justify-center">
            <OccupancyGauge
              percentage={collectionRate}
              label="Collection Rate"
              sublabel="Collected vs billed"
              size="lg"
              color="green"
            />
          </div>
        </div>

        {/* Outstanding Summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">Pending (0-30 days)</span>
              </div>
              <span className="font-bold text-amber-700">
                {formatCurrency(outstanding?.pending30 || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Overdue (31-60 days)</span>
              </div>
              <span className="font-bold text-orange-700">
                {formatCurrency(outstanding?.overdue60 || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-700">Critical (60+ days)</span>
              </div>
              <span className="font-bold text-red-700">
                {formatCurrency(outstanding?.overdue90 || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Outstanding Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Outstanding Invoices</h3>
          <Link
            to="/billing/outstanding"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Invoice #</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Patient</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Due Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {outstanding?.invoices?.slice(0, 5).map((invoice: any) => (
                <tr key={invoice.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{invoice.invoiceNumber}</td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-gray-900">{invoice.patientName}</p>
                    <p className="text-xs text-gray-500">{invoice.mrn}</p>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    {formatCurrency(invoice.amount)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{invoice.dueDate}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      invoice.daysOverdue > 60 ? 'bg-red-100 text-red-700' :
                      invoice.daysOverdue > 30 ? 'bg-orange-100 text-orange-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days overdue` : 'Pending'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      to={`/billing/invoices/${invoice.id}`}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Follow Up
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!outstanding?.invoices || outstanding.invoices.length === 0) && (
            <div className="text-center py-8">
              <CheckCircleIcon className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-gray-500">No outstanding invoices</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/billing/invoices/new"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <DocumentTextIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Create Invoice</p>
            <p className="text-xs text-gray-500">New billing</p>
          </div>
        </Link>
        <Link
          to="/billing/payments"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-emerald-500 group-hover:scale-110 transition-transform">
            <BanknotesIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Record Payment</p>
            <p className="text-xs text-gray-500">Process payment</p>
          </div>
        </Link>
        <Link
          to="/billing/claims"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-purple-500 group-hover:scale-110 transition-transform">
            <DocumentTextIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Submit Claim</p>
            <p className="text-xs text-gray-500">Insurance</p>
          </div>
        </Link>
        <Link
          to="/reports"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-amber-500 group-hover:scale-110 transition-transform">
            <CurrencyDollarIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Reports</p>
            <p className="text-xs text-gray-500">Financial analytics</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
