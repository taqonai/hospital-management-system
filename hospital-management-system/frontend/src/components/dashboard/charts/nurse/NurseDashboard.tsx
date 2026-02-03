import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartIcon,
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ClipboardDocumentCheckIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import {
  PatientIcon,
  VitalsClipboardAIIcon,
  HospitalBedIcon,
  NotificationBellIcon,
  MedicalCrossHeartbeatIcon,
  IVDripIcon,
  AIDocClipboardIcon,
} from '../../../icons/HMSIcons';
import { Bar } from 'react-chartjs-2';
import { useNurseDashboard } from '../../../../hooks/useNurseDashboard';
import KPICard from '../shared/KPICard';
import OccupancyGauge from '../shared/OccupancyGauge';
import ChartCard from '../ChartCard';
import { barChartOptions } from '../chartSetup';
import VitalsRecordingModal from '../../../vitals/VitalsRecordingModal';

export default function NurseDashboard() {
  const [vitalsPatient, setVitalsPatient] = useState<any>(null);
  const {
    opdStats,
    opdQueue,
    deteriorationDashboard,
    ipdStats,
    highRiskPatients,
    isLoading,
    refetchAll,
  } = useNurseDashboard();

  // Filter OPD queue for patients needing vitals
  const vitalsNeeded = opdQueue?.filter((p: any) =>
    p.status === 'CHECKED_IN' && !p.vitalsRecorded
  ) || [];

  const vitalsRecorded = opdQueue?.filter((p: any) => p.vitalsRecorded) || [];

  // Risk distribution chart data
  const riskChartData = {
    labels: ['Low', 'Low-Medium', 'Medium', 'High', 'Critical'],
    datasets: [
      {
        label: 'Patients',
        data: [
          deteriorationDashboard?.patients?.filter((p: any) => p.riskLevel === 'LOW').length || 0,
          deteriorationDashboard?.patients?.filter((p: any) => p.riskLevel === 'LOW_MEDIUM').length || 0,
          deteriorationDashboard?.patients?.filter((p: any) => p.riskLevel === 'MEDIUM').length || 0,
          deteriorationDashboard?.patients?.filter((p: any) => p.riskLevel === 'HIGH').length || 0,
          deteriorationDashboard?.patients?.filter((p: any) => p.riskLevel === 'CRITICAL').length || 0,
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',  // Green
          'rgba(132, 204, 22, 0.8)', // Lime
          'rgba(245, 158, 11, 0.8)', // Amber
          'rgba(249, 115, 22, 0.8)', // Orange
          'rgba(239, 68, 68, 0.8)',  // Red
        ],
        borderRadius: 6,
      },
    ],
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500" />;
      case 'worsening':
        return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
      default:
        return <MinusIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-emerald-100 text-emerald-700';
      case 'LOW_MEDIUM': return 'bg-lime-100 text-lime-700';
      case 'MEDIUM': return 'bg-amber-100 text-amber-700';
      case 'HIGH': return 'bg-orange-100 text-orange-700';
      case 'CRITICAL': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="OPD Waiting"
          value={vitalsNeeded.length}
          icon={PatientIcon}
          color="blue"
          subtitle="Need vitals recorded"
          isLoading={isLoading}
        />
        <KPICard
          title="Vitals Done Today"
          value={opdStats?.vitalsDone || vitalsRecorded.length}
          icon={VitalsClipboardAIIcon}
          color="emerald"
          subtitle={`of ${opdStats?.totalAppointments || opdQueue?.length || 0} patients`}
          isLoading={isLoading}
        />
        <KPICard
          title="IPD High Risk"
          value={deteriorationDashboard?.summary?.highRisk || 0}
          icon={MedicalCrossHeartbeatIcon}
          color="red"
          subtitle="NEWS2 score > 6"
          isLoading={isLoading}
        />
        <KPICard
          title="Vitals Overdue"
          value={deteriorationDashboard?.summary?.vitalsOverdue || 0}
          icon={IVDripIcon}
          color="amber"
          subtitle="Need monitoring"
          isLoading={isLoading}
        />
      </div>

      {/* OPD Section */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500 flex items-center justify-center">
              <img src="/icons/ai-doc-clipboard.png" alt="AI Doc" className="h-6 w-6 object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">OPD - Vitals Queue</h2>
              <p className="text-sm text-gray-500">Patients waiting for vitals recording</p>
            </div>
          </div>
          <Link
            to="/opd"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        {/* Vitals Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">
              Vitals Progress: {vitalsRecorded.length} of {opdQueue?.length || 0} patients
            </span>
            <span className="font-medium text-gray-900">
              {opdQueue?.length > 0 ? Math.round((vitalsRecorded.length / opdQueue.length) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{
                width: `${opdQueue?.length > 0 ? (vitalsRecorded.length / opdQueue.length) * 100 : 0}%`
              }}
            />
          </div>
        </div>

        {/* Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Token</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Patient</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Doctor</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Time</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vitals</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {vitalsNeeded.slice(0, 5).map((patient: any) => (
                <tr key={patient.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                      {patient.tokenNumber}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">{patient.patient?.firstName} {patient.patient?.lastName}</p>
                    <p className="text-xs text-gray-500">{patient.patient?.mrn}</p>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    Dr. {patient.doctor?.user?.firstName} {patient.doctor?.user?.lastName}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{patient.startTime}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                      Pending
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setVitalsPatient(patient)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Record Vitals
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {vitalsNeeded.length === 0 && (
            <div className="text-center py-8">
              <ClipboardDocumentCheckIcon className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-gray-500">All patient vitals have been recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* IPD Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Distribution Chart */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Patient Risk Distribution"
            subtitle="NEWS2 scores across IPD"
            isLoading={!deteriorationDashboard}
          >
            <Bar data={riskChartData} options={barChartOptions} />
          </ChartCard>
        </div>

        {/* Ward Occupancy & IPD Stats */}
        <div className="space-y-6">
          {/* Occupancy Gauge */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ward Occupancy</h3>
            <div className="flex justify-center">
              <OccupancyGauge
                percentage={ipdStats?.occupancyRate || 0}
                label="Bed Occupancy"
                sublabel={`${ipdStats?.occupiedBeds || 0}/${ipdStats?.totalBeds || 0} beds`}
                size="lg"
              />
            </div>
          </div>

          {/* Patient Trends Summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Trends</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50">
                <div className="flex items-center gap-2">
                  <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">Improving</span>
                </div>
                <span className="text-lg font-bold text-emerald-700">
                  {deteriorationDashboard?.summary?.improving || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <MinusIcon className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Stable</span>
                </div>
                <span className="text-lg font-bold text-gray-700">
                  {deteriorationDashboard?.summary?.stable || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50">
                <div className="flex items-center gap-2">
                  <ArrowTrendingDownIcon className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-700">Worsening</span>
                </div>
                <span className="text-lg font-bold text-red-700">
                  {deteriorationDashboard?.summary?.worsening || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High Risk Patients Table */}
      {(highRiskPatients?.length > 0 || deteriorationDashboard?.patients?.some((p: any) => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL')) && (
        <div className="bg-white rounded-xl border border-red-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500">
                <BellAlertIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">High Risk Patients</h2>
                <p className="text-sm text-gray-500">Require immediate attention</p>
              </div>
            </div>
            <Link
              to="/ipd/deterioration"
              className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Patient</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ward / Bed</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">NEWS2</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Risk</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Trend</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Last Vitals</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {(highRiskPatients || deteriorationDashboard?.patients?.filter((p: any) =>
                  p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL'
                ))?.slice(0, 5).map((patient: any) => (
                  <tr key={patient.id} className="border-b border-gray-50 hover:bg-red-50/50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{patient.patientName || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{patient.mrn || '-'}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {patient.ward || 'N/A'} / Bed {patient.bedNumber || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-lg font-bold text-red-600">{patient.news2Score ?? '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(patient.riskLevel || '')}`}>
                        {(patient.riskLevel || 'UNKNOWN').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {getTrendIcon(patient.trend || '')}
                        <span className="text-sm text-gray-600 capitalize">{patient.trend || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {patient.vitalsOverdue ? (
                        <span className="text-red-600 font-medium">Overdue</span>
                      ) : (
                        <span className="text-gray-600">{patient.lastVitalsTime || 'N/A'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {patient.admissionId ? (
                        <Link
                          to={`/ipd/admission/${patient.admissionId}/vitals`}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Record Vitals
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/opd"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <VitalsClipboardAIIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Record OPD Vitals</p>
            <p className="text-xs text-gray-500">Pre-consultation</p>
          </div>
        </Link>
        <Link
          to="/ipd/admissions"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-indigo-500 group-hover:scale-110 transition-transform">
            <HospitalBedIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">IPD Admissions</p>
            <p className="text-xs text-gray-500">View patients</p>
          </div>
        </Link>
        <Link
          to="/medication-administration"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-pink-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-pink-500 group-hover:scale-110 transition-transform">
            <HeartIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Medication Due</p>
            <p className="text-xs text-gray-500">Administration</p>
          </div>
        </Link>
        <Link
          to="/ipd/deterioration"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-red-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-red-500 group-hover:scale-110 transition-transform">
            <MedicalCrossHeartbeatIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Early Warning</p>
            <p className="text-xs text-gray-500">NEWS2 dashboard</p>
          </div>
        </Link>
      </div>

      {/* Vitals Recording Modal */}
      {vitalsPatient && (
        <VitalsRecordingModal
          appointment={vitalsPatient}
          onClose={() => setVitalsPatient(null)}
          onSuccess={() => {
            setVitalsPatient(null);
            refetchAll();
          }}
        />
      )}
    </div>
  );
}
