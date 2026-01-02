import { useState, useEffect } from 'react';
import {
  CalendarDaysIcon,
  ClockIcon,
  SparklesIcon,
  CheckCircleIcon,
  PlusIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { surgeryApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Surgery {
  id: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  primarySurgeon: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  procedureName: string;
  operationTheatre: string;
  scheduledStart: string;
  estimatedDuration: number;
  status: string;
  riskLevel?: string;
}

interface OTStatus {
  id: string;
  name: string;
  status: string;
  currentSurgery?: {
    procedureName: string;
  };
}

interface SurgeryStats {
  scheduledToday: number;
  inProgress: number;
  completed: number;
  otsAvailable: number;
}

interface DurationResult {
  predictedDuration: number;
  durationRange: { min: number; max: number };
  confidence: string;
  complexity: string;
  factors: string[];
  otPreparationTime: number;
  totalBlockTime: number;
}

interface RiskResult {
  overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  mortalityRisk: string;
  complicationRisk: string;
  components: { patientFactors: number; surgicalFactors: number; anesthesiaFactors: number };
  riskFactors: { factor: string; impact: string; description: string }[];
  recommendations: string[];
  preOpRequirements: string[];
}

export default function Surgery() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'ot' | 'preop' | 'risk'>('schedule');
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [otStatus, setOtStatus] = useState<OTStatus[]>([]);
  const [stats, setStats] = useState<SurgeryStats>({
    scheduledToday: 0,
    inProgress: 0,
    completed: 0,
    otsAvailable: 0,
  });
  const [loading, setLoading] = useState(true);

  // Risk Assessment Form
  const [riskForm, setRiskForm] = useState({
    procedureName: '',
    surgeryType: '',
    patientAge: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    asaScore: '',
    bmi: '',
    smokingStatus: 'never' as 'never' | 'former' | 'current',
    diabetesStatus: 'none' as 'none' | 'controlled' | 'uncontrolled',
    cardiacHistory: false,
    renalFunction: 'normal' as 'normal' | 'mild' | 'moderate' | 'severe' | 'dialysis',
    hepaticFunction: 'normal' as 'normal' | 'mild' | 'moderate' | 'severe',
    isEmergency: false,
    hasComorbidities: false,
    previousSurgeries: '',
    hemoglobin: '',
    inr: '',
    albumin: '',
  });
  const [durationResult, setDurationResult] = useState<DurationResult | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  // Fetch today's schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const response = await surgeryApi.getTodaySchedule();
        setSurgeries(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch schedule:', error);
        toast.error('Failed to load surgery schedule');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, []);

  // Fetch OT status
  useEffect(() => {
    const fetchOTStatus = async () => {
      try {
        const response = await surgeryApi.getOTStatus();
        setOtStatus(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch OT status:', error);
      }
    };

    fetchOTStatus();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await surgeryApi.getStats();
        setStats(response.data.data || {
          scheduledToday: 0,
          inProgress: 0,
          completed: 0,
          otsAvailable: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  const handleCalculateRisk = async () => {
    if (!riskForm.procedureName || !riskForm.patientAge) {
      toast.error('Please enter procedure name and patient age');
      return;
    }

    setCalculating(true);
    try {
      // Fetch duration prediction
      const durationRes = await surgeryApi.predictDuration({
        procedureName: riskForm.procedureName,
        surgeryType: riskForm.surgeryType || riskForm.procedureName,
        patientAge: Number(riskForm.patientAge),
        patientBMI: riskForm.bmi ? Number(riskForm.bmi) : undefined,
        isEmergency: riskForm.isEmergency,
        hasComorbidities: riskForm.hasComorbidities,
        previousSurgeries: riskForm.previousSurgeries ? Number(riskForm.previousSurgeries) : undefined,
      });
      setDurationResult(durationRes.data.data);

      // Fetch risk assessment
      const riskRes = await surgeryApi.assessRisk({
        procedureName: riskForm.procedureName,
        surgeryType: riskForm.surgeryType || riskForm.procedureName,
        patientAge: Number(riskForm.patientAge),
        gender: riskForm.gender,
        asaScore: riskForm.asaScore ? Number(riskForm.asaScore) : undefined,
        bmi: riskForm.bmi ? Number(riskForm.bmi) : undefined,
        smokingStatus: riskForm.smokingStatus,
        diabetesStatus: riskForm.diabetesStatus,
        cardiacHistory: riskForm.cardiacHistory,
        renalFunction: riskForm.renalFunction,
        hepaticFunction: riskForm.hepaticFunction,
        isEmergency: riskForm.isEmergency,
        recentLabResults: {
          hemoglobin: riskForm.hemoglobin ? Number(riskForm.hemoglobin) : undefined,
          inr: riskForm.inr ? Number(riskForm.inr) : undefined,
          albumin: riskForm.albumin ? Number(riskForm.albumin) : undefined,
        },
      });
      setRiskResult(riskRes.data.data);
    } catch (error) {
      console.error('Failed to calculate:', error);
      toast.error('Failed to calculate risk assessment');
    } finally {
      setCalculating(false);
    }
  };

  const handleOptimizeSchedule = () => {
    toast.success('AI is optimizing OT schedule...');
  };

  const getOTStatusConfig = (status: string) => {
    switch (status) {
      case 'IN_USE': return { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-500/10' };
      case 'AVAILABLE': return { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-500/10' };
      case 'PREPARING': return { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-500/10' };
      case 'MAINTENANCE': return { dot: 'bg-gray-500', text: 'text-gray-700', bg: 'bg-gray-500/10' };
      default: return { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-500/10' };
    }
  };

  const getRiskConfig = (risk?: string) => {
    switch (risk) {
      case 'LOW': return { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-500/10' };
      case 'MODERATE': return { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-500/10' };
      case 'HIGH': return { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-500/10' };
      case 'CRITICAL': return { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-500/10' };
      default: return { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-500/10' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-500/10' };
      case 'SCHEDULED': return { dot: 'bg-gray-500', text: 'text-gray-700', bg: 'bg-gray-500/10' };
      case 'COMPLETED': return { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-500/10' };
      case 'PRE_OP': return { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-500/10' };
      default: return { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-500/10' };
    }
  };

  const tabs = [
    { id: 'schedule', label: "Today's Schedule", count: surgeries.length },
    { id: 'ot', label: 'OT Management' },
    { id: 'preop', label: 'Pre-Op Checklist', count: surgeries.filter(s => s.status === 'SCHEDULED').length },
    { id: 'risk', label: 'AI Risk Assessment', icon: SparklesIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header with Rose/Pink Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 p-8">
        {/* Floating Orbs */}
        <div className="absolute top-4 right-12 w-32 h-32 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-2 right-1/4 w-24 h-24 bg-pink-300/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/4 w-20 h-20 bg-rose-300/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-fuchsia-400/20 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-3">
              <BeakerIcon className="h-4 w-4" />
              Surgery & OT
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Surgery / Operation Theatre</h1>
            <p className="mt-2 text-rose-100">
              OT scheduling, management, and surgical tracking
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isAIOnline && (
              <>
                <button
                  onClick={() => setActiveTab('risk')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white font-medium hover:bg-white/30 transition-all duration-300 border border-white/30"
                >
                  <ShieldExclamationIcon className="h-5 w-5" />
                  Risk Assessment
                </button>
                <button
                  onClick={handleOptimizeSchedule}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white font-medium hover:bg-white/30 transition-all duration-300 border border-white/30"
                >
                  <SparklesIcon className="h-5 w-5" />
                  Optimize Schedule
                </button>
              </>
            )}
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-rose-600 font-semibold hover:bg-rose-50 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
              <PlusIcon className="h-5 w-5" />
              Schedule Surgery
            </button>
          </div>
        </div>
      </div>

      {/* OT Status Overview - Glass Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {otStatus.length > 0 ? (
          otStatus.map((ot, index) => {
            const config = getOTStatusConfig(ot.status);
            return (
              <div
                key={ot.id}
                className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Shine line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{ot.name}</h3>
                  <div className={clsx('flex items-center gap-2 px-2.5 py-1 rounded-full', config.bg)}>
                    <div className={clsx('w-2 h-2 rounded-full animate-pulse', config.dot)} />
                    <span className={clsx('text-xs font-medium capitalize', config.text)}>
                      {ot.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {ot.currentSurgery && (
                  <p className="text-sm mt-2 text-gray-600 truncate">{ot.currentSurgery.procedureName}</p>
                )}
              </div>
            );
          })
        ) : (
          [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <h3 className="font-semibold text-gray-400">OT-{i}</h3>
              <p className="text-sm mt-1 text-gray-400">Loading...</p>
            </div>
          ))
        )}
      </div>

      {/* Animated Gradient Tabs */}
      <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-1.5">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <nav className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'relative py-3 px-4 font-medium text-sm whitespace-nowrap flex items-center gap-2 rounded-lg transition-all duration-300',
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              {activeTab === tab.id && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 shadow-lg" />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
                {tab.count !== undefined && (
                  <span className={clsx(
                    'py-0.5 px-2 rounded-full text-xs',
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-600'
                  )}>
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div
          className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          {loading ? (
            <div className="p-8 text-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-rose-400" />
              <p className="mt-2 text-gray-500">Loading schedule...</p>
            </div>
          ) : surgeries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CalendarDaysIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>No surgeries scheduled for today</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {surgeries.map((surgery, index) => {
                const statusConfig = getStatusConfig(surgery.status);
                const riskConfig = getRiskConfig(surgery.riskLevel);
                return (
                  <div
                    key={surgery.id}
                    className={clsx(
                      'p-5 hover:bg-gray-50 transition-colors',
                      surgery.status === 'IN_PROGRESS' && 'bg-blue-50/50'
                    )}
                    style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-lg font-bold text-gray-800">
                            {new Date(surgery.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {/* Glass-styled status badge */}
                          <div className={clsx(
                            'flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-sm border border-gray-200',
                            statusConfig.bg
                          )}>
                            <div className={clsx('w-2 h-2 rounded-full', statusConfig.dot)} />
                            <span className={clsx('text-xs font-medium', statusConfig.text)}>
                              {surgery.status?.replace('_', ' ')}
                            </span>
                          </div>
                          {surgery.riskLevel && (
                            <div className={clsx(
                              'flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-sm border border-gray-200',
                              riskConfig.bg
                            )}>
                              <div className={clsx('w-2 h-2 rounded-full', riskConfig.dot)} />
                              <span className={clsx('text-xs font-medium', riskConfig.text)}>
                                {surgery.riskLevel} Risk
                              </span>
                            </div>
                          )}
                        </div>
                        <h3 className="mt-2 font-semibold text-gray-800">{surgery.procedureName}</h3>
                        <p className="text-sm text-gray-600">
                          Patient: {surgery.patient?.firstName} {surgery.patient?.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          Surgeon: Dr. {surgery.primarySurgeon?.user?.firstName} {surgery.primarySurgeon?.user?.lastName} | {surgery.operationTheatre}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-gray-500">
                            <ClockIcon className="h-4 w-4" />
                            Est: {surgery.estimatedDuration} min
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 rounded-xl backdrop-blur-sm bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-all duration-300">
                          View Details
                        </button>
                        {surgery.status === 'SCHEDULED' && (
                          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-medium hover:from-rose-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
                            Start Pre-Op
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ot' && (
        <div
          className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-8 text-center shadow-lg"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <CalendarDaysIcon className="h-12 w-12 mx-auto text-rose-300 mb-4" />
          <h3 className="font-semibold text-gray-800">OT Management</h3>
          <p className="text-sm text-gray-600 mt-1">Manage operating theatre availability and maintenance</p>
        </div>
      )}

      {activeTab === 'preop' && (
        <div
          className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-8 text-center shadow-lg"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <CheckCircleIcon className="h-12 w-12 mx-auto text-rose-300 mb-4" />
          <h3 className="font-semibold text-gray-800">Pre-Operative Checklists</h3>
          <p className="text-sm text-gray-600 mt-1">Complete surgical safety checklists</p>
        </div>
      )}

      {/* AI Risk Assessment Tab */}
      {activeTab === 'risk' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div
            className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-lg"
            style={{ animation: 'fadeIn 0.5s ease-out' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <ShieldExclamationIcon className="h-6 w-6 text-fuchsia-500" />
              <h3 className="font-semibold text-lg text-gray-800">Surgical Risk & Duration Calculator</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Enter procedure and patient details for AI-powered risk assessment and duration prediction.
            </p>

            <div className="space-y-4">
              {/* Procedure Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., Hip Replacement, CABG"
                    value={riskForm.procedureName}
                    onChange={(e) => setRiskForm({ ...riskForm, procedureName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surgery Type</label>
                  <select
                    value={riskForm.surgeryType}
                    onChange={(e) => setRiskForm({ ...riskForm, surgeryType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  >
                    <option value="">Select type</option>
                    <option value="orthopedic">Orthopedic</option>
                    <option value="cardiac">Cardiac</option>
                    <option value="general">General</option>
                    <option value="neurosurgery">Neurosurgery</option>
                    <option value="gynecology">Gynecology</option>
                    <option value="urology">Urology</option>
                  </select>
                </div>
              </div>

              {/* Patient Demographics */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
                  <input
                    type="number"
                    placeholder="Years"
                    value={riskForm.patientAge}
                    onChange={(e) => setRiskForm({ ...riskForm, patientAge: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={riskForm.gender}
                    onChange={(e) => setRiskForm({ ...riskForm, gender: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BMI</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="kg/m2"
                    value={riskForm.bmi}
                    onChange={(e) => setRiskForm({ ...riskForm, bmi: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Clinical Factors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ASA Score</label>
                  <select
                    value={riskForm.asaScore}
                    onChange={(e) => setRiskForm({ ...riskForm, asaScore: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  >
                    <option value="">Select ASA</option>
                    <option value="1">1 - Healthy</option>
                    <option value="2">2 - Mild systemic disease</option>
                    <option value="3">3 - Severe systemic disease</option>
                    <option value="4">4 - Life-threatening disease</option>
                    <option value="5">5 - Moribund</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Smoking</label>
                  <select
                    value={riskForm.smokingStatus}
                    onChange={(e) => setRiskForm({ ...riskForm, smokingStatus: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  >
                    <option value="never">Never</option>
                    <option value="former">Former</option>
                    <option value="current">Current</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diabetes</label>
                  <select
                    value={riskForm.diabetesStatus}
                    onChange={(e) => setRiskForm({ ...riskForm, diabetesStatus: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  >
                    <option value="none">None</option>
                    <option value="controlled">Controlled</option>
                    <option value="uncontrolled">Uncontrolled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Renal Function</label>
                  <select
                    value={riskForm.renalFunction}
                    onChange={(e) => setRiskForm({ ...riskForm, renalFunction: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  >
                    <option value="normal">Normal</option>
                    <option value="mild">Mild impairment</option>
                    <option value="moderate">Moderate impairment</option>
                    <option value="severe">Severe impairment</option>
                    <option value="dialysis">Dialysis</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riskForm.cardiacHistory}
                    onChange={(e) => setRiskForm({ ...riskForm, cardiacHistory: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500/50"
                  />
                  <span className="text-sm text-gray-700">Cardiac History</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riskForm.isEmergency}
                    onChange={(e) => setRiskForm({ ...riskForm, isEmergency: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500/50"
                  />
                  <span className="text-sm text-gray-700">Emergency Surgery</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riskForm.hasComorbidities}
                    onChange={(e) => setRiskForm({ ...riskForm, hasComorbidities: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500/50"
                  />
                  <span className="text-sm text-gray-700">Has Comorbidities</span>
                </label>
              </div>

              {/* Lab Results */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lab Results (optional)</label>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Hemoglobin g/dL"
                    value={riskForm.hemoglobin}
                    onChange={(e) => setRiskForm({ ...riskForm, hemoglobin: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="INR"
                    value={riskForm.inr}
                    onChange={(e) => setRiskForm({ ...riskForm, inr: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Albumin g/dL"
                    value={riskForm.albumin}
                    onChange={(e) => setRiskForm({ ...riskForm, albumin: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl backdrop-blur-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculateRisk}
                disabled={calculating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-white font-semibold hover:from-rose-600 hover:via-pink-600 hover:to-fuchsia-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {calculating ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <BeakerIcon className="h-5 w-5" />
                    Calculate Risk & Duration
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {/* Duration Prediction */}
            <div
              className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-lg"
              style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '100ms', animationFillMode: 'both' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-gray-800">
                <ClockIcon className="h-5 w-5 text-blue-500" />
                Duration Prediction
              </h3>

              {!durationResult ? (
                <div className="text-center py-6 text-gray-500">
                  <ClockIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p>Enter procedure details to predict duration</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-4 border border-blue-200/50">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-blue-600">Predicted</p>
                        <p className="text-2xl font-bold text-blue-900">{durationResult.predictedDuration} min</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">Range</p>
                        <p className="text-lg font-semibold text-blue-800">
                          {durationResult.durationRange.min}-{durationResult.durationRange.max} min
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">Total Block</p>
                        <p className="text-lg font-semibold text-blue-800">{durationResult.totalBlockTime} min</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: `${durationResult.complexity} Complexity`, config: getRiskConfig(durationResult.complexity) },
                      { label: `${durationResult.confidence} Confidence`, config: { dot: 'bg-gray-500', text: 'text-gray-700', bg: 'bg-gray-500/10' } },
                      { label: `${durationResult.otPreparationTime} min prep`, config: { dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-500/10' } },
                    ].map((badge, i) => (
                      <div key={i} className={clsx('flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-sm border border-gray-200', badge.config.bg)}>
                        <div className={clsx('w-2 h-2 rounded-full', badge.config.dot)} />
                        <span className={clsx('text-xs font-medium', badge.config.text)}>{badge.label}</span>
                      </div>
                    ))}
                  </div>

                  {durationResult.factors.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium mb-1">Factors:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {durationResult.factors.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Risk Assessment */}
            <div
              className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-lg"
              style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '200ms', animationFillMode: 'both' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-gray-800">
                <ShieldExclamationIcon className="h-5 w-5 text-red-500" />
                Risk Assessment
              </h3>

              {!riskResult ? (
                <div className="text-center py-6 text-gray-500">
                  <ShieldExclamationIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p>Enter patient details to assess surgical risk</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Overall Risk */}
                  <div className={clsx(
                    'relative overflow-hidden p-4 rounded-xl border-2',
                    riskResult.overallRisk === 'LOW' && 'bg-emerald-500/10 border-emerald-300',
                    riskResult.overallRisk === 'MODERATE' && 'bg-amber-500/10 border-amber-300',
                    riskResult.overallRisk === 'HIGH' && 'bg-orange-500/10 border-orange-300',
                    riskResult.overallRisk === 'CRITICAL' && 'bg-red-500/10 border-red-300'
                  )}>
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={clsx(
                          'text-sm font-medium',
                          riskResult.overallRisk === 'LOW' && 'text-emerald-700',
                          riskResult.overallRisk === 'MODERATE' && 'text-amber-700',
                          riskResult.overallRisk === 'HIGH' && 'text-orange-700',
                          riskResult.overallRisk === 'CRITICAL' && 'text-red-700'
                        )}>Overall Risk</p>
                        <p className={clsx(
                          'text-2xl font-bold',
                          riskResult.overallRisk === 'LOW' && 'text-emerald-800',
                          riskResult.overallRisk === 'MODERATE' && 'text-amber-800',
                          riskResult.overallRisk === 'HIGH' && 'text-orange-800',
                          riskResult.overallRisk === 'CRITICAL' && 'text-red-800'
                        )}>{riskResult.overallRisk}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Score: {riskResult.riskScore}/100</p>
                        <div className="w-24 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full transition-all duration-500',
                              riskResult.riskScore >= 60 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                              riskResult.riskScore >= 40 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                              riskResult.riskScore >= 20 ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                            )}
                            style={{ width: `${riskResult.riskScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700">
                      <div>Mortality Risk: <span className="font-semibold">{riskResult.mortalityRisk}</span></div>
                      <div>Complication Risk: <span className="font-semibold">{riskResult.complicationRisk}</span></div>
                    </div>
                  </div>

                  {/* Risk Factors */}
                  {riskResult.riskFactors.length > 0 && (
                    <div className="relative overflow-hidden bg-amber-500/10 p-4 rounded-xl border border-amber-200/50">
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                      <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        Risk Factors
                      </h4>
                      <div className="space-y-2">
                        {riskResult.riskFactors.map((rf, i) => {
                          const impactConfig = getRiskConfig(rf.impact);
                          return (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <div className={clsx('flex items-center gap-1.5 px-2 py-0.5 rounded-full', impactConfig.bg)}>
                                <div className={clsx('w-1.5 h-1.5 rounded-full', impactConfig.dot)} />
                                <span className={clsx('text-xs font-semibold', impactConfig.text)}>{rf.impact}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-800">{rf.factor}</span>
                                <p className="text-gray-600 text-xs">{rf.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pre-Op Requirements */}
                  {riskResult.preOpRequirements.length > 0 && (
                    <div className="relative overflow-hidden bg-blue-500/10 p-4 rounded-xl border border-blue-200/50">
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
                      <h4 className="font-medium text-blue-800 mb-2">Pre-Op Requirements</h4>
                      <div className="flex flex-wrap gap-2">
                        {riskResult.preOpRequirements.map((req, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 backdrop-blur-sm border border-blue-200/50">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-xs font-medium text-blue-700">{req}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {riskResult.recommendations.length > 0 && (
                    <div className="relative overflow-hidden bg-emerald-500/10 p-4 rounded-xl border border-emerald-200/50">
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
                      <h4 className="font-medium text-emerald-800 mb-2">Recommendations</h4>
                      <ul className="text-sm text-emerald-700 space-y-1">
                        {riskResult.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats - Glass Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Scheduled Today', value: stats.scheduledToday, gradient: 'from-blue-500 to-cyan-500' },
          { label: 'In Progress', value: stats.inProgress, gradient: 'from-emerald-500 to-teal-500' },
          { label: 'Completed', value: stats.completed, gradient: 'from-gray-500 to-gray-600' },
          { label: 'OTs Available', value: stats.otsAvailable, gradient: 'from-amber-500 to-orange-500' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-all duration-300"
            style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            <p className={clsx('text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent', stat.gradient)}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Add keyframe animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
