import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CubeIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ClockIcon,
  CpuChipIcon,
  SparklesIcon,
  XMarkIcon,
  CheckCircleIcon,
  ChartBarIcon,
  BoltIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  TagIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { assetApi, departmentApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Types
interface Asset {
  id: string;
  assetCode: string;
  name: string;
  description?: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
  department?: {
    id: string;
    name: string;
  };
  location?: string;
  status: string;
  condition: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  calibrationDate?: string;
  calibrationDueDate?: string;
  createdAt: string;
}

interface MaintenanceRecord {
  id: string;
  asset: {
    id: string;
    name: string;
    assetCode: string;
  };
  maintenanceType: string;
  description?: string;
  scheduledDate: string;
  completedDate?: string;
  status: string;
  technicianId?: string;
  technician?: {
    firstName: string;
    lastName: string;
  };
  cost?: number;
  notes?: string;
}

interface AssetStats {
  totalAssets: number;
  activeAssets: number;
  underMaintenance: number;
  retired: number;
  calibrationDue: number;
  warrantyExpiring: number;
}

interface Department {
  id: string;
  name: string;
}

interface AIFailurePrediction {
  assetId: string;
  riskLevel: string;
  failureProbability: number;
  predictedFailureDate?: string;
  recommendations: string[];
  factorsAnalyzed: string[];
}

interface AILifecycleAnalysis {
  assetId: string;
  currentAge: number;
  expectedLifespan: number;
  remainingLifespan: number;
  depreciationRate: number;
  currentValue: number;
  replacementRecommendation: string;
  costAnalysis: {
    maintenanceCostToDate: number;
    projectedMaintenanceCost: number;
    replacementCost: number;
    recommendation: string;
  };
}

interface AIScheduleOptimization {
  optimizedSchedule: Array<{
    assetId: string;
    assetName: string;
    recommendedDate: string;
    maintenanceType: string;
    priority: string;
    reason: string;
  }>;
  estimatedSavings: number;
  recommendations: string[];
}

// Status configuration
const statusConfig: Record<string, { dot: string; bg: string; text: string }> = {
  ACTIVE: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700' },
  INACTIVE: { dot: 'bg-gray-500', bg: 'bg-gray-100/60', text: 'text-gray-700' },
  UNDER_MAINTENANCE: { dot: 'bg-yellow-500', bg: 'bg-yellow-100/60', text: 'text-yellow-700' },
  RETIRED: { dot: 'bg-red-500', bg: 'bg-red-100/60', text: 'text-red-700' },
  DISPOSED: { dot: 'bg-slate-500', bg: 'bg-slate-100/60', text: 'text-slate-700' },
  PENDING: { dot: 'bg-yellow-500', bg: 'bg-yellow-100/60', text: 'text-yellow-700' },
  IN_PROGRESS: { dot: 'bg-blue-500', bg: 'bg-blue-100/60', text: 'text-blue-700' },
  COMPLETED: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700' },
  CANCELLED: { dot: 'bg-gray-500', bg: 'bg-gray-100/60', text: 'text-gray-700' },
};

const conditionConfig: Record<string, { color: string; label: string }> = {
  EXCELLENT: { color: 'text-green-600 bg-green-100', label: 'Excellent' },
  GOOD: { color: 'text-blue-600 bg-blue-100', label: 'Good' },
  FAIR: { color: 'text-yellow-600 bg-yellow-100', label: 'Fair' },
  POOR: { color: 'text-orange-600 bg-orange-100', label: 'Poor' },
  CRITICAL: { color: 'text-red-600 bg-red-100', label: 'Critical' },
};

const categoryOptions = [
  'MEDICAL_EQUIPMENT',
  'DIAGNOSTIC_EQUIPMENT',
  'SURGICAL_EQUIPMENT',
  'LAB_EQUIPMENT',
  'IMAGING_EQUIPMENT',
  'IT_EQUIPMENT',
  'FURNITURE',
  'VEHICLES',
  'HVAC',
  'ELECTRICAL',
  'OTHER',
];

const categoryLabels: Record<string, string> = {
  MEDICAL_EQUIPMENT: 'Medical Equipment',
  DIAGNOSTIC_EQUIPMENT: 'Diagnostic Equipment',
  SURGICAL_EQUIPMENT: 'Surgical Equipment',
  LAB_EQUIPMENT: 'Lab Equipment',
  IMAGING_EQUIPMENT: 'Imaging Equipment',
  IT_EQUIPMENT: 'IT Equipment',
  FURNITURE: 'Furniture',
  VEHICLES: 'Vehicles',
  HVAC: 'HVAC',
  ELECTRICAL: 'Electrical',
  OTHER: 'Other',
};

// Glass status badge component
function GlassStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.INACTIVE;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-gray-200',
      config.bg,
      config.text
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// Add Asset Modal Component
function AddAssetModal({
  onClose,
  onSuccess,
  departments
}: {
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
}) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await assetApi.addAsset({
        ...data,
        purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice) : undefined,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : undefined,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry).toISOString() : undefined,
        calibrationDueDate: data.calibrationDueDate ? new Date(data.calibrationDueDate).toISOString() : undefined,
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate).toISOString() : undefined,
      });
      toast.success('Asset added successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add New Asset</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Asset Name *</label>
                <input
                  {...register('name', { required: 'Asset name is required' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., MRI Scanner"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Category *</label>
                <select
                  {...register('category', { required: 'Category is required' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Category</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of the asset"
                />
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Technical Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Manufacturer</label>
                <input
                  {...register('manufacturer')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Siemens"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Model</label>
                <input
                  {...register('model')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., MAGNETOM Vida"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Serial Number</label>
                <input
                  {...register('serialNumber')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., SN-123456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Condition *</label>
                <select
                  {...register('condition', { required: 'Condition is required' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location & Department */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Location & Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Department</label>
                <select
                  {...register('departmentId')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Location</label>
                <input
                  {...register('location')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Building A, Floor 2, Room 201"
                />
              </div>
            </div>
          </div>

          {/* Purchase & Warranty */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Purchase & Warranty</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Purchase Date</label>
                <input
                  type="date"
                  {...register('purchaseDate')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Purchase Price</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('purchasePrice')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Warranty Expiry</label>
                <input
                  type="date"
                  {...register('warrantyExpiry')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Maintenance & Calibration */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Maintenance & Calibration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Next Maintenance Date</label>
                <input
                  type="date"
                  {...register('nextMaintenanceDate')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Calibration Due Date</label>
                <input
                  type="date"
                  {...register('calibrationDueDate')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Schedule Maintenance Modal
function ScheduleMaintenanceModal({
  asset,
  onClose,
  onSuccess,
}: {
  asset: Asset;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await assetApi.scheduleMaintenance(asset.id, {
        ...data,
        scheduledDate: new Date(data.scheduledDate).toISOString(),
        estimatedCost: data.estimatedCost ? parseFloat(data.estimatedCost) : undefined,
      });
      toast.success('Maintenance scheduled successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to schedule maintenance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 w-full max-w-lg shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Schedule Maintenance</h2>
            <p className="text-sm text-gray-500">{asset.name} ({asset.assetCode})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Maintenance Type *</label>
            <select
              {...register('maintenanceType', { required: 'Type is required' })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="PREVENTIVE">Preventive</option>
              <option value="CORRECTIVE">Corrective</option>
              <option value="CALIBRATION">Calibration</option>
              <option value="INSPECTION">Inspection</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Scheduled Date *</label>
            <input
              type="date"
              {...register('scheduledDate', { required: 'Date is required' })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.scheduledDate && <p className="text-red-500 text-xs mt-1">{errors.scheduledDate.message as string}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the maintenance work needed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Estimated Cost</label>
            <input
              type="number"
              step="0.01"
              {...register('estimatedCost')}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Schedule Maintenance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Asset Detail Modal
function AssetDetailModal({
  asset,
  onClose,
  onScheduleMaintenance,
}: {
  asset: Asset;
  onClose: () => void;
  onScheduleMaintenance: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'details' | 'maintenance' | 'ai'>('details');
  const [aiAnalysis, setAIAnalysis] = useState<AIFailurePrediction | null>(null);
  const [lifecycleAnalysis, setLifecycleAnalysis] = useState<AILifecycleAnalysis | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Fetch maintenance records for this asset
  const { data: maintenanceData } = useQuery({
    queryKey: ['asset-maintenance', asset.id],
    queryFn: () => assetApi.getMaintenanceRecords({ assetId: asset.id }),
    select: (res) => res.data.data?.maintenanceRecords || [],
  });

  const handlePredictFailure = async () => {
    setLoadingAI(true);
    try {
      const response = await assetApi.predictFailure({
        assetId: asset.id,
        assetType: asset.category,
        age: asset.purchaseDate
          ? Math.floor((Date.now() - new Date(asset.purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0,
        condition: asset.condition,
        lastMaintenanceDate: asset.lastMaintenanceDate,
        usageHours: 0,
      });
      setAIAnalysis(response.data.data);
      toast.success('Failure prediction complete');
    } catch (error) {
      toast.error('Failed to get AI prediction');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleLifecycleAnalysis = async () => {
    setLoadingAI(true);
    try {
      const response = await assetApi.analyzeLifecycle({
        assetId: asset.id,
        assetType: asset.category,
        purchaseDate: asset.purchaseDate,
        purchasePrice: asset.purchasePrice,
        condition: asset.condition,
        maintenanceHistory: maintenanceData || [],
      });
      setLifecycleAnalysis(response.data.data);
      toast.success('Lifecycle analysis complete');
    } catch (error) {
      toast.error('Failed to get lifecycle analysis');
    } finally {
      setLoadingAI(false);
    }
  };

  const condition = conditionConfig[asset.condition] || conditionConfig.FAIR;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <CubeIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{asset.name}</h2>
                <p className="text-sm text-gray-500">{asset.assetCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GlassStatusBadge status={asset.status} />
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'details', label: 'Details', icon: DocumentTextIcon },
              { id: 'maintenance', label: 'Maintenance History', icon: WrenchScrewdriverIcon },
              { id: 'ai', label: 'AI Insights', icon: SparklesIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeSection === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeSection === 'details' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <TagIcon className="h-4 w-4" />
                    Category
                  </div>
                  <p className="font-semibold text-gray-900">{categoryLabels[asset.category] || asset.category}</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <ChartBarIcon className="h-4 w-4" />
                    Condition
                  </div>
                  <span className={clsx('px-2 py-1 rounded-full text-sm font-medium', condition.color)}>
                    {condition.label}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <BuildingOfficeIcon className="h-4 w-4" />
                    Department
                  </div>
                  <p className="font-semibold text-gray-900">{asset.department?.name || 'N/A'}</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <CurrencyDollarIcon className="h-4 w-4" />
                    Purchase Price
                  </div>
                  <p className="font-semibold text-gray-900">
                    {asset.purchasePrice ? `$${Number(asset.purchasePrice).toLocaleString()}` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Technical Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Technical Information</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Manufacturer', value: asset.manufacturer },
                      { label: 'Model', value: asset.model },
                      { label: 'Serial Number', value: asset.serialNumber },
                      { label: 'Location', value: asset.location },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between">
                        <span className="text-gray-500">{item.label}:</span>
                        <span className="font-medium text-gray-900">{item.value || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Important Dates</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Purchase Date', value: asset.purchaseDate },
                      { label: 'Warranty Expiry', value: asset.warrantyExpiry, warn: true },
                      { label: 'Last Maintenance', value: asset.lastMaintenanceDate },
                      { label: 'Next Maintenance', value: asset.nextMaintenanceDate, warn: true },
                      { label: 'Calibration Due', value: asset.calibrationDueDate, warn: true },
                    ].map(item => {
                      const isOverdue = item.warn && item.value && new Date(item.value) < new Date();
                      return (
                        <div key={item.label} className="flex justify-between">
                          <span className="text-gray-500">{item.label}:</span>
                          <span className={clsx(
                            'font-medium',
                            isOverdue ? 'text-red-600' : 'text-gray-900'
                          )}>
                            {item.value ? new Date(item.value).toLocaleDateString() : 'N/A'}
                            {isOverdue && ' (Overdue)'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Description */}
              {asset.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-2">Description</h3>
                  <p className="text-gray-600">{asset.description}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={onScheduleMaintenance}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-medium hover:from-orange-600 hover:to-amber-700 transition-all"
                >
                  <WrenchScrewdriverIcon className="h-4 w-4" />
                  Schedule Maintenance
                </button>
              </div>
            </div>
          )}

          {activeSection === 'maintenance' && (
            <div className="space-y-4">
              {!maintenanceData || maintenanceData.length === 0 ? (
                <div className="text-center py-12">
                  <WrenchScrewdriverIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No maintenance records found</p>
                  <button
                    onClick={onScheduleMaintenance}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-medium"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Schedule First Maintenance
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {maintenanceData.map((record: MaintenanceRecord) => (
                    <div key={record.id} className="p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{record.maintenanceType}</span>
                            <GlassStatusBadge status={record.status} />
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{record.description || 'No description'}</p>
                          {record.technician && (
                            <p className="text-sm text-gray-500 mt-1">
                              Technician: {record.technician.firstName} {record.technician.lastName}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            Scheduled: {new Date(record.scheduledDate).toLocaleDateString()}
                          </p>
                          {record.completedDate && (
                            <p className="text-sm text-green-600">
                              Completed: {new Date(record.completedDate).toLocaleDateString()}
                            </p>
                          )}
                          {record.cost && (
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              Cost: ${Number(record.cost).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'ai' && (
            <div className="space-y-6">
              {/* AI Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handlePredictFailure}
                  disabled={loadingAI}
                  className="p-4 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500 text-white">
                      <BoltIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-purple-900">Predict Failure Risk</h4>
                      <p className="text-sm text-purple-600">AI-powered failure probability analysis</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleLifecycleAnalysis}
                  disabled={loadingAI}
                  className="p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500 text-white">
                      <ChartBarIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-900">Lifecycle Analysis</h4>
                      <p className="text-sm text-blue-600">Depreciation and replacement planning</p>
                    </div>
                  </div>
                </button>
              </div>

              {loadingAI && (
                <div className="text-center py-8">
                  <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-purple-500" />
                  <p className="mt-2 text-gray-500">Analyzing asset data...</p>
                </div>
              )}

              {/* AI Failure Prediction Results */}
              {aiAnalysis && (
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-4">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Failure Risk Analysis</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white border border-purple-100">
                      <p className="text-sm text-gray-500">Risk Level</p>
                      <p className={clsx(
                        'text-xl font-bold',
                        aiAnalysis.riskLevel === 'HIGH' ? 'text-red-600' :
                        aiAnalysis.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                      )}>
                        {aiAnalysis.riskLevel}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-purple-100">
                      <p className="text-sm text-gray-500">Failure Probability</p>
                      <p className="text-xl font-bold text-gray-900">
                        {(aiAnalysis.failureProbability * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-purple-800 mb-2">Recommendations:</p>
                      <ul className="space-y-1">
                        {aiAnalysis.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-purple-700">
                            <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Lifecycle Analysis Results */}
              {lifecycleAnalysis && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-4">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Lifecycle Analysis</h4>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-white border border-blue-100">
                      <p className="text-sm text-gray-500">Current Age</p>
                      <p className="text-xl font-bold text-gray-900">{lifecycleAnalysis.currentAge} yrs</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-blue-100">
                      <p className="text-sm text-gray-500">Expected Lifespan</p>
                      <p className="text-xl font-bold text-gray-900">{lifecycleAnalysis.expectedLifespan} yrs</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-blue-100">
                      <p className="text-sm text-gray-500">Remaining Life</p>
                      <p className="text-xl font-bold text-gray-900">{lifecycleAnalysis.remainingLifespan} yrs</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-blue-100">
                      <p className="text-sm text-gray-500">Current Value</p>
                      <p className="text-xl font-bold text-gray-900">
                        ${Number(lifecycleAnalysis.currentValue || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {lifecycleAnalysis.costAnalysis && (
                    <div className="p-3 rounded-lg bg-white border border-blue-100">
                      <p className="text-sm font-medium text-blue-800 mb-2">Cost Analysis:</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-600">
                          Maintenance Cost to Date: <span className="font-medium">${Number(lifecycleAnalysis.costAnalysis.maintenanceCostToDate || 0).toLocaleString()}</span>
                        </p>
                        <p className="text-gray-600">
                          Projected Maintenance: <span className="font-medium">${Number(lifecycleAnalysis.costAnalysis.projectedMaintenanceCost || 0).toLocaleString()}</span>
                        </p>
                        <p className="text-gray-600">
                          Replacement Cost: <span className="font-medium">${Number(lifecycleAnalysis.costAnalysis.replacementCost || 0).toLocaleString()}</span>
                        </p>
                        <p className="text-blue-700 font-medium mt-2">
                          Recommendation: {lifecycleAnalysis.costAnalysis.recommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Asset Management Page
export default function Assets() {
  const { user } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'HOSPITAL_ADMIN' || user?.role === 'SUPER_ADMIN';

  // State
  const [activeTab, setActiveTab] = useState<'assets' | 'maintenance' | 'alerts'>('assets');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showAIOptimization, setShowAIOptimization] = useState(false);
  const [aiOptimization, setAIOptimization] = useState<AIScheduleOptimization | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentApi.getAll(),
    select: (res) => res.data.data || [],
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['asset-stats'],
    queryFn: () => assetApi.getStats(),
    select: (res) => res.data.data || {
      totalAssets: 0,
      activeAssets: 0,
      underMaintenance: 0,
      retired: 0,
      calibrationDue: 0,
      warrantyExpiring: 0,
    },
  });

  // Fetch assets
  const { data: assetsData, isLoading: loadingAssets } = useQuery({
    queryKey: ['assets', page, categoryFilter, statusFilter, departmentFilter, search],
    queryFn: () => assetApi.getAssets({
      page,
      limit: 20,
      category: categoryFilter || undefined,
      status: statusFilter || undefined,
      department: departmentFilter || undefined,
      search: search || undefined,
    }),
    select: (res) => ({
      assets: res.data.data?.assets || [],
      pagination: res.data.data?.pagination || { totalPages: 1 },
    }),
  });

  // Fetch maintenance records
  const { data: maintenanceData, isLoading: loadingMaintenance } = useQuery({
    queryKey: ['maintenance-records', page, statusFilter],
    queryFn: () => assetApi.getMaintenanceRecords({
      page,
      limit: 20,
      status: statusFilter || undefined,
    }),
    select: (res) => ({
      records: res.data.data?.maintenanceRecords || [],
      pagination: res.data.data?.pagination || { totalPages: 1 },
    }),
    enabled: activeTab === 'maintenance',
  });

  // Fetch calibration due
  const { data: calibrationDue = [] } = useQuery({
    queryKey: ['calibration-due'],
    queryFn: () => assetApi.getCalibrationDue(30),
    select: (res) => res.data.data || [],
  });

  // Fetch warranty expiring
  const { data: warrantyExpiring = [] } = useQuery({
    queryKey: ['warranty-expiring'],
    queryFn: () => assetApi.getWarrantyExpiring(90),
    select: (res) => res.data.data || [],
  });

  // Start maintenance mutation
  const startMaintenanceMutation = useMutation({
    mutationFn: ({ id, technicianId }: { id: string; technicianId: string }) =>
      assetApi.startMaintenance(id, technicianId),
    onSuccess: () => {
      toast.success('Maintenance started');
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
    },
    onError: () => {
      toast.error('Failed to start maintenance');
    },
  });

  // Complete maintenance mutation
  const completeMaintenanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      assetApi.completeMaintenance(id, data),
    onSuccess: () => {
      toast.success('Maintenance completed');
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
    },
    onError: () => {
      toast.error('Failed to complete maintenance');
    },
  });

  // AI Schedule Optimization
  const handleOptimizeSchedule = async () => {
    setLoadingAI(true);
    try {
      const response = await assetApi.optimizeSchedule({
        assets: assetsData?.assets.slice(0, 10).map((a: Asset) => ({
          id: a.id,
          name: a.name,
          category: a.category,
          lastMaintenanceDate: a.lastMaintenanceDate,
          condition: a.condition,
        })) || [],
        timeframe: 30,
        constraints: {
          maxDailyMaintenance: 3,
          prioritizeByCondition: true,
        },
      });
      setAIOptimization(response.data.data);
      setShowAIOptimization(true);
      toast.success('Schedule optimization complete');
    } catch (error) {
      toast.error('Failed to optimize schedule');
    } finally {
      setLoadingAI(false);
    }
  };

  const assets = assetsData?.assets || [];
  const totalPages = assetsData?.pagination?.totalPages || 1;
  const maintenanceRecords = maintenanceData?.records || [];
  const maintenanceTotalPages = maintenanceData?.pagination?.totalPages || 1;

  const loading = activeTab === 'assets' ? loadingAssets : loadingMaintenance;

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-8 shadow-xl">
        {/* Floating Orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-blue-300/20 rounded-full blur-2xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white/90 text-sm font-medium mb-3">
              <CubeIcon className="h-4 w-4" />
              Asset Management
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">Hospital Assets</h1>
            <p className="mt-2 text-blue-100">
              Track, maintain, and optimize hospital equipment and assets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOptimizeSchedule}
              disabled={loadingAI}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500/80 hover:bg-purple-500 backdrop-blur-sm border border-white/30 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:opacity-50"
            >
              <SparklesIcon className="h-5 w-5" />
              AI Optimize
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5" />
                Add Asset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards with Glassmorphism */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Assets', value: stats?.totalAssets || 0, icon: CubeIcon, gradient: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: stats?.activeAssets || 0, icon: CheckCircleIcon, gradient: 'from-green-500 to-green-600' },
          { label: 'Under Maintenance', value: stats?.underMaintenance || 0, icon: WrenchScrewdriverIcon, gradient: 'from-yellow-500 to-yellow-600' },
          { label: 'Upcoming Maintenance', value: calibrationDue.length + warrantyExpiring.length, icon: CalendarDaysIcon, gradient: 'from-orange-500 to-orange-600' },
          { label: 'Calibration Due', value: calibrationDue.length, icon: CpuChipIcon, gradient: 'from-red-500 to-red-600' },
          { label: 'Warranty Expiring', value: warrantyExpiring.length, icon: ShieldCheckIcon, gradient: 'from-purple-500 to-purple-600' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={clsx('p-2 rounded-lg bg-gradient-to-br', stat.gradient)}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Optimization Panel */}
      {showAIOptimization && aiOptimization && (
        <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-purple-900">AI Maintenance Schedule Optimization</h3>
            </div>
            <button
              onClick={() => setShowAIOptimization(false)}
              className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-purple-600" />
            </button>
          </div>

          {aiOptimization.estimatedSavings > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-green-100 border border-green-200">
              <p className="text-green-800 font-medium">
                Estimated Savings: ${aiOptimization.estimatedSavings.toLocaleString()}
              </p>
            </div>
          )}

          <div className="grid gap-3 mb-4">
            {aiOptimization.optimizedSchedule?.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white border border-purple-100">
                <div>
                  <p className="font-medium text-gray-900">{item.assetName}</p>
                  <p className="text-sm text-gray-500">{item.maintenanceType} - {item.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-purple-600">
                    {new Date(item.recommendedDate).toLocaleDateString()}
                  </p>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    item.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                    item.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  )}>
                    {item.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {aiOptimization.recommendations && aiOptimization.recommendations.length > 0 && (
            <div>
              <p className="text-sm font-medium text-purple-800 mb-2">Recommendations:</p>
              <ul className="space-y-1">
                {aiOptimization.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-purple-700">
                    <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Animated Gradient Tabs */}
      <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-2 shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <nav className="flex space-x-2">
          {[
            { id: 'assets', label: 'Assets', icon: CubeIcon },
            { id: 'maintenance', label: 'Maintenance', icon: WrenchScrewdriverIcon },
            { id: 'alerts', label: 'Alerts', icon: ExclamationTriangleIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                setPage(1);
                setStatusFilter('');
              }}
              className={clsx(
                'relative flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === 'alerts' && (calibrationDue.length + warrantyExpiring.length) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                  {calibrationDue.length + warrantyExpiring.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filters */}
      {activeTab !== 'alerts' && (
        <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              {activeTab === 'assets' && (
                <>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  >
                    <option value="">All Categories</option>
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  >
                    <option value="">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                    <option value="RETIRED">Retired</option>
                  </select>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  >
                    <option value="">All Departments</option>
                    {departments.map((dept: Department) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </>
              )}
              {activeTab === 'maintenance' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-12 text-center shadow-lg">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <ArrowPathIcon className="h-10 w-10 animate-spin mx-auto text-blue-500" />
          <p className="mt-3 text-gray-600">Loading...</p>
        </div>
      ) : (
        <>
          {/* Assets Tab */}
          {activeTab === 'assets' && (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              {assets.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mb-4">
                    <CubeIcon className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-gray-600">No assets found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Asset
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Condition
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Last Maintenance
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {assets.map((asset: Asset, index: number) => {
                        const condition = conditionConfig[asset.condition] || conditionConfig.FAIR;
                        return (
                          <tr
                            key={asset.id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowDetailModal(true);
                            }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md">
                                  <CubeIcon className="h-5 w-5 text-white" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                                  <div className="text-sm text-gray-500">{asset.assetCode}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {categoryLabels[asset.category] || asset.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {asset.department?.name || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <GlassStatusBadge status={asset.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', condition.color)}>
                                {condition.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {asset.lastMaintenanceDate
                                ? new Date(asset.lastMaintenanceDate).toLocaleDateString()
                                : 'Never'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAsset(asset);
                                  setShowMaintenanceModal(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-all hover:shadow-md"
                              >
                                <WrenchScrewdriverIcon className="h-4 w-4 inline mr-1" />
                                Maintain
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Maintenance Tab */}
          {activeTab === 'maintenance' && (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              {maintenanceRecords.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-4">
                    <WrenchScrewdriverIcon className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-gray-600">No maintenance records found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {maintenanceRecords.map((record: MaintenanceRecord) => (
                    <div key={record.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-gray-900">
                              {record.asset?.name || 'Unknown Asset'}
                            </h3>
                            <GlassStatusBadge status={record.status} />
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {record.maintenanceType}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {record.asset?.assetCode} | {record.description || 'No description'}
                          </p>
                          {record.technician && (
                            <p className="text-sm text-gray-500 mt-1">
                              Technician: {record.technician.firstName} {record.technician.lastName}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            Scheduled: {new Date(record.scheduledDate).toLocaleDateString()}
                          </p>
                          {record.completedDate && (
                            <p className="text-sm text-green-600">
                              Completed: {new Date(record.completedDate).toLocaleDateString()}
                            </p>
                          )}
                          {record.cost && (
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              Cost: ${Number(record.cost).toLocaleString()}
                            </p>
                          )}
                          <div className="mt-2 flex gap-2 justify-end">
                            {record.status === 'PENDING' && (
                              <button
                                onClick={() => startMaintenanceMutation.mutate({
                                  id: record.id,
                                  technicianId: user?.id || ''
                                })}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-600 transition-all"
                              >
                                Start
                              </button>
                            )}
                            {record.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => completeMaintenanceMutation.mutate({
                                  id: record.id,
                                  data: {
                                    completedDate: new Date().toISOString(),
                                    notes: 'Completed via dashboard'
                                  }
                                })}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium hover:from-green-600 hover:to-emerald-600 transition-all"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              {/* Calibration Due */}
              <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                <div className="p-4 border-b border-gray-100 bg-red-50">
                  <div className="flex items-center gap-2">
                    <CpuChipIcon className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold text-red-900">Calibration Due (Next 30 Days)</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      {calibrationDue.length}
                    </span>
                  </div>
                </div>
                {calibrationDue.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p>No assets due for calibration</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {calibrationDue.map((asset: Asset) => (
                      <div key={asset.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{asset.name}</p>
                          <p className="text-sm text-gray-500">{asset.assetCode} | {asset.department?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">
                            Due: {asset.calibrationDueDate ? new Date(asset.calibrationDueDate).toLocaleDateString() : 'N/A'}
                          </p>
                          <button
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowMaintenanceModal(true);
                            }}
                            className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            Schedule Calibration
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warranty Expiring */}
              <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                <div className="p-4 border-b border-gray-100 bg-purple-50">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-5 w-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">Warranty Expiring (Next 90 Days)</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {warrantyExpiring.length}
                    </span>
                  </div>
                </div>
                {warrantyExpiring.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p>No warranties expiring soon</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {warrantyExpiring.map((asset: Asset) => (
                      <div key={asset.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{asset.name}</p>
                          <p className="text-sm text-gray-500">{asset.assetCode} | {asset.manufacturer} {asset.model}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-purple-600">
                            Expires: {asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : 'N/A'}
                          </p>
                          <button
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowDetailModal(true);
                            }}
                            className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pagination */}
          {activeTab !== 'alerts' && (activeTab === 'assets' ? totalPages : maintenanceTotalPages) > 1 && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-5 py-2.5 rounded-xl backdrop-blur-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md"
              >
                Previous
              </button>
              <span className="px-5 py-2.5 rounded-xl backdrop-blur-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium shadow-md">
                Page {page} of {activeTab === 'assets' ? totalPages : maintenanceTotalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(activeTab === 'assets' ? totalPages : maintenanceTotalPages, p + 1))}
                disabled={page === (activeTab === 'assets' ? totalPages : maintenanceTotalPages)}
                className="px-5 py-2.5 rounded-xl backdrop-blur-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddAssetModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
          }}
          departments={departments}
        />
      )}

      {showMaintenanceModal && selectedAsset && (
        <ScheduleMaintenanceModal
          asset={selectedAsset}
          onClose={() => {
            setShowMaintenanceModal(false);
            setSelectedAsset(null);
          }}
          onSuccess={() => {
            setShowMaintenanceModal(false);
            setSelectedAsset(null);
            queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
            queryClient.invalidateQueries({ queryKey: ['assets'] });
          }}
        />
      )}

      {showDetailModal && selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAsset(null);
          }}
          onScheduleMaintenance={() => {
            setShowDetailModal(false);
            setShowMaintenanceModal(true);
          }}
        />
      )}
    </div>
  );
}
