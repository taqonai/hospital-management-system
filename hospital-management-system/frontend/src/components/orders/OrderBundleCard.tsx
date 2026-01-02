import {
  DocumentDuplicateIcon,
  ClockIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  SparklesIcon,
  BeakerIcon,
  HeartIcon,
  ShieldExclamationIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

interface Bundle {
  id: string;
  name: string;
  description: string;
  category: string;
  componentCount: number;
  evidenceLevel: string;
}

interface BundleDetails {
  id: string;
  name: string;
  description: string;
  category: string;
  timeConstraints?: Record<string, string[]>;
  components: Array<{
    name: string;
    category: string;
    required: boolean;
    timeframe?: string;
    condition?: string;
  }>;
  qualityMetrics?: string[];
  evidenceLevel: string;
}

interface Props {
  bundle: Bundle;
  bundleDetails?: BundleDetails | null;
  isSelected?: boolean;
  isLoading?: boolean;
  onSelect: (bundleId: string) => void;
  onApply: (bundleId: string) => void;
}

const categoryIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  'critical-care': ShieldExclamationIcon,
  'cardiology': HeartIcon,
  'neurology': BoltIcon,
  'pulmonology': BeakerIcon,
  'endocrine': BeakerIcon,
  'gastroenterology': BeakerIcon,
  'nephrology': BeakerIcon,
};

const categoryColors: Record<string, { gradient: string; iconBg: string; text: string }> = {
  'critical-care': { gradient: 'from-red-500 to-rose-600', iconBg: 'bg-red-100', text: 'text-red-600' },
  'cardiology': { gradient: 'from-pink-500 to-rose-600', iconBg: 'bg-pink-100', text: 'text-pink-600' },
  'neurology': { gradient: 'from-purple-500 to-indigo-600', iconBg: 'bg-purple-100', text: 'text-purple-600' },
  'pulmonology': { gradient: 'from-sky-500 to-blue-600', iconBg: 'bg-sky-100', text: 'text-sky-600' },
  'endocrine': { gradient: 'from-amber-500 to-orange-600', iconBg: 'bg-amber-100', text: 'text-amber-600' },
  'gastroenterology': { gradient: 'from-emerald-500 to-teal-600', iconBg: 'bg-emerald-100', text: 'text-emerald-600' },
  'nephrology': { gradient: 'from-cyan-500 to-blue-600', iconBg: 'bg-cyan-100', text: 'text-cyan-600' },
};

export default function OrderBundleCard({
  bundle,
  bundleDetails,
  isSelected = false,
  isLoading = false,
  onSelect,
  onApply,
}: Props) {
  const colors = categoryColors[bundle.category] || categoryColors['critical-care'];
  const Icon = categoryIcons[bundle.category] || DocumentDuplicateIcon;

  return (
    <div
      className={`rounded-2xl bg-white border-2 shadow-lg overflow-hidden transition-all cursor-pointer hover:shadow-xl ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onSelect(bundle.id)}
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} p-4`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">{bundle.name}</h3>
              <p className="text-sm text-white/80 capitalize">{bundle.category.replace('-', ' ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs">
            <CheckBadgeIcon className="h-3 w-3" />
            <span>{bundle.evidenceLevel}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">{bundle.description}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <DocumentDuplicateIcon className="h-4 w-4" />
            <span>{bundle.componentCount} orders</span>
          </div>
          {bundleDetails?.timeConstraints && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <ClockIcon className="h-4 w-4" />
              <span>Time-critical</span>
            </div>
          )}
        </div>

        {/* Bundle Details (when selected) */}
        {isSelected && bundleDetails && (
          <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
            {/* Time Constraints */}
            {bundleDetails.timeConstraints && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-orange-500" />
                  Time Constraints
                </h4>
                <div className="space-y-2">
                  {Object.entries(bundleDetails.timeConstraints).map(([time, items]) => (
                    <div key={time} className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium whitespace-nowrap">
                        {time}
                      </span>
                      <span className="text-xs text-gray-600">
                        {(items as string[]).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Components */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <DocumentDuplicateIcon className="h-4 w-4 text-blue-500" />
                Bundle Components
              </h4>
              <div className="space-y-1">
                {bundleDetails.components.slice(0, 6).map((component, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      {component.required ? (
                        <span className="w-2 h-2 rounded-full bg-red-500" title="Required" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-300" title="Optional" />
                      )}
                      <span className="text-sm text-gray-700">{component.name}</span>
                    </div>
                    {component.timeframe && (
                      <span className="text-xs text-gray-500">{component.timeframe}</span>
                    )}
                  </div>
                ))}
                {bundleDetails.components.length > 6 && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    +{bundleDetails.components.length - 6} more components
                  </p>
                )}
              </div>
            </div>

            {/* Quality Metrics */}
            {bundleDetails.qualityMetrics && bundleDetails.qualityMetrics.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <CheckBadgeIcon className="h-4 w-4 text-green-500" />
                  Quality Metrics
                </h4>
                <div className="flex flex-wrap gap-2">
                  {bundleDetails.qualityMetrics.map((metric, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded-lg bg-green-50 text-green-700 text-xs"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {isSelected ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApply(bundle.id);
              }}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  <span>Apply Bundle</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(bundle.id);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-all"
            >
              <span>View Details</span>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
