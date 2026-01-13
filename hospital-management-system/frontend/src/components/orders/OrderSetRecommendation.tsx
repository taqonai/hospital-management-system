import { useState } from 'react';
import { formatCurrency } from '../../utils/currency';
import {
  BeakerIcon,
  PhotoIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Order {
  id: string;
  name: string;
  category: string;
  urgency: string;
  confidence: number;
  rationale: string;
  warnings?: string[];
  dosing?: {
    standard?: string;
    adjusted?: string;
    adjustmentReason?: string;
  };
  estimatedCost?: number;
  alternatives?: any[];
}

interface Recommendations {
  laboratory: Order[];
  imaging: Order[];
  medication: Order[];
  procedure: Order[];
  nursing: Order[];
  consult: Order[];
}

interface Props {
  recommendations: {
    diagnosisCode: string | null;
    diagnosisName: string;
    recommendations: Recommendations;
    bundleSuggestion?: string | null;
    warnings: any[];
    totalEstimatedCost: number;
    evidenceLevel: string;
    modelVersion: string;
  } | null;
  selectedOrders: Order[];
  onSelectOrder: (order: Order) => void;
  onDeselectOrder: (orderId: string) => void;
  loading?: boolean;
}

const categoryIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  laboratory: BeakerIcon,
  imaging: PhotoIcon,
  medication: CubeIcon,
  procedure: ClipboardDocumentCheckIcon,
  nursing: ClipboardDocumentCheckIcon,
  consult: UserGroupIcon,
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  laboratory: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  imaging: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  medication: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  procedure: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  nursing: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  consult: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

const urgencyStyles: Record<string, { bg: string; text: string }> = {
  stat: { bg: 'bg-red-100', text: 'text-red-700' },
  urgent: { bg: 'bg-orange-100', text: 'text-orange-700' },
  routine: { bg: 'bg-green-100', text: 'text-green-700' },
  prn: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

export default function OrderSetRecommendation({
  recommendations,
  selectedOrders,
  onSelectOrder,
  onDeselectOrder,
  loading = false,
}: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    laboratory: true,
    imaging: true,
    medication: true,
    procedure: true,
    nursing: true,
    consult: true,
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const isSelected = (orderId: string) => {
    return selectedOrders.some(o => o.id === orderId);
  };

  const handleOrderClick = (order: Order) => {
    if (isSelected(order.id)) {
      onDeselectOrder(order.id);
    } else {
      onSelectOrder(order);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.75) return 'text-blue-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-8">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-500">Generating AI recommendations...</p>
        </div>
      </div>
    );
  }

  if (!recommendations) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-8">
        <div className="flex flex-col items-center justify-center text-gray-400">
          <SparklesIcon className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium">Enter a diagnosis to get AI recommendations</p>
          <p className="text-sm mt-2">Smart Order Sets will suggest evidence-based orders</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with diagnosis info */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 shadow-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                {recommendations.diagnosisName}
              </h3>
            </div>
            {recommendations.diagnosisCode && (
              <p className="text-sm text-gray-500 mt-1">
                ICD-10: {recommendations.diagnosisCode}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CurrencyDollarIcon className="h-4 w-4" />
              <span>Est. Total: {formatCurrency(recommendations.totalEstimatedCost)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Evidence: {recommendations.evidenceLevel}
            </p>
          </div>
        </div>

        {/* Global Warnings */}
        {recommendations.warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {recommendations.warnings.map((warning, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg flex items-start gap-2 ${
                  warning.severity === 'critical'
                    ? 'bg-red-100 border border-red-300'
                    : warning.severity === 'high'
                    ? 'bg-orange-100 border border-orange-300'
                    : 'bg-yellow-100 border border-yellow-300'
                }`}
              >
                <ExclamationTriangleIcon
                  className={`h-5 w-5 flex-shrink-0 ${
                    warning.severity === 'critical'
                      ? 'text-red-600'
                      : warning.severity === 'high'
                      ? 'text-orange-600'
                      : 'text-yellow-600'
                  }`}
                />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    warning.severity === 'critical'
                      ? 'text-red-800'
                      : warning.severity === 'high'
                      ? 'text-orange-800'
                      : 'text-yellow-800'
                  }`}>
                    {warning.type === 'allergy' && `Allergy Alert: ${warning.medication}`}
                    {warning.type === 'interaction' && `Drug Interaction: ${warning.drug1} + ${warning.drug2}`}
                    {warning.type === 'contraindication' && `Contraindication: ${warning.medication}`}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {warning.message || warning.description}
                  </p>
                  {warning.recommendation && (
                    <p className="text-xs text-blue-600 mt-1">
                      Recommendation: {warning.recommendation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Categories */}
      {Object.entries(recommendations.recommendations).map(([category, orders]) => {
        if (!orders || orders.length === 0) return null;

        const colors = categoryColors[category] || categoryColors.laboratory;
        const Icon = categoryIcons[category] || BeakerIcon;
        const isExpanded = expandedCategories[category];

        return (
          <div
            key={category}
            className={`rounded-2xl bg-white border ${colors.border} shadow-lg overflow-hidden`}
          >
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
              className={`w-full flex items-center justify-between p-4 ${colors.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colors.bg} border ${colors.border}`}>
                  <Icon className={`h-5 w-5 ${colors.text}`} />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 capitalize">
                    {category}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {orders.length} recommendation{orders.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {orders.filter((o: Order) => isSelected(o.id)).length} selected
                </span>
                {isExpanded ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Order List */}
            {isExpanded && (
              <div className="divide-y divide-gray-100">
                {orders.map((order: Order) => {
                  const selected = isSelected(order.id);
                  const urgencyStyle = urgencyStyles[order.urgency] || urgencyStyles.routine;

                  return (
                    <div
                      key={order.id}
                      className={`p-4 transition-all cursor-pointer ${
                        selected
                          ? 'bg-blue-50 border-l-4 border-l-blue-500'
                          : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                      onClick={() => handleOrderClick(order)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Selection indicator */}
                        <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {selected && <CheckCircleIcon className="h-4 w-4 text-white" />}
                        </div>

                        {/* Order details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-medium text-gray-900">{order.name}</h5>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${urgencyStyle.bg} ${urgencyStyle.text}`}>
                              {order.urgency}
                            </span>
                            <span className={`text-xs font-medium ${getConfidenceColor(order.confidence)}`}>
                              {Math.round(order.confidence * 100)}% confidence
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 mt-1">{order.rationale}</p>

                          {/* Dosing information */}
                          {order.dosing && (
                            <div className="mt-2 p-2 rounded-lg bg-gray-50">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Dosing:</span>{' '}
                                {order.dosing.adjusted || order.dosing.standard}
                              </p>
                              {order.dosing.adjustmentReason && (
                                <p className="text-xs text-blue-600 mt-1">
                                  {order.dosing.adjustmentReason}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Order warnings */}
                          {order.warnings && order.warnings.length > 0 && (
                            <div className="mt-2 flex items-start gap-1 text-xs text-orange-600">
                              <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                              <span>{order.warnings.join(', ')}</span>
                            </div>
                          )}

                          {/* Cost */}
                          {order.estimatedCost && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                              <CurrencyDollarIcon className="h-3 w-3" />
                              <span>Est. {formatCurrency(order.estimatedCost)}</span>
                            </div>
                          )}
                        </div>

                        {/* Quick actions */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {selected ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeselectOrder(order.id);
                              }}
                              className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectOrder(order);
                              }}
                              className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
                            >
                              <PlusIcon className="h-4 w-4" />
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
        );
      })}

      {/* Bundle Suggestion */}
      {recommendations.bundleSuggestion && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-emerald-800">
              <span className="font-medium">Suggested Bundle:</span>{' '}
              Consider using the <span className="font-semibold">{recommendations.bundleSuggestion}</span> for this diagnosis
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
