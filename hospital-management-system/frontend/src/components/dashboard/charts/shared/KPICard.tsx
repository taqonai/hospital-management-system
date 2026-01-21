import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'indigo' | 'emerald' | 'rose' | 'orange';
  subtitle?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

const colorConfig = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-100' },
  green: { bg: 'bg-green-50', icon: 'bg-green-500', text: 'text-green-600', border: 'border-green-100' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-100' },
  red: { bg: 'bg-red-50', icon: 'bg-red-500', text: 'text-red-600', border: 'border-red-100' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-100' },
  cyan: { bg: 'bg-cyan-50', icon: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-100' },
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-100' },
  rose: { bg: 'bg-rose-50', icon: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-100' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-100' },
};

export default function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  color,
  subtitle,
  onClick,
  isLoading = false,
}: KPICardProps) {
  const cfg = colorConfig[color];

  if (isLoading) {
    return (
      <div className={`relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-6 animate-pulse`}>
        <div className="flex items-start justify-between">
          <div className="p-3 rounded-xl bg-gray-200 h-12 w-12" />
          <div className="w-16 h-6 bg-gray-200 rounded-full" />
        </div>
        <div className="mt-4">
          <div className="h-8 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${cfg.icon} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              trend.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {trend.isPositive ? (
              <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ArrowTrendingDownIcon className="h-3.5 w-3.5" />
            )}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-600 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div
        className={`absolute -bottom-4 -right-4 w-24 h-24 ${cfg.bg} rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500`}
      />
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`relative overflow-hidden bg-white rounded-2xl border ${cfg.border} p-6 hover:shadow-lg transition-all duration-300 group text-left w-full`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-white rounded-2xl border ${cfg.border} p-6 hover:shadow-lg transition-all duration-300 group`}
    >
      {content}
    </div>
  );
}
