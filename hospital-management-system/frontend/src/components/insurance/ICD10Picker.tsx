import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  PlusIcon,
  StarIcon,
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

interface ICD10Code {
  id: string;
  code: string;
  description: string;
  category?: string;
  specificityLevel?: string;
  dhaApproved?: boolean;
  isUnspecified?: boolean;
  preferredCode?: string;
}

interface ICD10PickerProps {
  selectedCodes: ICD10Code[];
  onSelect: (code: ICD10Code) => void;
  onRemove: (codeId: string) => void;
  maxSelections?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ICD10Picker({
  selectedCodes,
  onSelect,
  onRemove,
  maxSelections = 10,
  placeholder = 'Search ICD-10 codes...',
  className,
  disabled = false,
}: ICD10PickerProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Debounce search input
  const debouncedSearch = useDebounce(search, 300);

  // Fetch ICD-10 codes
  const { data, isLoading } = useQuery({
    queryKey: ['icd10-codes', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        return { data: [], total: 0 };
      }
      const response = await api.get('/insurance-coding/icd10', {
        params: { search: debouncedSearch, limit: 20 },
      });
      return response.data;
    },
    enabled: debouncedSearch.length >= 2,
  });

  const codes = data?.data || [];
  const isSelected = (codeId: string) => selectedCodes.some((c) => c.id === codeId);
  const canSelect = selectedCodes.length < maxSelections;

  const handleSelect = (code: ICD10Code) => {
    if (isSelected(code.id)) {
      onRemove(code.id);
    } else if (canSelect) {
      onSelect(code);
    }
  };

  return (
    <div className={clsx('relative', className)}>
      {/* Selected Codes */}
      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedCodes.map((code, idx) => (
            <div
              key={code.id}
              className={clsx(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-sm',
                idx === 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
              )}
            >
              {idx === 0 && <StarIcon className="h-3 w-3 text-purple-600" />}
              <span className="font-mono font-medium">{code.code}</span>
              <span className="text-xs max-w-[200px] truncate">{code.description}</span>
              {!disabled && (
                <button
                  onClick={() => onRemove(code.id)}
                  className="ml-1 p-0.5 hover:bg-gray-200 rounded"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
      </div>

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
              No ICD-10 codes found for "{search}"
            </div>
          ) : (
            <ul>
              {codes.map((code: ICD10Code) => (
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
                        {code.dhaApproved && (
                          <span className="px-1 py-0.5 bg-green-50 text-green-600 rounded text-xs">
                            DHA
                          </span>
                        )}
                        {code.isUnspecified && (
                          <span className="px-1 py-0.5 bg-yellow-50 text-yellow-600 rounded text-xs">
                            Unspecified
                          </span>
                        )}
                        {code.specificityLevel && (
                          <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {code.specificityLevel}
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

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}

      {/* Helper text */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-500">
          {selectedCodes.length} of {maxSelections} codes selected
        </span>
        {selectedCodes.length > 0 && (
          <span className="text-xs text-gray-400">
            First code is primary diagnosis
          </span>
        )}
      </div>
    </div>
  );
}
