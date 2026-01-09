import {
  BeakerIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface LabTest {
  id: string;
  name: string;
  category: string;
  status: string;
  result: string | null;
  resultValue: number | null;
  unit: string | null;
  normalRange: string | null;
  isAbnormal: boolean;
  isCritical: boolean;
  comments: string | null;
  performedAt: string | null;
}

interface LabOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  orderedAt: string;
  completedAt: string | null;
  tests: LabTest[];
}

interface LabOrdersCardProps {
  labOrders: LabOrder[];
  className?: string;
}

function getStatusIcon(status: string) {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
    case 'IN_PROGRESS':
      return <ClockIcon className="w-4 h-4 text-orange-500 animate-pulse" />;
    case 'SAMPLE_COLLECTED':
      return <ClockIcon className="w-4 h-4 text-yellow-500" />;
    default:
      return <ClockIcon className="w-4 h-4 text-blue-500" />;
  }
}

function getStatusBadgeColor(status: string) {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'IN_PROGRESS':
      return 'bg-orange-100 text-orange-800';
    case 'SAMPLE_COLLECTED':
      return 'bg-yellow-100 text-yellow-800';
    case 'ORDERED':
      return 'bg-blue-100 text-blue-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityBadgeColor(priority: string) {
  switch (priority.toUpperCase()) {
    case 'STAT':
      return 'bg-red-100 text-red-800';
    case 'URGENT':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function LabOrdersCard({ labOrders, className }: LabOrdersCardProps) {
  if (!labOrders || labOrders.length === 0) {
    return (
      <div className={clsx('bg-gray-50 border border-gray-200 rounded-lg p-4', className)}>
        <div className="flex items-center gap-2 text-gray-500">
          <BeakerIcon className="w-5 h-5" />
          <span className="font-medium">No Lab Orders</span>
        </div>
        <p className="text-sm text-gray-400 mt-1">No laboratory tests have been ordered.</p>
      </div>
    );
  }

  // Count critical and abnormal results
  const criticalCount = labOrders.reduce(
    (count, order) => count + order.tests.filter((t) => t.isCritical).length,
    0
  );
  const abnormalCount = labOrders.reduce(
    (count, order) => count + order.tests.filter((t) => t.isAbnormal && !t.isCritical).length,
    0
  );

  return (
    <div className={clsx('bg-white border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BeakerIcon className="w-5 h-5 text-purple-500" />
          <span className="font-medium text-gray-900">Lab Orders</span>
          <span className="text-xs text-gray-500">({labOrders.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium">
              <ExclamationCircleIcon className="w-3 h-3" />
              {criticalCount} Critical
            </span>
          )}
          {abnormalCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
              <ExclamationTriangleIcon className="w-3 h-3" />
              {abnormalCount} Abnormal
            </span>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="divide-y divide-gray-100">
        {labOrders.map((order) => (
          <div key={order.id} className="p-3">
            {/* Order Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(order.status)}
                <span className="text-xs font-mono text-gray-500">{order.orderNumber}</span>
                <span className={clsx('px-1.5 py-0.5 rounded text-xs', getStatusBadgeColor(order.status))}>
                  {order.status.replace('_', ' ')}
                </span>
                {order.priority !== 'ROUTINE' && (
                  <span className={clsx('px-1.5 py-0.5 rounded text-xs', getPriorityBadgeColor(order.priority))}>
                    {order.priority}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {new Date(order.orderedAt).toLocaleDateString()}
              </span>
            </div>

            {/* Tests */}
            <div className="space-y-1">
              {order.tests.map((test) => (
                <div
                  key={test.id}
                  className={clsx(
                    'flex items-center justify-between py-1 px-2 rounded text-sm',
                    test.isCritical
                      ? 'bg-red-50'
                      : test.isAbnormal
                      ? 'bg-yellow-50'
                      : 'bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {test.isCritical && <ExclamationCircleIcon className="w-4 h-4 text-red-500" />}
                    {test.isAbnormal && !test.isCritical && (
                      <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
                    )}
                    <span
                      className={clsx(
                        test.isCritical
                          ? 'text-red-700 font-medium'
                          : test.isAbnormal
                          ? 'text-yellow-700'
                          : 'text-gray-700'
                      )}
                    >
                      {test.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {test.result || test.resultValue !== null ? (
                      <span
                        className={clsx(
                          'font-medium',
                          test.isCritical
                            ? 'text-red-600'
                            : test.isAbnormal
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        )}
                      >
                        {test.resultValue !== null
                          ? `${test.resultValue}${test.unit ? ` ${test.unit}` : ''}`
                          : test.result}
                        {test.normalRange && (
                          <span className="text-xs text-gray-400 ml-1">({test.normalRange})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LabOrdersCard;
