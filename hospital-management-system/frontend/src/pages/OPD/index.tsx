import { useState, useEffect } from 'react';
import {
  ClipboardDocumentListIcon,
  ClockIcon,
  SparklesIcon,
  MegaphoneIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { opdApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface QueueItem {
  id: string;
  tokenNumber: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  doctor: {
    user: {
      firstName: string;
      lastName: string;
    };
    specialization: string;
  };
  status: string;
  estimatedWaitTime?: number;
}

interface OPDStats {
  inQueue: number;
  inConsultation: number;
  avgWaitTime: number;
  seenToday: number;
}

export default function OPD() {
  const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'noshow'>('queue');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<OPDStats>({
    inQueue: 0,
    inConsultation: 0,
    avgWaitTime: 0,
    seenToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  // Fetch queue
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        setLoading(true);
        const response = await opdApi.getQueue();
        setQueue(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch queue:', error);
        toast.error('Failed to load queue');
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await opdApi.getStats();
        setStats(response.data.data || {
          inQueue: 0,
          inConsultation: 0,
          avgWaitTime: 0,
          seenToday: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  const handleCallNext = async (doctorId: string) => {
    try {
      const response = await opdApi.callNext(doctorId);
      if (response.data.data) {
        toast.success(`Called patient: ${response.data.data.patient?.firstName}`);
      } else {
        toast.success('No patients waiting');
      }
      // Refresh queue
      const queueResponse = await opdApi.getQueue();
      setQueue(queueResponse.data.data || []);
    } catch (error) {
      console.error('Failed to call next:', error);
      toast.error('Failed to call next patient');
    }
  };

  const handleOptimizeQueue = () => {
    toast.success('AI is optimizing the queue...');
  };

  // Group queue by doctor
  const doctorQueues = queue.reduce((acc, item) => {
    const doctorName = `Dr. ${item.doctor?.user?.firstName || ''} ${item.doctor?.user?.lastName || ''}`.trim();
    if (!acc[doctorName]) {
      acc[doctorName] = {
        doctorId: item.doctor?.user?.firstName || 'unknown',
        specialization: item.doctor?.specialization || 'General',
        patients: [],
      };
    }
    acc[doctorName].patients.push(item);
    return acc;
  }, {} as Record<string, { doctorId: string; specialization: string; patients: QueueItem[] }>);

  const tabs = [
    { id: 'queue', label: 'Live Queue', count: queue.length },
    { id: 'appointments', label: 'Today\'s Appointments', count: stats.seenToday + queue.length },
    { id: 'noshow', label: 'No-Show Risk' },
  ];

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 p-8 shadow-xl">
        {/* Floating Orbs */}
        <div className="absolute top-4 right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-cyan-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-blue-200/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />

        {/* Glass Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white/90 text-sm font-medium mb-3">
              <span className="w-2 h-2 bg-cyan-300 rounded-full mr-2 animate-pulse" />
              Outpatient Department
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">OPD Queue Management</h1>
            <p className="mt-2 text-blue-100">
              Queue management and consultation tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAIOnline && (
              <button
                onClick={handleOptimizeQueue}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white font-medium shadow-lg hover:bg-white/30 hover:scale-105 transition-all duration-300"
              >
                <SparklesIcon className="h-5 w-5 group-hover:animate-spin" />
                Optimize Queue
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400/0 via-purple-400/30 to-purple-400/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Animated Gradient Tabs */}
      <div className="relative rounded-xl bg-white/70 backdrop-blur-xl border border-white/50 p-2 shadow-lg">
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <nav className="flex space-x-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'relative py-3 px-6 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                  : 'text-gray-600 hover:bg-white/50'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={clsx(
                  'ml-2 py-0.5 px-2.5 rounded-full text-xs font-semibold',
                  activeTab === tab.id
                    ? 'bg-white/25 text-white'
                    : 'bg-gray-200/80 text-gray-600'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {loading ? (
            <div
              className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 p-8 text-center shadow-lg animate-fade-in"
              style={{ animationDelay: '0ms' }}
            >
              {/* Shine line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-blue-500" />
              <p className="mt-2 text-gray-600">Loading queue...</p>
            </div>
          ) : Object.keys(doctorQueues).length === 0 ? (
            <div
              className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 p-8 text-center shadow-lg animate-fade-in"
              style={{ animationDelay: '0ms' }}
            >
              {/* Shine line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <ClipboardDocumentListIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No patients in queue</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {Object.entries(doctorQueues).map(([doctorName, { doctorId, specialization, patients }], index) => (
                <div
                  key={doctorName}
                  className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Shine line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                  <div className="p-5 border-b border-gray-200/50 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{doctorName}</h3>
                      <p className="text-sm text-gray-500">{specialization}</p>
                    </div>
                    <button
                      onClick={() => handleCallNext(doctorId)}
                      className="group relative inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300"
                    >
                      <MegaphoneIcon className="h-4 w-4" />
                      Call Next
                    </button>
                  </div>
                  <div className="divide-y divide-gray-200/50">
                    {patients.map((patient, patientIndex) => (
                      <div
                        key={patient.id}
                        className={clsx(
                          'p-4 flex items-center justify-between transition-colors duration-200',
                          patient.status === 'IN_CONSULTATION'
                            ? 'bg-emerald-50/50'
                            : 'hover:bg-white/50'
                        )}
                        style={{ animationDelay: `${(index * 100) + (patientIndex * 50)}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md',
                            patient.status === 'IN_CONSULTATION'
                              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
                              : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700'
                          )}>
                            {patient.tokenNumber}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {patient.patient?.firstName} {patient.patient?.lastName}
                            </h4>
                            {patient.status === 'IN_CONSULTATION' ? (
                              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                In Consultation
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                                <ClockIcon className="h-3.5 w-3.5" />
                                ~{patient.estimatedWaitTime || 15} min
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No-Show Risk Tab */}
      {activeTab === 'noshow' && isAIOnline && (
        <div
          className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg overflow-hidden animate-fade-in"
          style={{ animationDelay: '0ms' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <div className="p-5 border-b border-gray-200/50 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25">
              <SparklesIcon className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900">AI No-Show Risk Prediction</h3>
          </div>
          <div className="p-8 text-center">
            <p className="text-gray-500">AI predictions will appear here based on historical patterns</p>
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div
          className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 p-8 text-center shadow-lg animate-fade-in"
          style={{ animationDelay: '0ms' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <ClipboardDocumentListIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="font-semibold text-gray-900">Today's Appointments</h3>
          <p className="text-sm text-gray-500 mt-1">View and manage scheduled appointments</p>
        </div>
      )}

      {/* Quick Stats with Glassmorphism */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'In Queue', value: stats.inQueue, gradient: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-500/10', dotColor: 'bg-blue-500' },
          { label: 'In Consultation', value: stats.inConsultation, gradient: 'from-emerald-500 to-emerald-600', bgColor: 'bg-emerald-500/10', dotColor: 'bg-emerald-500' },
          { label: 'Avg Wait Time', value: `${stats.avgWaitTime} min`, gradient: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10', dotColor: 'bg-amber-500' },
          { label: 'Seen Today', value: stats.seenToday, gradient: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-500/10', dotColor: 'bg-purple-500' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={clsx(
              'relative rounded-2xl backdrop-blur-xl border border-white/50 p-5 shadow-lg overflow-hidden animate-fade-in',
              stat.bgColor
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            <div className="flex items-center gap-2 mb-2">
              <span className={clsx('w-2 h-2 rounded-full', stat.dotColor)} />
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            </div>
            <p className={clsx('text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent', stat.gradient)}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
