import { Link } from 'react-router-dom';
import {
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useHRDashboard } from '../../../../hooks/useHRDashboard';
import KPICard from '../shared/KPICard';
import OccupancyGauge from '../shared/OccupancyGauge';
import ChartCard from '../ChartCard';
import { doughnutChartOptions, barChartOptions, chartColors, chartColorPalette } from '../chartSetup';

export default function HRDashboard() {
  const {
    dashboardStats,
    pendingLeaves,
    todayAttendance,
    employees,
    isLoading,
  } = useHRDashboard();

  // Attendance donut data
  const attendanceData = {
    labels: ['Present', 'Absent', 'On Leave'],
    datasets: [{
      data: [
        dashboardStats?.todayPresent || 0,
        dashboardStats?.todayAbsent || 0,
        dashboardStats?.onLeave || 0,
      ],
      backgroundColor: [
        chartColors.success.main,
        chartColors.danger.main,
        chartColors.warning.main,
      ],
      borderWidth: 0,
    }],
  };

  // Department distribution
  const departmentData = {
    labels: dashboardStats?.departmentWise?.map((d: any) => d.department) || [],
    datasets: [{
      label: 'Employees',
      data: dashboardStats?.departmentWise?.map((d: any) => d.count) || [],
      backgroundColor: chartColorPalette.map(c => c.replace('rgb', 'rgba').replace(')', ', 0.8)')),
      borderRadius: 6,
    }],
  };

  // Employee type distribution
  const typeData = {
    labels: dashboardStats?.typeDistribution?.map((t: any) => t.type) || ['Doctors', 'Nurses', 'Staff'],
    datasets: [{
      data: dashboardStats?.typeDistribution?.map((t: any) => t.count) || [0, 0, 0],
      backgroundColor: [chartColors.primary.main, chartColors.pink.main, chartColors.cyan.main],
      borderWidth: 0,
    }],
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Total Employees"
          value={dashboardStats?.totalEmployees || employees?.total || 0}
          icon={UserGroupIcon}
          color="blue"
          subtitle={`${dashboardStats?.activeEmployees || 0} active`}
          isLoading={isLoading}
        />
        <KPICard
          title="Present Today"
          value={dashboardStats?.todayPresent || 0}
          icon={CheckCircleIcon}
          color="emerald"
          subtitle={`${dashboardStats?.attendanceRate?.toFixed(0) || 0}% attendance`}
          isLoading={isLoading}
        />
        <KPICard
          title="Absent Today"
          value={dashboardStats?.todayAbsent || 0}
          icon={XCircleIcon}
          color="red"
          subtitle="Not checked in"
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Leaves"
          value={dashboardStats?.pendingLeaves || pendingLeaves?.total || 0}
          icon={ClockIcon}
          color="amber"
          subtitle="Awaiting approval"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Donut */}
        <ChartCard
          title="Today's Attendance"
          subtitle="Employee status"
          isLoading={isLoading}
          height="h-64"
        >
          <Doughnut data={attendanceData} options={doughnutChartOptions} />
        </ChartCard>

        {/* Attendance Rate Gauge */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Rate</h3>
          <div className="flex justify-center">
            <OccupancyGauge
              percentage={dashboardStats?.attendanceRate || 0}
              label="Overall Rate"
              sublabel={`${dashboardStats?.todayPresent || 0} of ${dashboardStats?.totalEmployees || 0}`}
              size="lg"
              color="green"
            />
          </div>
        </div>

        {/* Employee Type */}
        <ChartCard
          title="Employee Type"
          subtitle="Staff distribution"
          isLoading={isLoading}
          height="h-64"
        >
          <Doughnut data={typeData} options={doughnutChartOptions} />
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <ChartCard
          title="Department Distribution"
          subtitle="Employees by department"
          isLoading={isLoading}
        >
          <Bar data={departmentData} options={{
            ...barChartOptions,
            indexAxis: 'y' as const,
          }} />
        </ChartCard>

        {/* Pending Leave Requests */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pending Leave Requests</h3>
            <Link
              to="/hr/leave"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {pendingLeaves?.leaves?.slice(0, 5).map((leave: any) => (
              <div
                key={leave.id}
                className="flex items-center justify-between p-4 rounded-xl bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{leave.employeeName}</p>
                  <p className="text-sm text-gray-500">
                    {leave.leaveType} • {leave.startDate} to {leave.endDate}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{leave.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-sm font-medium">
                    Approve
                  </button>
                  <button className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium">
                    Reject
                  </button>
                </div>
              </div>
            ))}

            {(!pendingLeaves?.leaves || pendingLeaves.leaves.length === 0) && (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-500">No pending leave requests</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/hr/attendance"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <CalendarDaysIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Attendance</p>
            <p className="text-xs text-gray-500">View records</p>
          </div>
        </Link>
        <Link
          to="/hr/leave"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-amber-500 group-hover:scale-110 transition-transform">
            <ClockIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Approve Leave</p>
            <p className="text-xs text-gray-500">Process requests</p>
          </div>
        </Link>
        <Link
          to="/hr/employees"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-purple-500 group-hover:scale-110 transition-transform">
            <UserGroupIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Employees</p>
            <p className="text-xs text-gray-500">Manage staff</p>
          </div>
        </Link>
        <Link
          to="/hr/payroll"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-emerald-500 group-hover:scale-110 transition-transform">
            <BanknotesIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Payroll</p>
            <p className="text-xs text-gray-500">Generate salary</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
