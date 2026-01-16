import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import clsx from 'clsx';

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface CPTCode {
  id: string;
  code: string;
  description: string;
  category?: string;
  basePrice?: number;
  dhaPrice?: number;
  requiresPreAuth?: boolean;
}

interface SelectedCPT extends CPTCode {
  modifiers?: string[];
  units?: number;
  price?: number;
}

interface CPTCodePickerProps {
  selectedCodes: SelectedCPT[];
  onSelect: (code: CPTCode) => void;
  onRemove: (codeId: string) => void;
  onUpdateCode?: (codeId: string, updates: Partial<SelectedCPT>) => void;
  maxSelections?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showPrices?: boolean;
  payerId?: string;
}

const COMMON_MODIFIERS = [
  { code: '25', description: 'Significant, separately identifiable E/M' },
  { code: '59', description: 'Distinct procedural service' },
  { code: '76', description: 'Repeat procedure by same physician' },
  { code: '77', description: 'Repeat procedure by different physician' },
  { code: '26', description: 'Professional component' },
  { code: 'TC', description: 'Technical component' },
];

export default function CPTCodePicker({
  selectedCodes,
  onSelect,
  onRemove,
  onUpdateCode,
  maxSelections = 20,
  placeholder = 'Search CPT codes...',
  className,
  disabled = false,
  showPrices = true,
  payerId,
}: CPTCodePickerProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  // Debounce search input
  const debouncedSearch = useDebounce(search, 300);

  // Fetch CPT codes
  const { data, isLoading } = useQuery({
    queryKey: ['cpt-codes', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        return { data: [], total: 0 };
      }
      const response = await api.get('/insurance-coding/cpt', {
        params: { search: debouncedSearch, limit: 20 },
      });
      return response.data;
    },
    enabled: debouncedSearch.length >= 2,
  });

  const codes = data?.data || [];
  const isSelected = (codeId: string) => selectedCodes.some((c) => c.id === codeId);
  const canSelect = selectedCodes.length < maxSelections;

  const handleSelect = (code: CPTCode) => {
    if (isSelected(code.id)) {
      onRemove(code.id);
    } else if (canSelect) {
      onSelect(code);
    }
  };

  const toggleModifier = (codeId: string, modifier: string) => {
    const code = selectedCodes.find((c) => c.id === codeId);
    if (!code || !onUpdateCode) return;

    const currentModifiers = code.modifiers || [];
    const newModifiers = currentModifiers.includes(modifier)
      ? currentModifiers.filter((m) => m !== modifier)
      : [...currentModifiers, modifier];

    onUpdateCode(codeId, { modifiers: newModifiers });
  };

  const updateUnits = (codeId: string, units: number) => {
    if (onUpdateCode && units >= 1 && units <= 99) {
      onUpdateCode(codeId, { units });
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return '-';
    return `AED ${Number(price).toFixed(2)}`;
  };

  const calculateTotal = () => {
    return selectedCodes.reduce((sum, code) => {
      const price = code.price || code.dhaPrice || code.basePrice || 0;
      const units = code.units || 1;
      return sum + price * units;
    }, 0);
  };

  return (
    <div className={clsx('space-y-3', className)}>
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled || !canSelect}
          className={clsx(
            'w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm',
            'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
            disabled && 'bg-gray-100 cursor-not-allowed'
          )}
        />
        {search && (
          <button
            onClick={() => {
              setSearch('');
              setShowDropdown(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
          >
            <XMarkIcon className="h-4 w-4 text-gray-400" />
          </button>
        )}

        {/* Dropdown */}
        {showDropdown && search.length >= 2 && (
          <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-sm text-gray-500">Searching...</span>
              </div>
            ) : codes.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">
                No CPT codes found for "{search}"
              </div>
            ) : (
              <ul>
                {codes.map((code: CPTCode) => (
                  <li
                    key={code.id}
                    onClick={() => {
                      handleSelect(code);
                      if (!isSelected(code.id)) {
                        setSearch('');
                      }
                    }}
                    className={clsx(
                      'px-4 py-2 hover:bg-gray-50 cursor-pointer',
                      isSelected(code.id) && 'bg-purple-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">
                            {code.code}
                          </span>
                          {code.requiresPreAuth && (
                            <span className="flex items-center gap-1 px-1 py-0.5 bg-yellow-50 text-yellow-600 rounded text-xs">
                              <ExclamationTriangleIcon className="h-3 w-3" />
                              Pre-Auth
                            </span>
                          )}
                          {showPrices && code.dhaPrice && (
                            <span className="flex items-center gap-1 px-1 py-0.5 bg-green-50 text-green-600 rounded text-xs">
                              <CurrencyDollarIcon className="h-3 w-3" />
                              {formatPrice(code.dhaPrice)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{code.description}</p>
                        {code.category && (
                          <p className="text-xs text-gray-400">{code.category}</p>
                        )}
                      </div>
                      <div className="ml-2">
                        {isSelected(code.id) ? (
                          <CheckIcon className="h-5 w-5 text-purple-600" />
                        ) : canSelect ? (
                          <PlusIcon className="h-5 w-5 text-gray-400" />
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}

      {/* Selected Codes List */}
      {selectedCodes.length > 0 && (
        <div className="space-y-2">
          {selectedCodes.map((code) => (
            <div
              key={code.id}
              className="border border-gray-200 rounded-lg p-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {code.code}
                    </span>
                    {code.requiresPreAuth && (
                      <span className="flex items-center gap-1 px-1 py-0.5 bg-yellow-50 text-yellow-600 rounded text-xs">
                        <ExclamationTriangleIcon className="h-3 w-3" />
                        Pre-Auth
                      </span>
                    )}
                    {code.modifiers && code.modifiers.length > 0 && (
                      <div className="flex gap-1">
                        {code.modifiers.map((mod) => (
                          <span
                            key={mod}
                            className="px-1 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-mono"
                          >
                            -{mod}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{code.description}</p>
                </div>
                {!disabled && (
                  <button
                    onClick={() => onRemove(code.id)}
                    className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Editable Fields */}
              {!disabled && onUpdateCode && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-4">
                    {/* Units */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Units:</span>
                      <div className="flex items-center">
                        <button
                          onClick={() => updateUnits(code.id, (code.units || 1) - 1)}
                          disabled={(code.units || 1) <= 1}
                          className="px-2 py-0.5 border border-gray-300 rounded-l text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={code.units || 1}
                          onChange={(e) => updateUnits(code.id, parseInt(e.target.value) || 1)}
                          className="w-12 px-2 py-0.5 border-t border-b border-gray-300 text-center text-sm"
                          min={1}
                          max={99}
                        />
                        <button
                          onClick={() => updateUnits(code.id, (code.units || 1) + 1)}
                          disabled={(code.units || 1) >= 99}
                          className="px-2 py-0.5 border border-gray-300 rounded-r text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Modifiers */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Modifiers:</span>
                      <div className="flex gap-1">
                        {COMMON_MODIFIERS.slice(0, 4).map((mod) => (
                          <button
                            key={mod.code}
                            onClick={() => toggleModifier(code.id, mod.code)}
                            title={mod.description}
                            className={clsx(
                              'px-1.5 py-0.5 rounded text-xs font-mono border',
                              code.modifiers?.includes(mod.code)
                                ? 'bg-blue-50 text-blue-600 border-blue-300'
                                : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                            )}
                          >
                            {mod.code}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price */}
                    {showPrices && (
                      <div className="ml-auto text-right">
                        <span className="text-xs text-gray-500">Line Total:</span>
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {formatPrice((code.price || code.dhaPrice || code.basePrice || 0) * (code.units || 1))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Total */}
          {showPrices && selectedCodes.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Total Charges:</span>
              <span className="text-lg font-semibold text-gray-900">{formatPrice(calculateTotal())}</span>
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      <div className="text-xs text-gray-500">
        {selectedCodes.length} of {maxSelections} procedures selected
      </div>
    </div>
  );
}
