import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  UsersIcon,
  BeakerIcon,
  HeartIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { clinicianApi } from '../../services/api';
import { format } from 'date-fns';

interface PatientRosterItem {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  photo?: string;
  _count: {
    healthDataPoints: number;
    recommendations: number;
    dailyHealthScores: number;
  };
  genomicProfile?: {
    id: string;
    status: string;
    processedAt?: string;
  };
  healthDeviceConnections: Array<{
    provider: string;
    lastSyncAt: string;
  }>;
}

export default function ClinicianDashboard() {
  const [search, setSearch] = useState('');
  const [hasGenomic, setHasGenomic] = useState(false);
  const [hasWearable, setHasWearable] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clinician-patients', { page, search, hasGenomic, hasWearable }],
    queryFn: async () => {
      const response = await clinicianApi.getPatientRoster({
        search: search || undefined,
        hasGenomic: hasGenomic || undefined,
        hasWearable: hasWearable || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      return response.data;
    },
  });

  const { data: alertsData } = useQuery({
    queryKey: ['clinician-alerts'],
    queryFn: async () => {
      const response = await clinicianApi.getAlerts({ acknowledged: false });
      return response.data;
    },
  });

  const patients: PatientRosterItem[] = data?.data?.patients || [];
  const pagination = data?.data?.pagination;
  const alerts = alertsData?.data?.alerts || [];
  const totalPages = pagination ? Math.ceil(pagination.total / limit) : 1;

  const stats = [
    { label: 'Total Patients', value: pagination?.total || 0, icon: UsersIcon, color: 'bg-blue-500' },
    { label: 'With Genomic Data', value: patients.filter(p => p.genomicProfile).length, icon: BeakerIcon, color: 'bg-purple-500' },
    { label: 'Connected Wearables', value: patients.filter(p => p.healthDeviceConnections.length > 0).length, icon: HeartIcon, color: 'bg-green-500' },
    { label: 'Critical Alerts', value: alerts.length, icon: ExclamationTriangleIcon, color: alerts.length > 0 ? 'bg-red-500' : 'bg-gray-400' },
  ];

  const getDeviceProviderBadge = (provider: string) => {
    const providers: Record<string, { label: string; color: string }> = {
      'APPLE_HEALTH': { label: 'Apple Health', color: 'bg-gray-900 text-white' },
      'GOOGLE_FIT': { label: 'Google Fit', color: 'bg-blue-600 text-white' },
      'SAMSUNG_HEALTH': { label: 'Samsung Health', color: 'bg-indigo-600 text-white' },
      'FITBIT': { label: 'Fitbit', color: 'bg-teal-600 text-white' },
      'GARMIN': { label: 'Garmin', color: 'bg-orange-600 text-white' },
    };
    return providers[provider] || { label: provider, color: 'bg-gray-500 text-white' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Precision Health Dashboard</h1>
          <p className="text-gray-500 mt-1">Monitor patient health data, genomics, and AI recommendations</p>
        </div>
        <Link
          to="/clinician/alerts"
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            alerts.length > 0
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <ExclamationTriangleIcon className="h-5 w-5" />
          {alerts.length > 0 ? `${alerts.length} Alerts` : 'No Alerts'}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Critical Alerts Preview */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Critical Value Alerts</h3>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert: any) => (
              <div key={alert.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-100">
                <div>
                  <p className="font-medium text-gray-900">{alert.patientName} ({alert.patientMrn})</p>
                  <p className="text-sm text-red-600">{alert.message}</p>
                </div>
                <Link
                  to={`/clinician/patients/${alert.patientId}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>
          {alerts.length > 3 && (
            <Link to="/clinician/alerts" className="text-red-600 hover:text-red-800 text-sm font-medium mt-2 inline-block">
              View all {alerts.length} alerts
            </Link>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, MRN, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setHasGenomic(!hasGenomic);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                hasGenomic
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <BeakerIcon className="h-5 w-5 inline mr-1" />
              Genomic
            </button>
            <button
              onClick={() => {
                setHasWearable(!hasWearable);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                hasWearable
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <HeartIcon className="h-5 w-5 inline mr-1" />
              Wearable
            </button>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Sources</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Health Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Sync</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Loading patients...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No patients found matching your criteria
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          {patient.photo ? (
                            <img className="h-10 w-10 rounded-full object-cover" src={patient.photo} alt="" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600 font-medium text-sm">
                                {patient.firstName[0]}{patient.lastName[0]}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.firstName} {patient.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            MRN: {patient.mrn}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.email}</div>
                      <div className="text-sm text-gray-500">{patient.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {patient.genomicProfile && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            patient.genomicProfile.status === 'COMPLETED'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            <BeakerIcon className="h-3 w-3 mr-1" />
                            Genomic
                          </span>
                        )}
                        {patient.healthDeviceConnections.map((conn, idx) => {
                          const badge = getDeviceProviderBadge(conn.provider);
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })}
                        {!patient.genomicProfile && patient.healthDeviceConnections.length === 0 && (
                          <span className="text-gray-400 text-sm">No data sources</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <span className="inline-flex items-center gap-1">
                          <ChartBarIcon className="h-4 w-4 text-blue-500" />
                          {patient._count.healthDataPoints} points
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {patient._count.recommendations} recommendations
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {patient.healthDeviceConnections.length > 0 ? (
                        <div className="text-sm">
                          <span className="text-gray-900">
                            {format(new Date(patient.healthDeviceConnections[0].lastSyncAt), 'MMM d, HH:mm')}
                          </span>
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircleIcon className="h-4 w-4" />
                            <span className="text-xs">Synced</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          No sync
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/clinician/patients/${patient.id}`}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View Summary
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.total > limit && (
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} patients
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className="px-4 py-2 text-sm font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
