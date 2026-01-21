import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ChartSkeleton from './ChartSkeleton';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  height?: string;
  headerAction?: React.ReactNode;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
  height = 'h-80',
  headerAction,
}: ChartCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>

      <div className={height}>
        {isLoading ? (
          <ChartSkeleton height={height} />
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="p-3 rounded-full bg-red-50 mb-3">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-sm text-gray-600 mb-3">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Try Again
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
