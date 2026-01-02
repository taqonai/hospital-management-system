import { useState } from 'react';
import {
  AdjustmentsHorizontalIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ClockIcon,
  BeakerIcon,
  PhotoIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  SparklesIcon,
  DocumentCheckIcon,
  XMarkIcon,
  PencilSquareIcon,
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
}

interface PatientContext {
  age?: number;
  weight?: number;
  gender?: string;
  allergies?: string[];
  currentMedications?: string[];
  renalFunction?: string;
  hepaticFunction?: string;
  pregnancyStatus?: string;
  comorbidities?: string[];
}

interface Props {
  selectedOrders: Order[];
  patientContext: PatientContext;
  warnings: any[];
  modifications: any[];
  totalCost: number;
  onRemoveOrder: (orderId: string) => void;
  onReorderOrders: (orders: Order[]) => void;
  onUpdateUrgency: (orderId: string, urgency: string) => void;
  onPlaceOrders: () => void;
  onClearAll: () => void;
  isPlacing?: boolean;
}

const categoryIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  laboratory: BeakerIcon,
  imaging: PhotoIcon,
  medication: CubeIcon,
  procedure: ClipboardDocumentCheckIcon,
  nursing: ClipboardDocumentCheckIcon,
  consult: UserGroupIcon,
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  laboratory: { bg: 'bg-amber-100', text: 'text-amber-600' },
  imaging: { bg: 'bg-purple-100', text: 'text-purple-600' },
  medication: { bg: 'bg-blue-100', text: 'text-blue-600' },
  procedure: { bg: 'bg-rose-100', text: 'text-rose-600' },
  nursing: { bg: 'bg-teal-100', text: 'text-teal-600' },
  consult: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
};

const urgencyOptions = [
  { value: 'stat', label: 'STAT', color: 'bg-red-100 text-red-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-orange-100 text-orange-700' },
  { value: 'routine', label: 'Routine', color: 'bg-green-100 text-green-700' },
  { value: 'prn', label: 'PRN', color: 'bg-gray-100 text-gray-700' },
];

