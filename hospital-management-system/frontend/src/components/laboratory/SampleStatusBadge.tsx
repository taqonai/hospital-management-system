import {
  BeakerIcon,
  TruckIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export type SampleStatus =
  | 'COLLECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'ANALYZED';

interface SampleStatusBadgeProps {
  status: SampleStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<
  SampleStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  COLLECTED: {
    label: 'Collected',
    icon: BeakerIcon,
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-200 dark:border-blue-700',
  },
  IN_TRANSIT: {
    label: 'In Transit',
    icon: TruckIcon,
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-200 dark:border-amber-700',
  },
  RECEIVED: {
    label: 'Received',
    icon: ArrowDownTrayIcon,
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-300',
    borderClass: 'border-purple-200 dark:border-purple-700',
  },
  PROCESSING: {
    label: 'Processing',
    icon: Cog6ToothIcon,
    bgClass: 'bg-cyan-100 dark:bg-cyan-900/30',
    textClass: 'text-cyan-700 dark:text-cyan-300',
    borderClass: 'border-cyan-200 dark:border-cyan-700',
  },
  ANALYZED: {
    label: 'Analyzed',
    icon: CheckCircleIcon,
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-200 dark:border-emerald-700',
  },
};

const sizeConfig = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3',
    gap: 'gap-1',
  },
  md: {
    badge: 'px-2.5 py-1 text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-1.5',
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    icon: 'h-5 w-5',
    gap: 'gap-2',
  },
};

export default function SampleStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className = '',
}: SampleStatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = sizeConfig[size];

  if (!config) {
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium bg-gray-100 text-gray-700 ${className}`}>
        Unknown
      </span>
    );
  }

  const IconComponent = config.icon;

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium border
        ${config.bgClass} ${config.textClass} ${config.borderClass}
        ${sizeClasses.badge} ${sizeClasses.gap}
        ${className}
      `}
    >
      {showIcon && <IconComponent className={sizeClasses.icon} />}
      {config.label}
    </span>
  );
}

// Export status workflow for use in timeline visualizations
export const SAMPLE_STATUS_WORKFLOW: SampleStatus[] = [
  'COLLECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'PROCESSING',
  'ANALYZED',
];

// Helper function to get status index for workflow visualization
export function getStatusIndex(status: SampleStatus): number {
  return SAMPLE_STATUS_WORKFLOW.indexOf(status);
}

// Helper to check if a status is before another in the workflow
export function isStatusBefore(
  current: SampleStatus,
  target: SampleStatus
): boolean {
  return getStatusIndex(current) < getStatusIndex(target);
}

// Helper to check if a status is after another in the workflow
export function isStatusAfter(
  current: SampleStatus,
  target: SampleStatus
): boolean {
  return getStatusIndex(current) > getStatusIndex(target);
}
