import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  FunnelIcon,
  XMarkIcon,
  PlayIcon,
  TruckIcon,
  FireIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
  CakeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { dietaryApi, ipdApi } from '../../services/api';

// Types
interface MealOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patientName: string;
  bedNumber: string;
  wardName: string;
  wardId: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  items: MealItem[];
  scheduledTime: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED';
  specialInstructions?: string;
  dietRestrictions?: string[];
  createdAt: string;
  updatedAt: string;
  consumptionPercent?: number;
  consumptionNotes?: string;
}

interface MealItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
}

interface ConsumptionData {
  orderId: string;
  consumptionPercent: number;
  notes: string;
}

interface MealOrderTrackerProps {
  hospitalId: string;
  date?: Date;
}

// Meal type configurations
const mealTypeConfig = {
  BREAKFAST: {
    icon: SunIcon,
    label: 'Breakfast',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-600',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    headerGradient: 'from-amber-500/20 to-yellow-500/20',
  },
  LUNCH: {
    icon: FireIcon,
    label: 'Lunch',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-600',
    badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    headerGradient: 'from-orange-500/20 to-red-500/20',
  },
  DINNER: {
    icon: MoonIcon,
    label: 'Dinner',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-600',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    headerGradient: 'from-blue-500/20 to-indigo-500/20',
  },
  SNACK: {
    icon: CakeIcon,
    label: 'Snack',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-600',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    headerGradient: 'from-emerald-500/20 to-green-500/20',
  },
};

// Status column configurations
const statusColumns = [
  { key: 'PENDING', label: 'Pending', color: 'slate' },
  { key: 'PREPARING', label: 'Preparing', color: 'amber' },
  { key: 'READY', label: 'Ready', color: 'blue' },
  { key: 'DELIVERED', label: 'Delivered', color: 'emerald' },
] as const;

// Consumption percentage options
const consumptionOptions = [0, 25, 50, 75, 100];

