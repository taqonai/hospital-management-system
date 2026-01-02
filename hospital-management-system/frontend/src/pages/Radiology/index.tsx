import { useState, useEffect } from 'react';
import {
  PhotoIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { radiologyApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface ImagingOrder {
  id: string;
  orderNumber: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  modalityType: string;
  bodyPart: string;
  status: string;
  priority: string;
  createdAt: string;
  aiAnalysis?: {
    findings: string;
    abnormalityDetected: boolean;
  };
}

interface RadiologyStats {
  pendingOrders: number;
  aiFlagged: number;
  inProgress: number;
  completedToday: number;
}

const priorityConfig: Record<string, { bg: string; dot: string; text: string }> = {
  STAT: { bg: 'bg-red-100/80', dot: 'bg-red-500', text: 'text-red-700' },
  URGENT: { bg: 'bg-orange-100/80', dot: 'bg-orange-500', text: 'text-orange-700' },
  ROUTINE: { bg: 'bg-gray-100/80', dot: 'bg-gray-500', text: 'text-gray-700' },
};

const statusConfig: Record<string, { bg: string; dot: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-100/80', dot: 'bg-yellow-500', text: 'text-yellow-700' },
  SCHEDULED: { bg: 'bg-blue-100/80', dot: 'bg-blue-500', text: 'text-blue-700' },
  IN_PROGRESS: { bg: 'bg-blue-100/80', dot: 'bg-blue-500', text: 'text-blue-700' },
  COMPLETED: { bg: 'bg-green-100/80', dot: 'bg-green-500', text: 'text-green-700' },
  REPORTED: { bg: 'bg-green-100/80', dot: 'bg-green-500', text: 'text-green-700' },
};

export default function Radiology() {
  const [activeTab, setActiveTab] = useState<'worklist' | 'viewer' | 'reports'>('worklist');
  const [orders, setOrders] = useState<ImagingOrder[]>([]);
  const [stats, setStats] = useState<RadiologyStats>({
    pendingOrders: 0,
    aiFlagged: 0,
    inProgress: 0,
    completedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  // Fetch imaging orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = await radiologyApi.getOrders({ limit: 50 });
        setOrders(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        toast.error('Failed to load imaging orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await radiologyApi.getStats();
        setStats(response.data.data || {
          pendingOrders: 0,
          aiFlagged: 0,
          inProgress: 0,
          completedToday: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  const handleAnalyzeStudy = async (_orderId: string) => {
    toast.success('AI is analyzing the study...');
    // In production, this would call the AI analysis endpoint
  };

  const handleGenerateReport = async (_orderId: string) => {
    toast.success('AI is generating preliminary report...');
  };

  const flaggedStudies = orders.filter(o => o.aiAnalysis?.abnormalityDetected);

  const tabs = [
    { id: 'worklist', label: 'Worklist', count: orders.filter(o => o.status !== 'REPORTED').length },
    { id: 'viewer', label: 'Image Viewer' },
    { id: 'reports', label: 'Reports', count: stats.completedToday },
  ];

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-8 shadow-xl">
        {/* Floating Orbs */}
        <div className="absolute top-4 right-8 w-32 h-32 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-0 left-16 w-24 h-24 bg-fuchsia-300/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-violet-300/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm border border-white/30 mb-3">
              <PhotoIcon className="h-3.5 w-3.5" />
              Radiology Department
            </span>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Radiology</h1>
            <p className="mt-2 text-violet-100">
              Imaging worklist, AI analysis, and reporting
            </p>
          </div>
          {isAIOnline && (
            <span className="inline-flex items-center gap-2 text-sm text-white bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30 shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
              </span>
              <SparklesIcon className="h-4 w-4" />
              AI Analysis Active
            </span>
          )}
        </div>
      </div>

      {/* AI Flagged Alert - Glass Styled */}
      {flaggedStudies.length > 0 && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-red-50/70 border border-red-200/50 rounded-xl p-4 shadow-lg"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100/80">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800">
                {flaggedStudies.length} Studies Flagged by AI
              </h3>
              <div className="mt-2 space-y-1">
                {flaggedStudies.slice(0, 3).map(s => (
                  <p key={s.id} className="text-sm text-red-700">
                    {s.patient?.firstName} {s.patient?.lastName} - {s.modalityType} {s.bodyPart}: {s.aiAnalysis?.findings}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated Gradient Tabs */}
      <div
        className="relative overflow-hidden backdrop-blur-xl bg-white border border-gray-200/50 rounded-xl p-2 shadow-lg"
        style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.1s', animationFillMode: 'backwards' }}
      >
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300/40 to-transparent" />

        <nav className="flex space-x-2">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'relative px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30'
                  : 'text-gray-600 hover:bg-gray-100/50'
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && (
                  <span className={clsx(
                    'py-0.5 px-2 rounded-full text-xs font-semibold',
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200/80 text-gray-600'
                  )}>
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Worklist Tab */}
      {activeTab === 'worklist' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white border border-gray-200/50 rounded-xl shadow-lg"
          style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'backwards' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300/40 to-transparent" />

          {loading ? (
            <div className="p-8 text-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-violet-500" />
              <p className="mt-2 text-gray-500">Loading imaging orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="p-4 rounded-full bg-gray-100/80 w-fit mx-auto mb-4">
                <PhotoIcon className="h-12 w-12 text-gray-400" />
              </div>
              <p className="font-medium">No imaging orders found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/50">
              {orders.map((order, index) => (
                <div
                  key={order.id}
                  className={clsx(
                    'p-4 transition-colors duration-200',
                    order.aiAnalysis?.abnormalityDetected
                      ? 'bg-red-50/50 hover:bg-red-100/50'
                      : 'hover:bg-gray-50/50'
                  )}
                  style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: `${0.3 + index * 0.05}s`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-gray-600 bg-gray-100/80 px-2 py-0.5 rounded">
                          {order.orderNumber}
                        </span>
                        {/* Glass Status Badge */}
                        <span className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-gray-200/30',
                          statusConfig[order.status]?.bg || 'bg-gray-100/80',
                          statusConfig[order.status]?.text || 'text-gray-700'
                        )}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', statusConfig[order.status]?.dot || 'bg-gray-500')} />
                          {order.status?.replace('_', ' ')}
                        </span>
                        {/* Glass Priority Badge */}
                        <span className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-gray-200/30',
                          priorityConfig[order.priority]?.bg || 'bg-gray-100/80',
                          priorityConfig[order.priority]?.text || 'text-gray-700'
                        )}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', priorityConfig[order.priority]?.dot || 'bg-gray-500')} />
                          {order.priority}
                        </span>
                      </div>
                      <h3 className="mt-2 font-semibold text-gray-800">
                        {order.patient?.firstName} {order.patient?.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {order.modalityType} - {order.bodyPart}
                      </p>
                      {order.aiAnalysis?.findings && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 bg-red-100/50 px-2 py-1 rounded-lg">
                          <SparklesIcon className="h-4 w-4" />
                          AI: {order.aiAnalysis.findings}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Gradient Outline Button */}
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300/50 rounded-lg transition-all duration-200 shadow-sm hover:shadow">
                        <EyeIcon className="h-4 w-4" />
                        View
                      </button>
                      {isAIOnline && !order.aiAnalysis && (
                        <button
                          onClick={() => handleAnalyzeStudy(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-100/50 hover:bg-violet-200/70 border border-violet-300/50 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                        >
                          <SparklesIcon className="h-4 w-4" />
                          AI Analyze
                        </button>
                      )}
                      {isAIOnline && (
                        <button
                          onClick={() => handleGenerateReport(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-violet-500/30"
                        >
                          Generate Report
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'viewer' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white border border-gray-200/50 rounded-xl p-8 shadow-lg text-center"
          style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'backwards' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300/40 to-transparent" />

          <div className="p-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 w-fit mx-auto mb-4">
            <PhotoIcon className="h-16 w-16 text-violet-500" />
          </div>
          <h3 className="font-semibold text-lg text-gray-800">DICOM Image Viewer</h3>
          <p className="text-sm text-gray-500 mt-1">
            Select a study from the worklist to view images
          </p>
          <p className="text-xs text-gray-400 mt-4 inline-flex items-center gap-1.5 bg-violet-50/50 px-3 py-1.5 rounded-full">
            <SparklesIcon className="h-3.5 w-3.5" />
            AI-powered findings overlay available for analyzed studies
          </p>
        </div>
      )}

      {activeTab === 'reports' && (
        <div
          className="relative overflow-hidden backdrop-blur-xl bg-white border border-gray-200/50 rounded-xl p-8 shadow-lg text-center"
          style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'backwards' }}
        >
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300/40 to-transparent" />

          <div className="p-5 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 w-fit mx-auto mb-4">
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
          <h3 className="font-semibold text-lg text-gray-800">Radiology Reports</h3>
          <p className="text-sm text-gray-500 mt-1">View and finalize radiology reports</p>
        </div>
      )}

      {/* Quick Stats - Glass Cards with Staggered Animation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pendingOrders, gradient: 'from-yellow-400 to-amber-500', bg: 'bg-yellow-50/70', text: 'text-yellow-700', dot: 'bg-yellow-500' },
          { label: 'AI Flagged', value: stats.aiFlagged, gradient: 'from-red-400 to-rose-500', bg: 'bg-red-50/70', text: 'text-red-700', dot: 'bg-red-500' },
          { label: 'In Progress', value: stats.inProgress, gradient: 'from-blue-400 to-indigo-500', bg: 'bg-blue-50/70', text: 'text-blue-700', dot: 'bg-blue-500' },
          { label: 'Completed Today', value: stats.completedToday, gradient: 'from-green-400 to-emerald-500', bg: 'bg-green-50/70', text: 'text-green-700', dot: 'bg-green-500' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={clsx(
              'relative overflow-hidden backdrop-blur-xl border border-gray-200/50 rounded-xl p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]',
              stat.bg
            )}
            style={{ animation: 'fadeIn 0.5s ease-out', animationDelay: `${0.3 + index * 0.1}s`, animationFillMode: 'backwards' }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            {/* Gradient accent */}
            <div className={clsx('absolute top-0 left-0 w-1 h-full bg-gradient-to-b', stat.gradient)} />

            <div className="flex items-center gap-2 mb-1">
              <span className={clsx('w-2 h-2 rounded-full', stat.dot)} />
              <p className={clsx('text-sm font-medium', stat.text)}>{stat.label}</p>
            </div>
            <p className={clsx('text-3xl font-bold', stat.text)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Global Styles for Animations */}
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
