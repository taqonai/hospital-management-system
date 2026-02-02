import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import {
  CalendarDaysIcon,
  DocumentTextIcon,
  CreditCardIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ClockIcon,
  XMarkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import { CurrencyDisplay } from '../../components/common';

// Types
interface NextAppointment {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: string;
}

interface LabReport {
  id: string;
  testName: string;
  testCategory?: string;
  testDate: string;
  status: string;
}

interface BillRecord {
  id: string;
  invoiceNumber: string;
  description: string;
  totalAmount: number;
  balanceDue: number;
  insurancePay: number;
  status: string;
  billDate: string;
}

// Helpers
const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (timeString: string): string => {
  if (!timeString) return '';
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
};

const isToday = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
};

type TabKey = 'reports' | 'billing';

// Main Dashboard Component
export default function PatientPortalDashboard() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('reports');
  const [searchFilter, setSearchFilter] = useState('');
  const [showBookingChoice, setShowBookingChoice] = useState(false);

  // Data state
  const [patientName, setPatientName] = useState('Patient');
  const [patientId, setPatientId] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [nextAppointment, setNextAppointment] = useState<NextAppointment | null>(null);
  const [labResults, setLabResults] = useState<LabReport[]>([]);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [healthStatus, setHealthStatus] = useState('Stable');

  const patientUser = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('patientUser') || 'null')
    : null;

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      patientPortalApi.getSummary(),            // 0
      patientPortalApi.getProfile(),            // 1
      patientPortalApi.getLabResults(),         // 2
      patientPortalApi.getBillingSummary(),      // 3
      patientPortalApi.getBills({ type: 'all' }), // 4
      patientPortalApi.getHealthInsights(),      // 5
    ]);

    const extract = (idx: number) => {
      const r = results[idx];
      if (r.status === 'fulfilled') return r.value?.data?.data || r.value?.data || {};
      return null;
    };

    const toArray = (raw: any) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (raw.data && Array.isArray(raw.data)) return raw.data;
      return [];
    };

    const summary = extract(0) || {};
    const profile = extract(1) || {};
    const labsRaw = extract(2);
    const billing = extract(3) || {};
    const billsRaw = extract(4);
    const healthInsights = extract(5) || {};

    // Patient info
    const firstName = profile?.firstName || summary?.patient?.firstName || patientUser?.firstName || 'Patient';
    const lastName = profile?.lastName || summary?.patient?.lastName || patientUser?.lastName || '';
    setPatientName(`${firstName} ${lastName}`.trim());
    setPatientId(profile?.mrn || profile?.patientId || '');
    setBloodGroup(profile?.bloodGroup || summary?.patient?.bloodGroup || '');

    // Next appointment
    const nextApt = summary?.nextAppointment;
    if (nextApt) {
      setNextAppointment({
        id: nextApt.id,
        doctorName: nextApt.doctor?.user
          ? `Dr. ${nextApt.doctor.user.firstName} ${nextApt.doctor.user.lastName}`
          : nextApt.doctorName || 'Doctor',
        specialty: nextApt.doctor?.specialization || nextApt.specialty || 'General',
        date: nextApt.appointmentDate || nextApt.scheduledAt || nextApt.date,
        time: nextApt.startTime || nextApt.time || '',
        status: nextApt.status || 'SCHEDULED',
      });
    } else {
      setNextAppointment(null);
    }

    // Lab results
    const labs = toArray(labsRaw);
    setLabResults(labs.map((lab: any) => ({
      id: lab.id,
      testName: lab.testName || 'Lab Test',
      testCategory: lab.testCategory || '',
      testDate: lab.testDate || lab.reportDate || '',
      status: lab.status || 'PENDING',
    })));

    // Billing
    setTotalDue(Number(billing?.totalBalance || billing?.totalDue || 0));
    const billsList = toArray(billsRaw);
    setBills(billsList.map((bill: any) => ({
      id: bill.id,
      invoiceNumber: bill.invoiceNumber || '',
      description: bill.description || `Invoice #${bill.invoiceNumber || ''}`,
      totalAmount: Number(bill.totalAmount || bill.amount || 0),
      balanceDue: Number(bill.balanceDue || bill.balanceAmount || 0),
      insurancePay: Number(bill.insurancePay || 0),
      status: bill.status || 'PENDING',
      billDate: bill.billDate || bill.createdAt || '',
    })));

    // Health status
    setHealthStatus(healthInsights?.scoreLabel || 'Stable');

    setIsLoading(false);
  };

  // Derived KPI values
  const readyReportsCount = labResults.filter(r => r.status === 'READY').length;

  // Filtered reports for search
  const filteredReports = labResults.filter(r => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return r.testName.toLowerCase().includes(q) || (r.testCategory || '').toLowerCase().includes(q);
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="mt-3 text-gray-600 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <ExclamationCircleIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Unable to Load Dashboard</h2>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchDashboard}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 text-sm"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const nextAptDisplay = nextAppointment
    ? isToday(nextAppointment.date)
      ? `Today, ${formatTime(nextAppointment.time)}`
      : `${formatDate(nextAppointment.date)}${nextAppointment.time ? `, ${formatTime(nextAppointment.time)}` : ''}`
    : null;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
          <span className="text-xl font-bold text-white">
            {patientName.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {patientName}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
            {patientId && <span>Patient ID: {patientId.slice(0, 8)}</span>}
            {bloodGroup && (
              <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded font-medium text-xs">
                {bloodGroup}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Next Appointment */}
        <div
          className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer"
          onClick={() => nextAppointment ? navigate(`/patient-portal/appointments`) : setShowBookingChoice(true)}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-green-100">
              <CalendarDaysIcon className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Next Appointment</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            {nextAptDisplay || 'None Scheduled'}
          </p>
          {nextAppointment && (
            <p className="text-xs text-gray-500 mt-1 truncate">{nextAppointment.doctorName} - {nextAppointment.specialty}</p>
          )}
        </div>

        {/* Recent Reports */}
        <div
          className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer"
          onClick={() => setActiveTab('reports')}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent Reports</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            {readyReportsCount > 0 ? `${readyReportsCount} Ready to view` : 'No reports'}
          </p>
        </div>

        {/* Pending Payment */}
        <div
          className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer"
          onClick={() => setActiveTab('billing')}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-orange-100">
              <CreditCardIcon className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Payment</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            {totalDue > 0 ? (
              <span className="text-red-600"><CurrencyDisplay amount={totalDue} /></span>
            ) : (
              <span className="text-green-600">All Clear</span>
            )}
          </p>
        </div>

        {/* Health Status */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-purple-100">
              <HeartIcon className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Health Status</span>
          </div>
          <p className="text-lg font-bold text-purple-700">{healthStatus}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center transition-colors ${
              activeTab === 'reports'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Medical Reports
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center transition-colors ${
              activeTab === 'billing'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Billing & Payments
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'reports' && (
            <div>
              {/* Header with search */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-base font-semibold text-gray-900">My Test Reports</h3>
                <div className="relative">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by test name..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
                  />
                </div>
              </div>

              {/* Reports Table */}
              <div className="overflow-x-auto">
                {filteredReports.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Test Name</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Department</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredReports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-900">{report.testName}</td>
                          <td className="py-3 px-3 text-gray-600">{report.testCategory || 'Laboratory'}</td>
                          <td className="py-3 px-3 text-gray-600">{formatDate(report.testDate)}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              report.status === 'READY'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {report.status === 'READY' ? 'Ready' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {report.status === 'READY' ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => navigate('/patient-portal/labs')}
                                  className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleDownloadReport(report.id)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Processing</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-10">
                    <DocumentTextIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      {searchFilter ? 'No reports match your filter' : 'No test reports found'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Invoices & Payments</h3>

              <div className="overflow-x-auto">
                {bills.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Service</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Insurance Pay</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Due Amount</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bills.map((bill) => {
                        const isPaid = bill.status === 'PAID';
                        return (
                          <tr key={bill.id} className="hover:bg-gray-50">
                            <td className="py-3 px-3 font-medium text-gray-900 max-w-[200px] truncate">{bill.description}</td>
                            <td className="py-3 px-3 text-gray-600">{formatDate(bill.billDate)}</td>
                            <td className="py-3 px-3 text-right text-gray-900">
                              <CurrencyDisplay amount={bill.totalAmount} />
                            </td>
                            <td className="py-3 px-3 text-right">
                              {bill.insurancePay > 0 ? (
                                <span className="text-red-600">-<CurrencyDisplay amount={bill.insurancePay} /></span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-gray-900">
                              <CurrencyDisplay amount={bill.balanceDue} />
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                isPaid
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {isPaid ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {isPaid ? (
                                <button
                                  onClick={() => navigate(`/patient-portal/billing`)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => navigate('/patient-portal/billing')}
                                  className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  Pay Now
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-10">
                    <CreditCardIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No invoices found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Booking Choice Modal */}
      <Transition appear show={showBookingChoice} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowBookingChoice(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                  <Dialog.Title className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Book Appointment</h3>
                      <p className="text-sm text-gray-500 mt-1">Choose how you'd like to proceed</p>
                    </div>
                    <button
                      onClick={() => setShowBookingChoice(false)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6 text-gray-500" />
                    </button>
                  </Dialog.Title>

                  <div className="space-y-3">
                    <button
                      onClick={() => { setShowBookingChoice(false); navigate('/patient-portal/appointments?booking=emergency'); }}
                      className="w-full p-5 rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 hover:shadow-xl transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur rounded-xl text-white">
                          <ExclamationTriangleIcon className="h-8 w-8" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-lg">Emergency</h4>
                            <span className="px-2 py-0.5 text-xs font-bold bg-white text-red-600 rounded-full animate-pulse">INSTANT</span>
                          </div>
                          <p className="text-sm text-red-100 mt-1">One-click booking for urgent care today</p>
                        </div>
                        <ChevronRightIcon className="h-6 w-6 text-white/80" />
                      </div>
                    </button>

                    <button
                      onClick={() => { setShowBookingChoice(false); navigate('/patient-portal/appointments?booking=quick'); }}
                      className="w-full p-5 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 hover:shadow-xl transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur rounded-xl text-white">
                          <ClockIcon className="h-8 w-8" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-lg">Quick Book</h4>
                            <span className="px-2 py-0.5 text-xs font-bold bg-white text-blue-600 rounded-full">2 STEPS</span>
                          </div>
                          <p className="text-sm text-blue-100 mt-1">Select department &rarr; Pick doctor &amp; time</p>
                        </div>
                        <ChevronRightIcon className="h-6 w-6 text-white/80" />
                      </div>
                    </button>

                    <button
                      onClick={() => { setShowBookingChoice(false); navigate('/patient-portal/symptom-checker?autoStart=true'); }}
                      className="w-full p-4 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 hover:border-purple-400 hover:shadow-lg transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white shadow-lg group-hover:scale-110 transition-transform">
                          <SparklesIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">AI-Guided</h4>
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Smart</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Unsure which doctor? AI recommends based on symptoms</p>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-purple-500" />
                      </div>
                    </button>

                    <button
                      onClick={() => { setShowBookingChoice(false); navigate('/patient-portal/appointments?booking=standard'); }}
                      className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all text-left"
                    >
                      <div className="flex items-center justify-center gap-2 text-gray-600">
                        <CalendarDaysIcon className="h-5 w-5" />
                        <span className="text-sm font-medium">Standard Booking (4 steps)</span>
                      </div>
                    </button>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-start gap-3">
                      <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-700">
                        <p className="font-medium">Not sure which option to choose?</p>
                        <p className="mt-1">The AI-Guided Booking helps identify the best specialist for your needs based on your symptoms.</p>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );

  async function handleDownloadReport(reportId: string) {
    try {
      const response = await patientPortalApi.downloadLabReport(reportId);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lab-report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      // Fallback: navigate to lab results page
      navigate('/patient-portal/labs');
    }
  }
}

// Export named component
export { PatientPortalDashboard };