export default function MealOrderTracker({
  hospitalId,
  date = new Date(),
}: MealOrderTrackerProps) {
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedMealType, setSelectedMealType] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [consumptionModal, setConsumptionModal] = useState<{
    isOpen: boolean;
    order: MealOrder | null;
  }>({ isOpen: false, order: null });
  const [consumptionData, setConsumptionData] = useState<ConsumptionData>({
    orderId: '',
    consumptionPercent: 100,
    notes: '',
  });

  // Update current time every minute for countdown calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Format date for API
  const formatDateForApi = (d: Date) => {
    return d.toISOString().split('T')[0];
  };

  // Fetch meal orders with auto-refresh every 30 seconds
  const {
    data: ordersData,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['mealOrders', hospitalId, formatDateForApi(date)],
    queryFn: async () => {
      const response = await dietaryApi.getMealOrders({
        hospitalId,
        date: formatDateForApi(date),
      });
      return response.data?.data || response.data || [];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 15000,
  });

  // Fetch wards for filter dropdown
  const { data: wardsData } = useQuery({
    queryKey: ['wards', hospitalId],
    queryFn: async () => {
      const response = await ipdApi.getWards();
      return response.data?.data || response.data || [];
    },
    staleTime: 300000, // 5 minutes
  });

  // Update meal order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => {
      return dietaryApi.updateMealOrderStatus(orderId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealOrders'] });
    },
  });

  // Record consumption mutation (using update patient diet or a custom endpoint)
  const recordConsumptionMutation = useMutation({
    mutationFn: async (data: ConsumptionData) => {
      // Assuming there's an endpoint to record consumption
      // If not, this would update the meal order with consumption data
      return dietaryApi.updateMealOrderStatus(data.orderId, 'CONSUMED');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealOrders'] });
      setConsumptionModal({ isOpen: false, order: null });
      setConsumptionData({ orderId: '', consumptionPercent: 100, notes: '' });
    },
  });

  // Safely get orders array
  const orders: MealOrder[] = useMemo(() => {
    if (Array.isArray(ordersData)) return ordersData;
    if (ordersData?.orders && Array.isArray(ordersData.orders)) return ordersData.orders;
    return [];
  }, [ordersData]);

  // Safely get wards array
  const wards = useMemo(() => {
    if (Array.isArray(wardsData)) return wardsData;
    if (wardsData?.wards && Array.isArray(wardsData.wards)) return wardsData.wards;
    return [];
  }, [wardsData]);

  // Calculate time-related values for an order
  const getTimeInfo = (scheduledTime: string) => {
    const scheduled = new Date(scheduledTime);
    const diff = scheduled.getTime() - currentTime.getTime();
    const minutesUntil = Math.round(diff / 60000);

    return {
      isOverdue: minutesUntil < 0,
      isDueSoon: minutesUntil >= 0 && minutesUntil <= 60,
      minutesUntil,
      formattedTime: scheduled.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  // Format countdown display
  const formatCountdown = (minutes: number) => {
    if (minutes < 0) {
      const absMinutes = Math.abs(minutes);
      if (absMinutes >= 60) {
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;
        return `${hours}h ${mins}m overdue`;
      }
      return `${absMinutes}m overdue`;
    }
    if (minutes === 0) return 'Due now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Ward filter
      if (selectedWard !== 'all' && order.wardId !== selectedWard) {
        return false;
      }

      // Meal type filter
      if (selectedMealType !== 'all' && order.mealType !== selectedMealType) {
        return false;
      }

      // Time filter
      if (timeFilter !== 'all') {
        const timeInfo = getTimeInfo(order.scheduledTime);
        if (timeFilter === 'overdue' && !timeInfo.isOverdue) {
          return false;
        }
        if (timeFilter === 'due1hr' && !timeInfo.isDueSoon) {
          return false;
        }
      }

      return true;
    });
  }, [orders, selectedWard, selectedMealType, timeFilter, currentTime]);

  // Group orders by status
  const ordersByStatus = useMemo(() => {
    const grouped: Record<string, MealOrder[]> = {
      PENDING: [],
      PREPARING: [],
      READY: [],
      DELIVERED: [],
    };

    filteredOrders.forEach((order) => {
      if (grouped[order.status]) {
        grouped[order.status].push(order);
      }
    });

    // Sort each group by scheduled time
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort(
        (a, b) =>
          new Date(a.scheduledTime).getTime() -
          new Date(b.scheduledTime).getTime()
      );
    });

    return grouped;
  }, [filteredOrders]);

  // Handle status update
  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  // Handle consumption recording
  const openConsumptionModal = (order: MealOrder) => {
    setConsumptionData({
      orderId: order.id,
      consumptionPercent: 100,
      notes: '',
    });
    setConsumptionModal({ isOpen: true, order });
  };

  const handleRecordConsumption = () => {
    if (consumptionData.orderId) {
      recordConsumptionMutation.mutate(consumptionData);
    }
  };

  // Render order card
  const renderOrderCard = (order: MealOrder) => {
    const mealConfig = mealTypeConfig[order.mealType];
    const MealIcon = mealConfig.icon;
    const timeInfo = getTimeInfo(order.scheduledTime);

    return (
      <div
        key={order.id}
        className={`
          relative overflow-hidden rounded-xl
          backdrop-blur-xl border transition-all duration-300
          bg-white/70 dark:bg-slate-800/70
          ${timeInfo.isOverdue && order.status !== 'DELIVERED'
            ? 'border-red-400/50 shadow-red-500/20'
            : 'border-white/50 dark:border-white/10'
          }
          shadow-lg shadow-black/5 dark:shadow-black/20
          hover:shadow-xl hover:-translate-y-1
        `}
      >
        {/* Top shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        {/* Overdue indicator */}
        {timeInfo.isOverdue && order.status !== 'DELIVERED' && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500 animate-pulse" />
        )}

        {/* Header with meal type */}
        <div
          className={`px-4 py-3 bg-gradient-to-r ${mealConfig.headerGradient} border-b border-white/20 dark:border-white/5`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${mealConfig.bgColor}`}>
                <MealIcon className={`h-4 w-4 ${mealConfig.textColor}`} />
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">
                #{order.orderNumber}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${mealConfig.badgeColor}`}
            >
              {mealConfig.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Patient info */}
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {order.patientName}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {order.bedNumber} - {order.wardName}
            </p>
          </div>

          {/* Items list */}
          <div className="space-y-1">
            {order.items.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>
                  {item.quantity}x {item.name}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-xs text-slate-400">
                +{order.items.length - 3} more items
              </p>
            )}
          </div>

          {/* Special instructions */}
          {order.specialInstructions && (
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                <DocumentTextIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                {order.specialInstructions}
              </p>
            </div>
          )}

          {/* Time info */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <ClockIcon className="h-4 w-4" />
              <span>{timeInfo.formattedTime}</span>
            </div>
            {order.status !== 'DELIVERED' && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  timeInfo.isOverdue
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 animate-pulse'
                    : timeInfo.isDueSoon
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {formatCountdown(timeInfo.minutesUntil)}
              </span>
            )}
          </div>

          {/* Action buttons based on status */}
          <div className="pt-2 border-t border-slate-200/50 dark:border-white/10">
            {order.status === 'PENDING' && (
              <button
                onClick={() => handleStatusUpdate(order.id, 'PREPARING')}
                disabled={updateStatusMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                <PlayIcon className="h-4 w-4" />
                Start Preparing
              </button>
            )}
            {order.status === 'PREPARING' && (
              <button
                onClick={() => handleStatusUpdate(order.id, 'READY')}
                disabled={updateStatusMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Mark Ready
              </button>
            )}
            {order.status === 'READY' && (
              <button
                onClick={() => handleStatusUpdate(order.id, 'DELIVERED')}
                disabled={updateStatusMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                <TruckIcon className="h-4 w-4" />
                Mark Delivered
              </button>
            )}
            {order.status === 'DELIVERED' && (
              <button
                onClick={() => openConsumptionModal(order)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium text-sm transition-colors"
              >
                <SparklesIcon className="h-4 w-4" />
                Record Consumption
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl border bg-white/70 dark:bg-slate-800/70 border-white/50 dark:border-white/10 shadow-lg p-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title and refresh */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
              <FireIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Kitchen Order Tracker
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {date.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-slate-400" />
            </div>

            {/* Ward filter */}
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Wards</option>
              {wards.map((ward: { id: string; name: string }) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>

            {/* Meal type filter */}
            <select
              value={selectedMealType}
              onChange={(e) => setSelectedMealType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Meals</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
              <option value="SNACK">Snack</option>
            </select>

            {/* Time filter */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Times</option>
              <option value="due1hr">Due in 1hr</option>
              <option value="overdue">Overdue</option>
            </select>

            {/* Refresh button */}
            <button
              onClick={() => refetchOrders()}
              disabled={ordersLoading}
              className="p-2 rounded-lg bg-white/50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon
                className={`h-5 w-5 text-slate-500 dark:text-slate-400 ${
                  ordersLoading ? 'animate-spin' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Stats summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statusColumns.map((col) => {
            const count = ordersByStatus[col.key]?.length || 0;
            const overdueCount =
              col.key !== 'DELIVERED'
                ? ordersByStatus[col.key]?.filter(
                    (o) => getTimeInfo(o.scheduledTime).isOverdue
                  ).length || 0
                : 0;

            return (
              <div
                key={col.key}
                className={`px-4 py-3 rounded-xl bg-${col.color}-50 dark:bg-${col.color}-900/20 border border-${col.color}-200 dark:border-${col.color}-800`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium text-${col.color}-700 dark:text-${col.color}-300`}
                  >
                    {col.label}
                  </span>
                  <span
                    className={`text-2xl font-bold text-${col.color}-600 dark:text-${col.color}-400`}
                  >
                    {count}
                  </span>
                </div>
                {overdueCount > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    {overdueCount} overdue
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {ordersLoading && (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-slate-500 dark:text-slate-400">
            Loading orders...
          </span>
        </div>
      )}

      {/* Kanban board */}
      {!ordersLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {statusColumns.map((col) => (
            <div key={col.key} className="space-y-3">
              {/* Column header */}
              <div
                className={`sticky top-0 z-10 px-4 py-3 rounded-xl bg-${col.color}-100/80 dark:bg-${col.color}-900/40 backdrop-blur-sm border border-${col.color}-200 dark:border-${col.color}-800`}
              >
                <div className="flex items-center justify-between">
                  <h3
                    className={`font-semibold text-${col.color}-800 dark:text-${col.color}-200`}
                  >
                    {col.label}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-sm font-medium bg-${col.color}-200 dark:bg-${col.color}-800 text-${col.color}-800 dark:text-${col.color}-200`}
                  >
                    {ordersByStatus[col.key]?.length || 0}
                  </span>
                </div>
              </div>

              {/* Column content */}
              <div className="space-y-3 min-h-[200px]">
                {ordersByStatus[col.key]?.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      No orders
                    </p>
                  </div>
                ) : (
                  ordersByStatus[col.key]?.map((order) => renderOrderCard(order))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consumption Modal */}
      {consumptionModal.isOpen && consumptionModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl backdrop-blur-xl border bg-white/95 dark:bg-slate-800/95 border-white/50 dark:border-white/10 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Record Consumption
              </h3>
              <button
                onClick={() =>
                  setConsumptionModal({ isOpen: false, order: null })
                }
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-4 space-y-4">
              {/* Order info */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <p className="font-medium text-slate-900 dark:text-white">
                  {consumptionModal.order.patientName}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Order #{consumptionModal.order.orderNumber} -{' '}
                  {mealTypeConfig[consumptionModal.order.mealType].label}
                </p>
              </div>

              {/* Consumption percentage */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Consumption Percentage
                </label>
                <div className="flex gap-2">
                  {consumptionOptions.map((percent) => (
                    <button
                      key={percent}
                      onClick={() =>
                        setConsumptionData((prev) => ({
                          ...prev,
                          consumptionPercent: percent,
                        }))
                      }
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        consumptionData.consumptionPercent === percent
                          ? 'bg-purple-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                {/* Slider alternative */}
                <div className="mt-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={consumptionData.consumptionPercent}
                    onChange={(e) =>
                      setConsumptionData((prev) => ({
                        ...prev,
                        consumptionPercent: Number(e.target.value),
                      }))
                    }
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>0%</span>
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      {consumptionData.consumptionPercent}%
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={consumptionData.notes}
                  onChange={(e) =>
                    setConsumptionData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Any observations about meal consumption..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() =>
                  setConsumptionModal({ isOpen: false, order: null })
                }
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordConsumption}
                disabled={recordConsumptionMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {recordConsumptionMutation.isPending ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500">
        Auto-refreshing every 30 seconds -{' '}
        {currentTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </div>
    </div>
  );
}
