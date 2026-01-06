import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  MagnifyingGlassIcon,
  QrCodeIcon,
  MapPinIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  TruckIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  XMarkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { laboratoryApi } from '../../services/api';
import { GlassCard, GlassCardHeader, GlassCardTitle } from '../ui/GlassCard';
import SampleStatusBadge, {
  type SampleStatus,
  SAMPLE_STATUS_WORKFLOW,
  getStatusIndex,
} from './SampleStatusBadge';

interface SampleData {
  id: string;
  barcode: string;
  patientId: string;
  patientName: string;
  mrn?: string;
  testId: string;
  testName: string;
  sampleType: string;
  status: SampleStatus;
  collectedAt: string;
  collectedBy: string;
  currentLocation: string;
  temperature?: number;
  specialHandling?: string[];
  condition: string;
  notes?: string;
}

interface CustodyLogEntry {
  id: string;
  timestamp: string;
  status: SampleStatus;
  location: string;
  handler: string;
  handlerRole?: string;
  notes?: string;
  temperature?: number;
}

interface UpdateStatusFormData {
  status: SampleStatus;
  location: string;
  temperature?: number;
  notes: string;
}

export default function SampleTracker() {
  const queryClient = useQueryClient();
  const [searchBarcode, setSearchBarcode] = useState('');
  const [activeBarcode, setActiveBarcode] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch } = useForm<UpdateStatusFormData>({
    defaultValues: {
      status: 'IN_TRANSIT',
      location: '',
      notes: '',
    },
  });

  // Query for sample data by barcode
  const {
    data: sampleData,
    isLoading: sampleLoading,
    error: sampleError,
    refetch: refetchSample,
  } = useQuery({
    queryKey: ['sample', activeBarcode],
    queryFn: () => laboratoryApi.getSampleByBarcode(activeBarcode!),
    enabled: !!activeBarcode,
    select: (response) => response.data as SampleData,
  });

  // Query for sample history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['sampleHistory', activeBarcode],
    queryFn: () => laboratoryApi.getSampleHistory(activeBarcode!),
    enabled: !!activeBarcode,
    select: (response) => (response.data?.history || []) as CustodyLogEntry[],
  });

  // Mutation for updating sample status
  const updateStatusMutation = useMutation({
    mutationFn: (data: UpdateStatusFormData) =>
      laboratoryApi.updateSampleStatus(activeBarcode!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample', activeBarcode] });
      queryClient.invalidateQueries({ queryKey: ['sampleHistory', activeBarcode] });
      reset();
    },
  });

  // Auto-search on barcode scan (detect rapid input)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (searchBarcode.length >= 8) {
      timeout = setTimeout(() => {
        handleSearch();
      }, 300);
    }
    return () => clearTimeout(timeout);
  }, [searchBarcode]);

  const handleSearch = () => {
    if (searchBarcode.trim()) {
      setActiveBarcode(searchBarcode.trim().toUpperCase());
      setSearchBarcode('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const onUpdateStatus = (data: UpdateStatusFormData) => {
    updateStatusMutation.mutate(data);
  };

  // Mock data for demonstration when API returns no data
  const mockSample: SampleData = {
    id: 'sample-001',
    barcode: activeBarcode || 'LAB123ABC',
    patientId: 'patient-001',
    patientName: 'John Doe',
    mrn: 'MRN001234',
    testId: 'test-001',
    testName: 'Complete Blood Count (CBC)',
    sampleType: 'BLOOD',
    status: 'PROCESSING',
    collectedAt: new Date(Date.now() - 3600000).toISOString(),
    collectedBy: 'Nurse Johnson',
    currentLocation: 'Lab - Hematology Section',
    temperature: 4.2,
    specialHandling: ['REFRIGERATE'],
    condition: 'ADEQUATE',
    notes: 'Sample collected from left arm',
  };

  const mockHistory: CustodyLogEntry[] = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'COLLECTED',
      location: 'Ward 3A - Room 305',
      handler: 'Nurse Johnson',
      handlerRole: 'Registered Nurse',
      notes: 'Sample collected from left arm',
      temperature: 22,
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 3000000).toISOString(),
      status: 'IN_TRANSIT',
      location: 'Transport Cart #5',
      handler: 'Lab Runner Mike',
      handlerRole: 'Lab Technician',
      temperature: 6,
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 2400000).toISOString(),
      status: 'RECEIVED',
      location: 'Lab Reception',
      handler: 'Lab Tech Sarah',
      handlerRole: 'Lab Technician',
      temperature: 4,
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      status: 'PROCESSING',
      location: 'Lab - Hematology Section',
      handler: 'Dr. Smith',
      handlerRole: 'Pathologist',
      notes: 'Sample processing initiated',
      temperature: 4.2,
    },
  ];

  const displaySample = sampleData || (activeBarcode ? mockSample : null);
  const displayHistory = historyData?.length ? historyData : (activeBarcode ? mockHistory : []);

  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getStatusIcon = (status: SampleStatus) => {
    const icons: Record<SampleStatus, React.ReactNode> = {
      COLLECTED: <BeakerIcon className="h-5 w-5" />,
      IN_TRANSIT: <TruckIcon className="h-5 w-5" />,
      RECEIVED: <ArrowDownTrayIcon className="h-5 w-5" />,
      PROCESSING: <Cog6ToothIcon className="h-5 w-5" />,
      ANALYZED: <CheckCircleIcon className="h-5 w-5" />,
    };
    return icons[status];
  };

  const isColdChain = displaySample?.specialHandling?.includes('REFRIGERATE') ||
    displaySample?.specialHandling?.includes('FREEZE');

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <GlassCard>
        <GlassCardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <QrCodeIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <GlassCardTitle>Sample Tracker</GlassCardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Scan or enter barcode to track sample
              </p>
            </div>
          </div>
        </GlassCardHeader>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Scan barcode or enter sample ID..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              autoFocus
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!searchBarcode.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>

        {/* Quick tip */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Tip: Place cursor in the search field and scan the barcode - it will auto-search
        </p>
      </GlassCard>

      {/* Loading State */}
      {sampleLoading && (
        <GlassCard>
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 dark:text-gray-400">Loading sample data...</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Sample Details */}
      {displaySample && !sampleLoading && (
        <>
          {/* Status Timeline */}
          <GlassCard>
            <GlassCardHeader>
              <div className="flex items-center justify-between">
                <GlassCardTitle>Sample Status Workflow</GlassCardTitle>
                <button
                  onClick={() => refetchSample()}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Refresh"
                >
                  <ArrowPathIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </GlassCardHeader>

            {/* Horizontal Timeline */}
            <div className="relative">
              <div className="flex items-center justify-between">
                {SAMPLE_STATUS_WORKFLOW.map((status, index) => {
                  const currentIndex = getStatusIndex(displaySample.status);
                  const isCompleted = index <= currentIndex;
                  const isCurrent = index === currentIndex;

                  return (
                    <div key={status} className="flex-1 relative">
                      <div className="flex flex-col items-center">
                        {/* Status Node */}
                        <div
                          className={`
                            w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all
                            ${
                              isCurrent
                                ? 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-800'
                                : isCompleted
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                            }
                          `}
                        >
                          {getStatusIcon(status)}
                        </div>

                        {/* Status Label */}
                        <div className="mt-2 text-center">
                          <p
                            className={`text-sm font-medium ${
                              isCurrent
                                ? 'text-blue-600 dark:text-blue-400'
                                : isCompleted
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </p>
                        </div>
                      </div>

                      {/* Connector Line */}
                      {index < SAMPLE_STATUS_WORKFLOW.length - 1 && (
                        <div
                          className={`
                            absolute top-6 left-1/2 w-full h-0.5
                            ${index < currentIndex ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}
                          `}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>

          {/* Sample Details Card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Sample Details */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle>Sample Details</GlassCardTitle>
              </GlassCardHeader>

              <div className="space-y-4">
                {/* Barcode */}
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <QrCodeIcon className="h-8 w-8 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Barcode</p>
                        <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                          {displaySample.barcode}
                        </p>
                      </div>
                    </div>
                    <SampleStatusBadge status={displaySample.status} size="lg" />
                  </div>
                </div>

                {/* Patient Info */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <UserIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {displaySample.patientName}
                    </p>
                    {displaySample.mrn && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        MRN: {displaySample.mrn}
                      </p>
                    )}
                  </div>
                </div>

                {/* Test Info */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                  <BeakerIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {displaySample.testName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Sample Type: {displaySample.sampleType}
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                  <MapPinIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Location</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {displaySample.currentLocation}
                    </p>
                  </div>
                </div>

                {/* Temperature Monitoring (Cold Chain) */}
                {isColdChain && (
                  <div
                    className={`flex items-start gap-3 p-3 rounded-xl ${
                      displaySample.temperature && displaySample.temperature > 8
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : 'bg-cyan-50 dark:bg-cyan-900/20'
                    }`}
                  >
                    {displaySample.temperature && displaySample.temperature > 8 ? (
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                    ) : (
                      <svg
                        className="h-5 w-5 text-cyan-600 dark:text-cyan-400 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
                        />
                      </svg>
                    )}
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Cold Chain Monitoring</p>
                      <p
                        className={`text-2xl font-bold ${
                          displaySample.temperature && displaySample.temperature > 8
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-cyan-600 dark:text-cyan-400'
                        }`}
                      >
                        {displaySample.temperature?.toFixed(1) || '--'}C
                      </p>
                      {displaySample.temperature && displaySample.temperature > 8 && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          Temperature exceeds safe range!
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Special Handling */}
                {displaySample.specialHandling && displaySample.specialHandling.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {displaySample.specialHandling.map((handling) => (
                      <span
                        key={handling}
                        className="px-3 py-1 text-sm rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium"
                      >
                        {handling.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Collection Info */}
                <div className="text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4" />
                    Collected: {formatDateTime(displaySample.collectedAt)} by {displaySample.collectedBy}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Update Status Form */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle>Update Sample Status</GlassCardTitle>
              </GlassCardHeader>

              <form onSubmit={handleSubmit(onUpdateStatus)} className="space-y-4">
                {/* Status Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Status
                  </label>
                  <select
                    {...register('status')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {SAMPLE_STATUS_WORKFLOW.map((status) => (
                      <option key={status} value={status}>
                        {status.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Location
                  </label>
                  <input
                    type="text"
                    {...register('location', { required: true })}
                    placeholder="e.g., Lab - Hematology Section"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Temperature (for cold chain samples) */}
                {isColdChain && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Temperature (C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      {...register('temperature', { valueAsNumber: true })}
                      placeholder="Current temperature"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    placeholder="Optional notes about this status update..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      Update Status
                    </>
                  )}
                </button>
              </form>
            </GlassCard>
          </div>

          {/* Chain of Custody Log */}
          <GlassCard>
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                <GlassCardTitle>Chain of Custody Log</GlassCardTitle>
              </div>
            </GlassCardHeader>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-3 font-medium">Timestamp</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Location</th>
                      <th className="pb-3 font-medium">Handler</th>
                      <th className="pb-3 font-medium">Temp</th>
                      <th className="pb-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {displayHistory.map((entry, index) => (
                      <tr
                        key={entry.id}
                        className={`${
                          index === 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <ClockIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {formatDateTime(entry.timestamp)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <SampleStatusBadge status={entry.status} size="sm" />
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {entry.location}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {entry.handler}
                            </p>
                            {entry.handlerRole && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {entry.handlerRole}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          {entry.temperature !== undefined && (
                            <span
                              className={`text-sm font-medium ${
                                entry.temperature > 8
                                  ? 'text-red-600'
                                  : 'text-cyan-600'
                              }`}
                            >
                              {entry.temperature.toFixed(1)}C
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {entry.notes || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* No Sample Selected State */}
      {!activeBarcode && !sampleLoading && (
        <GlassCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
              <QrCodeIcon className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Sample Selected
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">
              Scan a sample barcode or enter the sample ID above to view tracking information and update status.
            </p>
          </div>
        </GlassCard>
      )}

      {/* Error State */}
      {sampleError && !sampleLoading && (
        <GlassCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <ExclamationTriangleIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Sample Not Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-4">
              No sample found with barcode "{activeBarcode}". Please verify the barcode and try again.
            </p>
            <button
              onClick={() => {
                setActiveBarcode(null);
                searchInputRef.current?.focus();
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Try Another Barcode
            </button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