export default function OrderCustomizer({
  selectedOrders,
  patientContext,
  warnings,
  modifications,
  totalCost,
  onRemoveOrder,
  onReorderOrders,
  onUpdateUrgency,
  onPlaceOrders,
  onClearAll,
  isPlacing = false,
}: Props) {
  const [editingUrgency, setEditingUrgency] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const groupedOrders = selectedOrders.reduce((acc, order) => {
    if (!acc[order.category]) {
      acc[order.category] = [];
    }
    acc[order.category].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    const newOrders = [...selectedOrders];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newOrders.length) return;
    [newOrders[index], newOrders[newIndex]] = [newOrders[newIndex], newOrders[index]];
    onReorderOrders(newOrders);
  };

  const handlePlaceOrders = () => {
    if (warnings.some(w => w.severity === 'critical')) {
      setShowConfirmation(true);
    } else {
      onPlaceOrders();
    }
  };

  const criticalWarnings = warnings.filter(w => w.severity === 'critical');
  const highWarnings = warnings.filter(w => w.severity === 'high');

  if (selectedOrders.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-8">
        <div className="flex flex-col items-center justify-center text-gray-400">
          <AdjustmentsHorizontalIcon className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium">No orders selected</p>
          <p className="text-sm mt-2">Select orders from the recommendations to customize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with summary */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100">
              <AdjustmentsHorizontalIcon className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Order Summary</h3>
              <p className="text-sm text-gray-500">
                {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
              <CurrencyDollarIcon className="h-5 w-5" />
              <span>${totalCost.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500">Estimated total</p>
          </div>
        </div>

        {/* Patient context summary */}
        <div className="mt-4 p-3 rounded-xl bg-white/70">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Patient Context
          </h4>
          <div className="flex flex-wrap gap-2">
            {patientContext.age && (
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                Age: {patientContext.age}
              </span>
            )}
            {patientContext.weight && (
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                Weight: {patientContext.weight}kg
              </span>
            )}
            {patientContext.gender && (
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                {patientContext.gender}
              </span>
            )}
            {patientContext.renalFunction && (
              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs">
                Renal: {patientContext.renalFunction}
              </span>
            )}
            {patientContext.allergies && patientContext.allergies.length > 0 && (
              <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs">
                {patientContext.allergies.length} allergies
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {(criticalWarnings.length > 0 || highWarnings.length > 0) && (
        <div className="rounded-2xl bg-white border border-red-200 shadow-lg overflow-hidden">
          <div className="p-4 bg-red-50 border-b border-red-200">
            <h4 className="font-semibold text-red-800 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5" />
              Safety Alerts ({criticalWarnings.length + highWarnings.length})
            </h4>
          </div>
          <div className="p-4 space-y-2">
            {criticalWarnings.map((warning, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-red-100 border border-red-200">
                <p className="text-sm font-medium text-red-800">{warning.message || warning.description}</p>
                {warning.recommendation && (
                  <p className="text-xs text-red-600 mt-1">
                    Recommendation: {warning.recommendation}
                  </p>
                )}
              </div>
            ))}
            {highWarnings.map((warning, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-orange-100 border border-orange-200">
                <p className="text-sm font-medium text-orange-800">{warning.message || warning.description}</p>
                {warning.recommendation && (
                  <p className="text-xs text-orange-600 mt-1">
                    Recommendation: {warning.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modifications */}
      {modifications && modifications.length > 0 && (
        <div className="rounded-2xl bg-white border border-blue-200 shadow-lg overflow-hidden">
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <h4 className="font-semibold text-blue-800 flex items-center gap-2">
              <PencilSquareIcon className="h-5 w-5" />
              Dose Modifications ({modifications.length})
            </h4>
          </div>
          <div className="p-4 space-y-2">
            {modifications.map((mod, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-blue-50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">{mod.order}</p>
                    <p className="text-xs text-blue-600 mt-1">{mod.reason}</p>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium">
                    {mod.newDose}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders by category */}
      {Object.entries(groupedOrders).map(([category, orders]) => {
        const colors = categoryColors[category] || categoryColors.laboratory;
        const Icon = categoryIcons[category] || BeakerIcon;

        return (
          <div key={category} className="rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
            <div className={`p-3 ${colors.bg} border-b border-gray-200`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${colors.text}`} />
                <h4 className="font-semibold text-gray-900 capitalize">{category}</h4>
                <span className="text-sm text-gray-500">({orders.length})</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {orders.map((order, idx) => {
                const globalIdx = selectedOrders.findIndex(o => o.id === order.id);
                const urgencyOption = urgencyOptions.find(u => u.value === order.urgency);

                return (
                  <div key={order.id} className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveOrder(globalIdx, 'up')}
                          disabled={globalIdx === 0}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => moveOrder(globalIdx, 'down')}
                          disabled={globalIdx === selectedOrders.length - 1}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>

                      {/* Order details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-medium text-gray-900">{order.name}</h5>

                          {/* Urgency selector */}
                          {editingUrgency === order.id ? (
                            <div className="flex items-center gap-1">
                              {urgencyOptions.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    onUpdateUrgency(order.id, opt.value);
                                    setEditingUrgency(null);
                                  }}
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${opt.color} hover:ring-2 ring-offset-1`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                              <button
                                onClick={() => setEditingUrgency(null)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingUrgency(order.id)}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${urgencyOption?.color || 'bg-gray-100 text-gray-700'} hover:ring-2 ring-offset-1`}
                            >
                              {order.urgency}
                            </button>
                          )}
                        </div>

                        {order.dosing && (
                          <p className="text-sm text-gray-600 mt-1">
                            Dose: {order.dosing.adjusted || order.dosing.standard}
                          </p>
                        )}

                        {order.estimatedCost && (
                          <p className="text-xs text-gray-400 mt-1">
                            Est. ${order.estimatedCost.toFixed(2)}
                          </p>
                        )}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => onRemoveOrder(order.id)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClearAll}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handlePlaceOrders}
            disabled={isPlacing || selectedOrders.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-green-500/25"
          >
            {isPlacing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                <span>Placing Orders...</span>
              </>
            ) : (
              <>
                <DocumentCheckIcon className="h-5 w-5" />
                <span>Place {selectedOrders.length} Orders</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-100">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Critical Warnings</h3>
            </div>
            <p className="text-gray-600 mb-4">
              There are critical safety warnings that require your attention. Are you sure you want to proceed with these orders?
            </p>
            <div className="space-y-2 mb-6">
              {criticalWarnings.map((warning, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-800">{warning.message || warning.description}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  onPlaceOrders();
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
