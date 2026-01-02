import { useState, useEffect, useCallback } from 'react';
import {
  BellAlertIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  ChartBarIcon,
  CalculatorIcon,
  FunnelIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  HeartIcon,
  PlayIcon,
  PauseIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ShieldExclamationIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

// Hooks
import {
  useWardOverview,
  usePatientAlerts,
  useAcknowledgeAlert,
  useEscalateAlert,
  useVitalsSubmission,
  usePatientTrends,
  useAlertSound,
} from '../../hooks/useEarlyWarning';
import type { Patient, VitalsInput } from '../../hooks/useEarlyWarning';

// Components
import PatientCard from '../../components/ews/PatientCard';
import AlertPanel from '../../components/ews/AlertPanel';
import VitalsForm from '../../components/ews/VitalsForm';
import EWSCalculator from '../../components/nursing/EWSCalculator';
import VitalsTrendChart from '../../components/nursing/VitalsTrendChart';

type TabType = 'dashboard' | 'alerts' | 'calculator' | 'trends';
type ViewMode = 'grid' | 'list';

export default function EarlyWarning() {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [vitalsPatient, setVitalsPatient] = useState<Patient | null>(null);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  // Hooks
  const {
    patients,
    stats,
    wards,
    isLoading,
    isFetching,
    refetch: refetchDashboard,
  } = useWardOverview(selectedWard || undefined);

  const {
    alerts,
    activeAlerts,
    criticalAlerts,
    refetch: refetchAlerts,
  } = usePatientAlerts(selectedWard || undefined);

  const { acknowledgeAlert } = useAcknowledgeAlert();
  const { escalateAlert } = useEscalateAlert();
  const {
    submitVitals,
    isSubmitting: isSubmittingVitals,
    error: vitalsError,
    data: vitalsData,
  } = useVitalsSubmission();
  const { soundEnabled, toggleSound, playAlertSound } = useAlertSound();
  const { trendData, isLoading: trendsLoading } = usePatientTrends(
    selectedPatient?.patientId || null
  );

  // Auto-refresh countdown
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRefresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

  // Play sound for new critical alerts
  useEffect(() => {
    if (criticalAlerts.length > 0) {
      playAlertSound('critical');
    }
  }, [criticalAlerts.length]);

  const handleRefresh = useCallback(() => {
    setCountdown(30);
    refetchDashboard();
    refetchAlerts();
    setLastRefresh(new Date());
  }, [refetchDashboard, refetchAlerts]);

  const handleViewTrends = (patientId: string) => {
    const patient = patients.find((p) => p.patientId === patientId);
    if (patient) {
      setSelectedPatient(patient);
      setActiveTab('trends');
    }
  };

  const handleRecordVitals = (patient: Patient) => {
    setVitalsPatient(patient);
    setShowVitalsForm(true);
  };

  const handleSubmitVitals = (vitals: VitalsInput) => {
    if (!vitalsPatient) return;
    submitVitals(
      { patientId: vitalsPatient.patientId, vitals },
      {
        onSuccess: () => {
          setTimeout(() => {
            setShowVitalsForm(false);
            setVitalsPatient(null);
            handleRefresh();
          }, 1500);
        },
      }
    );
  };

  const handleAcknowledgeAlert = (alertId: string, notes?: string) => {
    acknowledgeAlert({ alertId, notes });
  };

  const handleEscalateAlert = (alertId: string, level: number, notes?: string) => {
    escalateAlert({ alertId, escalationLevel: level, notes });
  };

  const handleEscalatePatient = (patient: Patient) => {
    // Find the active alert for this patient and escalate it
    const patientAlert = activeAlerts.find((a) => a.patientId === patient.patientId);
    if (patientAlert) {
      escalateAlert({
        alertId: patientAlert.id,
        escalationLevel: (patientAlert.escalationLevel || 0) + 1,
      });
    }
  };

  // Filter patients by risk level
  const filteredPatients = riskFilter === 'all'
    ? patients
    : patients.filter((p) => p.riskLevel === riskFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl shadow-xl shadow-red-500/25">
            <BellAlertIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Early Warning System</h1>
            <p className="text-gray-500">NEWS2+ Clinical Deterioration Monitoring</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              autoRefreshEnabled
                ? 'bg-green-100 text-green-700 border border-green-200 shadow-sm'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {autoRefreshEnabled ? (
              <>
                <PlayIcon className="h-4 w-4" />
                <span>Auto: {countdown}s</span>
              </>
            ) : (
              <>
                <PauseIcon className="h-4 w-4" />
                <span>Paused</span>
              </>
            )}
          </button>

          <span className="text-sm text-gray-500 hidden md:inline">
            Updated: {lastRefresh.toLocaleTimeString()}
          </span>

          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh data"
          >
            <ArrowPathIcon className={`h-5 w-5 text-gray-600 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {criticalAlerts.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl shadow-xl animate-pulse">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-xl">
              <ExclamationTriangleIcon className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg">
                {criticalAlerts.length} CRITICAL ALERT{criticalAlerts.length > 1 ? 'S' : ''} - IMMEDIATE ACTION REQUIRED
              </p>
              <p className="text-sm text-red-100 mt-1">
                {criticalAlerts.map((a) => `${a.patientName} (${a.ward} Bed ${a.bed})`).join(' | ')}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('alerts')}
              className="px-4 py-2 bg-white text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors"
            >
              View Alerts
            </button>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 p-4 shadow-sm">
            <UserGroupIcon className="h-5 w-5 text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats.totalPatients}</p>
            <p className="text-xs text-gray-500">Total Patients</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border border-red-200 p-4 shadow-sm">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mb-2" />
            <p className="text-2xl font-bold text-red-600">{stats.criticalCount}</p>
            <p className="text-xs text-red-600">Critical (9+)</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border border-orange-200 p-4 shadow-sm">
            <BellAlertIcon className="h-5 w-5 text-orange-600 mb-2" />
            <p className="text-2xl font-bold text-orange-600">{stats.highCount}</p>
            <p className="text-xs text-orange-600">High (7-8)</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-2xl border border-yellow-200 p-4 shadow-sm">
            <HeartIcon className="h-5 w-5 text-yellow-600 mb-2" />
            <p className="text-2xl font-bold text-yellow-600">{stats.mediumCount}</p>
            <p className="text-xs text-yellow-600">Medium (5-6)</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl border border-green-200 p-4 shadow-sm">
            <CheckCircleIcon className="h-5 w-5 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats.lowCount}</p>
            <p className="text-xs text-green-600">Low (0-4)</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200 p-4 shadow-sm">
            <ClockIcon className="h-5 w-5 text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-purple-600">{stats.vitalsOverdueCount}</p>
            <p className="text-xs text-purple-600">Vitals Due</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-pink-100 rounded-2xl border border-red-200 p-4 shadow-sm">
            <ArrowTrendingUpIcon className="h-5 w-5 text-red-600 mb-2" />
            <p className="text-2xl font-bold text-red-600">{stats.worseningCount}</p>
            <p className="text-xs text-red-600">Worsening</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-2xl border border-green-200 p-4 shadow-sm">
            <ArrowTrendingDownIcon className="h-5 w-5 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats.improvingCount}</p>
            <p className="text-xs text-green-600">Improving</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        {/* Tabs and Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 px-4 bg-gray-50/50">
          <nav className="flex -mb-px overflow-x-auto">
            {[
              { id: 'dashboard' as TabType, label: 'Ward Overview', icon: UserGroupIcon },
              {
                id: 'alerts' as TabType,
                label: 'Active Alerts',
                icon: BellAlertIcon,
                badge: activeAlerts.length,
              },
              { id: 'calculator' as TabType, label: 'NEWS2 Calculator', icon: CalculatorIcon },
              { id: 'trends' as TabType, label: 'Vital Trends', icon: ChartBarIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                      tab.id === 'alerts' && criticalAlerts.length > 0
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Filters */}
          <div className="flex items-center gap-3 py-3 md:py-0">
            {/* View Mode Toggle (Dashboard only) */}
            {activeTab === 'dashboard' && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
                  }`}
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Risk Filter (Dashboard only) */}
            {activeTab === 'dashboard' && (
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical Only</option>
                <option value="high">High Only</option>
                <option value="medium">Medium Only</option>
                <option value="low">Low Only</option>
              </select>
            )}

            {/* Ward Filter */}
            {wards && wards.length > 0 && (
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-4 w-4 text-gray-400" />
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Wards</option>
                  {wards.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {ward.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-16">
                  <UserGroupIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 font-medium">No patients found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {riskFilter !== 'all'
                      ? 'Try changing the risk filter'
                      : 'No admitted patients with NEWS2 scores'}
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredPatients.map((patient) => (
                    <PatientCard
                      key={patient.patientId}
                      patient={patient}
                      onRecordVitals={handleRecordVitals}
                      onViewTrends={handleViewTrends}
                      onEscalate={handleEscalatePatient}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPatients.map((patient) => (
                    <PatientCard
                      key={patient.patientId}
                      patient={patient}
                      onRecordVitals={handleRecordVitals}
                      onViewTrends={handleViewTrends}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <AlertPanel
              alerts={alerts}
              onAcknowledge={handleAcknowledgeAlert}
              onEscalate={handleEscalateAlert}
              onViewPatient={handleViewTrends}
              soundEnabled={soundEnabled}
              onToggleSound={toggleSound}
            />
          )}

          {/* Calculator Tab */}
          {activeTab === 'calculator' && (
            <EWSCalculator
              onCalculate={(result) => console.log('Calculated:', result)}
              onSave={(vitals, result) => {
                console.log('Save vitals:', vitals, result);
              }}
            />
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div>
              {selectedPatient ? (
                <div>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="mb-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    &larr; Back to patient list
                  </button>
                  {trendsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : trendData ? (
                    <VitalsTrendChart
                      data={trendData}
                      patientName={selectedPatient.patientName}
                      hours={24}
                    />
                  ) : (
                    <div className="text-center py-16 text-gray-500">
                      <ChartBarIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <p>No trend data available for this patient</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <ChartBarIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 font-medium">Select a patient to view trends</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Click on any patient card from the Ward Overview tab
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sepsis & Fall Risk Indicators Legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sepsis Screening */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-xl">
              <ShieldExclamationIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Sepsis Screening (qSOFA)</h3>
              <p className="text-sm text-gray-500">Quick Sequential Organ Failure Assessment</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center font-bold">1</span>
              Respiratory rate &ge; 22/min
            </p>
            <p className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center font-bold">1</span>
              Systolic BP &le; 100 mmHg
            </p>
            <p className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center font-bold">1</span>
              Altered mental status (not Alert)
            </p>
            <p className="mt-3 p-2 bg-purple-50 rounded-lg text-purple-700 font-medium">
              Score &ge; 2: Consider sepsis workup and early intervention
            </p>
          </div>
        </div>

        {/* Fall Risk */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-xl">
              <ExclamationCircleIcon className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Fall Risk Assessment</h3>
              <p className="text-sm text-gray-500">Based on NEWS2 and patient factors</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-green-50 rounded-xl text-center border border-green-200">
              <p className="text-lg font-bold text-green-600">Low</p>
              <p className="text-xs text-green-600">Standard precautions</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-xl text-center border border-yellow-200">
              <p className="text-lg font-bold text-yellow-600">Medium</p>
              <p className="text-xs text-yellow-600">Enhanced monitoring</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl text-center border border-red-200">
              <p className="text-lg font-bold text-red-600">High</p>
              <p className="text-xs text-red-600">1:1 supervision</p>
            </div>
          </div>
        </div>
      </div>

      {/* NEWS2 Escalation Pathway */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4 text-lg">NEWS2 Escalation Pathway</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-green-500 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-lg">
                0-4
              </div>
              <span className="font-bold text-green-700">Low Risk</span>
            </div>
            <p className="text-sm text-green-600">Routine monitoring (min 12 hourly)</p>
            <p className="text-xs text-green-500 mt-2">Continue current management</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-100 rounded-xl border border-yellow-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-yellow-500 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-lg">
                5-6
              </div>
              <span className="font-bold text-yellow-700">Medium Risk</span>
            </div>
            <p className="text-sm text-yellow-600">4-6 hourly monitoring, inform nurse-in-charge</p>
            <p className="text-xs text-yellow-500 mt-2">Urgent review if single score = 3</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-lg">
                7-8
              </div>
              <span className="font-bold text-orange-700">High Risk</span>
            </div>
            <p className="text-sm text-orange-600">Hourly monitoring, urgent clinical review within 30 mins</p>
            <p className="text-xs text-orange-500 mt-2">Consider HDU/critical care</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-lg animate-pulse">
                9+
              </div>
              <span className="font-bold text-red-700">Critical</span>
            </div>
            <p className="text-sm text-red-600">Emergency response, continuous monitoring</p>
            <p className="text-xs text-red-500 mt-2">Immediate senior review, ICU referral</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
            <strong>Note:</strong> A single parameter score of 3 in any category triggers urgent response regardless of total score.
          </p>
        </div>
      </div>

      {/* Vitals Form Modal */}
      {showVitalsForm && vitalsPatient && (
        <VitalsForm
          patient={vitalsPatient}
          onSubmit={handleSubmitVitals}
          onCancel={() => {
            setShowVitalsForm(false);
            setVitalsPatient(null);
          }}
          isSubmitting={isSubmittingVitals}
          isSuccess={!!vitalsData}
          error={vitalsError?.message || null}
        />
      )}
    </div>
  );
}
