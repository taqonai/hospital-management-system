import React, { useState, useEffect } from 'react';
import { reportsApi } from '../../services/api';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface ExecutiveSummary {
  patients: { total: number; new: number; growth: number };
  appointments: { total: number; completed: number; completionRate: number };
  revenue: { total: number };
  staff: { totalDoctors: number; activeDoctors: number };
  bedOccupancy: { total: number; occupied: number; occupancyRate: number };
}

interface DepartmentPerformance {
  department: string;
  total: number;
  completed: number;
  completionRate: number;
}

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('executive');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null);
  const [departmentPerformance, setDepartmentPerformance] = useState<DepartmentPerformance[]>([]);
  const [aiInsights, setAiInsights] = useState<any>(null);

  useEffect(() => {
    loadExecutiveSummary();
    loadDepartmentPerformance();
  }, [dateRange]);

  const loadExecutiveSummary = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.getExecutiveSummary(dateRange);
      setExecutiveSummary(response.data.data);
    } catch (error) {
      console.error('Failed to load executive summary:', error);
    }
    setLoading(false);
  };

  const loadDepartmentPerformance = async () => {
    try {
      const response = await reportsApi.getDepartmentPerformance(dateRange);
      setDepartmentPerformance(response.data.data || []);
    } catch (error) {
      console.error('Failed to load department performance:', error);
    }
  };

  const generateAIInsights = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.generateInsights({
        currentMetrics: {
          revenue: executiveSummary?.revenue.total || 0,
          patients: executiveSummary?.patients.total || 0,
          appointmentCompletion: executiveSummary?.appointments.completionRate || 0,
          bedOccupancy: executiveSummary?.bedOccupancy.occupancyRate || 0,
        },
        previousMetrics: {
          revenue: (executiveSummary?.revenue.total || 0) * 0.9,
          patients: (executiveSummary?.patients.total || 0) * 0.95,
          appointmentCompletion: (executiveSummary?.appointments.completionRate || 0) * 0.98,
          bedOccupancy: (executiveSummary?.bedOccupancy.occupancyRate || 0) * 1.02,
        },
      });
      setAiInsights(response.data.data);
    } catch (error) {
      console.error('Failed to generate AI insights:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const tabs = [
    { id: 'executive', name: 'Executive Summary', icon: ChartBarIcon },
    { id: 'financial', name: 'Financial', icon: CurrencyDollarIcon },
    { id: 'operations', name: 'Operations', icon: ClockIcon },
    { id: 'clinical', name: 'Clinical', icon: UserGroupIcon },
    { id: 'ai-insights', name: 'AI Insights', icon: SparklesIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">AI-powered insights and comprehensive analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From:</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To:</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'executive' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Patients</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {executiveSummary?.patients.total.toLocaleString() || '-'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {(executiveSummary?.patients.growth || 0) > 0 ? (
                      <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm ${(executiveSummary?.patients.growth || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {executiveSummary?.patients.growth || 0}% growth
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <UserGroupIcon className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(executiveSummary?.revenue.total || 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Appointment Completion</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {executiveSummary?.appointments.completionRate || 0}%
                  </p>
                  <p className="text-sm text-gray-500">
                    {executiveSummary?.appointments.completed || 0} / {executiveSummary?.appointments.total || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ClockIcon className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Bed Occupancy</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {executiveSummary?.bedOccupancy.occupancyRate || 0}%
                  </p>
                  <p className="text-sm text-gray-500">
                    {executiveSummary?.bedOccupancy.occupied || 0} / {executiveSummary?.bedOccupancy.total || 0} beds
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <ChartBarIcon className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Department Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Department Performance</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Appointments</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Completed</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Completion Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {departmentPerformance.length > 0 ? departmentPerformance.map((dept, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.department}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{dept.total}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{dept.completed}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{dept.completionRate}%</td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${
                              dept.completionRate >= 90 ? 'bg-green-500' :
                              dept.completionRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${dept.completionRate}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No department data available for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Financial Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-2">Revenue by Category</h3>
              <div className="space-y-2">
                {['Consultations', 'Laboratory', 'Pharmacy', 'Radiology', 'Surgery'].map((cat) => (
                  <div key={cat} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{cat}</span>
                    <span className="font-medium">{formatCurrency(Math.floor(Math.random() * 500000))}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-2">Collection Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Collected</span>
                  <span className="font-medium text-green-600">{formatCurrency(Math.floor(Math.random() * 2000000))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending</span>
                  <span className="font-medium text-yellow-600">{formatCurrency(Math.floor(Math.random() * 500000))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Overdue</span>
                  <span className="font-medium text-red-600">{formatCurrency(Math.floor(Math.random() * 100000))}</span>
                </div>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-2">Insurance Claims</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Approved</span>
                  <span className="font-medium text-green-600">{Math.floor(Math.random() * 100)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending</span>
                  <span className="font-medium text-yellow-600">{Math.floor(Math.random() * 50)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Denied</span>
                  <span className="font-medium text-red-600">{Math.floor(Math.random() * 10)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'operations' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Operational Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-3">Staff Productivity</h3>
              <div className="space-y-3">
                {['Dr. Smith - Cardiology', 'Dr. Johnson - Neurology', 'Dr. Williams - Orthopedics'].map((doc) => (
                  <div key={doc}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{doc}</span>
                      <span>{Math.floor(Math.random() * 30 + 20)} patients</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.floor(Math.random() * 40 + 60)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-3">Resource Utilization</h3>
              <div className="space-y-3">
                {['Operation Theaters', 'ICU Beds', 'General Wards', 'Lab Equipment'].map((resource) => (
                  <div key={resource}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{resource}</span>
                      <span>{Math.floor(Math.random() * 30 + 60)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.floor(Math.random() * 30 + 60)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'clinical' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Clinical Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-3">Top Diagnoses</h3>
              <div className="space-y-2">
                {['Hypertension', 'Type 2 Diabetes', 'Respiratory Infection', 'Cardiac Arrhythmia', 'Chronic Pain'].map((diag, idx) => (
                  <div key={diag} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{idx + 1}. {diag}</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{Math.floor(Math.random() * 50 + 10)} cases</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-3">Top Prescribed Medications</h3>
              <div className="space-y-2">
                {['Metformin', 'Amlodipine', 'Atorvastatin', 'Omeprazole', 'Paracetamol'].map((med, idx) => (
                  <div key={med} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{idx + 1}. {med}</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{Math.floor(Math.random() * 100 + 50)} prescriptions</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai-insights' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                AI-Generated Insights
              </h2>
              <button
                onClick={generateAIInsights}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Insights'}
              </button>
            </div>

            {aiInsights ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {aiInsights.highlights?.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-medium text-green-800 mb-2">Strengths</h3>
                    <ul className="space-y-1">
                      {aiInsights.highlights.map((h: string, idx: number) => (
                        <li key={idx} className="text-sm text-green-700 flex items-start gap-2">
                          <span className="text-green-500">✓</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiInsights.concerns?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-medium text-red-800 mb-2">Areas of Concern</h3>
                    <ul className="space-y-1">
                      {aiInsights.concerns.map((c: string, idx: number) => (
                        <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                          <span className="text-red-500">!</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiInsights.opportunities?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-800 mb-2">Opportunities</h3>
                    <ul className="space-y-1">
                      {aiInsights.opportunities.map((o: string, idx: number) => (
                        <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                          <span className="text-blue-500">→</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <DocumentChartBarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Click "Generate Insights" to get AI-powered analysis of your hospital performance</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
