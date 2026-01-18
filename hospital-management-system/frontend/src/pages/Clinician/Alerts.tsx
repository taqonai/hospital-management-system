import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  BeakerIcon,
  EyeIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { clinicianApi } from '../../services/api';
import { format } from 'date-fns';

interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  alertType: string;
  dataType: string;
  value: number;
  unit: string;
  timestamp: string;
  message: string;
}

export default function ClinicianAlerts() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clinician-alerts-full'],
    queryFn: async () => {
      const response = await clinicianApi.getAlerts({ acknowledged: false });
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const alerts: Alert[] = data?.data?.alerts || [];

  const getAlertIcon = (dataType: string) => {
    if (dataType.includes('HEART') || dataType.includes('BLOOD_PRESSURE')) {
      return <HeartIcon className="h-6 w-6" />;
    }
    if (dataType.includes('BLOOD') || dataType.includes('GLUCOSE')) {
      return <BeakerIcon className="h-6 w-6" />;
    }
    return <ExclamationTriangleIcon className="h-6 w-6" />;
  };

  const getAlertSeverity = (value: number, dataType: string) => {
    // Define severity based on how far from normal the value is
    const thresholds: Record<string, { critical: { low?: number; high?: number }; warning: { low?: number; high?: number } }> = {
      'HEART_RATE': { critical: { low: 40, high: 150 }, warning: { low: 50, high: 120 } },
      'BLOOD_OXYGEN': { critical: { low: 90 }, warning: { low: 94 } },
      'BLOOD_PRESSURE_SYSTOLIC': { critical: { low: 80, high: 180 }, warning: { low: 90, high: 160 } },
      'BLOOD_GLUCOSE': { critical: { low: 50, high: 300 }, warning: { low: 70, high: 200 } },
    };

    const threshold = thresholds[dataType];
    if (!threshold) return 'warning';

    if (threshold.critical.low && value <= threshold.critical.low) return 'critical';
    if (threshold.critical.high && value >= threshold.critical.high) return 'critical';
    return 'warning';
  };

  const filteredAlerts = filter === 'all'
    ? alerts
    : alerts.filter(alert => getAlertSeverity(alert.value, alert.dataType) === filter);

  const criticalCount = alerts.filter(a => getAlertSeverity(a.value, a.dataType) === 'critical').length;
  const warningCount = alerts.filter(a => getAlertSeverity(a.value, a.dataType) === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/clinician"
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Critical Value Alerts</h1>
          <p className="text-gray-500 mt-1">Monitor abnormal health readings that require attention</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
        >
          <ArrowPathIcon className="h-5 w-5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-gray-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{alerts.length}</p>
              <p className="text-sm text-gray-500">Total Alerts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              <p className="text-sm text-gray-500">Critical</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
              <p className="text-sm text-gray-500">Warning</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'critical'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Critical ({criticalCount})
        </button>
        <button
          onClick={() => setFilter('warning')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'warning'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Warning ({warningCount})
        </button>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-900 font-medium">No alerts to show</p>
            <p className="text-gray-500 text-sm mt-1">All patient readings are within normal ranges</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAlerts.map((alert) => {
              const severity = getAlertSeverity(alert.value, alert.dataType);
              return (
                <div key={alert.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${
                      severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {getAlertIcon(alert.dataType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {severity.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {alert.dataType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{alert.patientName}</p>
                      <p className="text-sm text-gray-500">MRN: {alert.patientMrn}</p>
                      <p className={`text-sm font-medium mt-1 ${
                        severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                        <ClockIcon className="h-4 w-4" />
                        {format(new Date(alert.timestamp), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link
                        to={`/clinician/patients/${alert.patientId}`}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View Patient
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-center text-sm text-gray-400">
        Alerts auto-refresh every 30 seconds
      </div>
    </div>
  );
}
