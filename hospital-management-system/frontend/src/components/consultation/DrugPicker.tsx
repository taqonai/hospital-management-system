import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { MagnifyingGlassIcon, CheckIcon, PlusIcon, CurrencyDollarIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { pharmacyApi, insuranceCodingApi } from '../../services/api';
import clsx from 'clsx';

export interface DrugSelection {
  id?: string;
  name: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  category?: string;
  price?: number;
}

interface Drug {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  category: string;
  price?: number;
  inventory?: Array<{ quantity: number }>;
}

interface InsuranceInfo {
  hasInsurance: boolean;
  coveragePercentage: number;
  insuranceProvider?: string;
  formularyStatus?: 'COVERED' | 'NOT_COVERED' | 'PRIOR_AUTH_REQUIRED' | 'UNKNOWN';
}

export interface DrugPickerRef {
  triggerSearch: (term: string) => void;
}

interface DrugPickerProps {
  value: string;
  onChange: (drug: DrugSelection) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoSearchOnValueChange?: boolean; // Auto-search when value changes externally (e.g., from voice input)
  patientId?: string; // For cost estimate and formulary check
  showCostEstimate?: boolean; // Enable cost display
}

const DrugPicker = forwardRef<DrugPickerRef, DrugPickerProps>(function DrugPicker({
  value,
  onChange,
  placeholder = 'Search medication...',
  className,
  disabled = false,
  autoSearchOnValueChange = false,
  patientId,
  showCostEstimate = true,
}, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const prevValueRef = useRef(value);
  
  // Insurance info for cost estimate
  const [insuranceInfo, setInsuranceInfo] = useState<InsuranceInfo>({
    hasInsurance: false,
    coveragePercentage: 0,
  });

  // Fetch patient insurance info
  useEffect(() => {
    if (!patientId || !showCostEstimate) return;
    
    const fetchInsurance = async () => {
      try {
        const response = await insuranceCodingApi.verifyEligibility({ patientId });
        const data = response.data.data;
        if (data.eligible && data.insuranceProvider) {
          setInsuranceInfo({
            hasInsurance: true,
            coveragePercentage: data.coveragePercentage || 80,
            insuranceProvider: data.insuranceProvider,
            formularyStatus: 'UNKNOWN', // Would need formulary API for accurate status
          });
        }
      } catch (error) {
        console.error('Failed to fetch insurance:', error);
      }
    };
    fetchInsurance();
  }, [patientId, showCostEstimate]);

  // Search drugs function - defined early for use in effects
  const searchDrugs = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setDrugs([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await pharmacyApi.getDrugs({ search: term });
      const drugList = response.data?.data || response.data || [];
      setDrugs(drugList.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error('Error searching drugs:', error);
      setDrugs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Expose triggerSearch method to parent
  useImperativeHandle(ref, () => ({
    triggerSearch: (term: string) => {
      setSearchTerm(term);
      setSelectedDrug(null);
      setIsOpen(true);
      searchDrugs(term);
    },
  }), [searchDrugs]);

  // Sync searchTerm with external value and auto-search if enabled
  useEffect(() => {
    if (!selectedDrug || selectedDrug.name !== value) {
      setSearchTerm(value);

      // Auto-search when value changes externally (e.g., from voice transcription)
      if (autoSearchOnValueChange && value !== prevValueRef.current && value.length >= 2) {
        setIsOpen(true);
        searchDrugs(value);
      }
      prevValueRef.current = value;
    }
  }, [value, selectedDrug, autoSearchOnValueChange, searchDrugs]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setSelectedDrug(null);
    setIsOpen(true);

    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchDrugs(newValue);
    }, 300);

    // Also notify parent of the text change (for free text entry)
    onChange({ name: newValue });
  };

  const handleSelectDrug = (drug: Drug) => {
    setSearchTerm(drug.name);
    setSelectedDrug(drug);
    setIsOpen(false);
    onChange({
      id: drug.id,
      name: drug.name,
      genericName: drug.genericName,
      strength: drug.strength,
      dosageForm: drug.dosageForm,
      category: drug.category,
      price: Number(drug.price) || undefined,
    });
  };

  const handleAddCustom = () => {
    setIsOpen(false);
    onChange({ name: searchTerm });
  };

  const getStockStatus = (drug: Drug) => {
    const totalStock = drug.inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
    if (totalStock === 0) return { label: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-100' };
    if (totalStock < 20) return { label: 'Low Stock', color: 'text-amber-600', bg: 'bg-amber-100' };
    return { label: 'In Stock', color: 'text-green-600', bg: 'bg-green-100' };
  };

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            'w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            selectedDrug ? 'border-green-400 bg-green-50' : 'border-gray-300',
            disabled && 'bg-gray-100 cursor-not-allowed'
          )}
        />
        {selectedDrug && (
          <CheckIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}
      </div>

      {/* Selected drug details */}
      {selectedDrug && (
        <div className="mt-1 px-2 py-1 text-xs text-gray-600 bg-gray-50 rounded border border-gray-200">
          <span className="font-medium">{selectedDrug.genericName}</span>
          <span className="mx-1">·</span>
          <span>{selectedDrug.dosageForm}</span>
          <span className="mx-1">·</span>
          <span className="text-gray-500">{selectedDrug.category}</span>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-3 text-center text-gray-500">
              <span className="inline-block animate-spin mr-2">⟳</span>
              Searching...
            </div>
          ) : drugs.length > 0 ? (
            <>
              {drugs.map((drug) => {
                const stock = getStockStatus(drug);
                const price = Number(drug.price) || 0;
                const insuranceCover = insuranceInfo.hasInsurance 
                  ? (price * insuranceInfo.coveragePercentage / 100) 
                  : 0;
                const patientPays = price - insuranceCover;
                
                return (
                  <button
                    key={drug.id}
                    type="button"
                    onClick={() => handleSelectDrug(drug)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{drug.name}</div>
                      <div className="flex items-center gap-2">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full', stock.bg, stock.color)}>
                          {stock.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {drug.genericName}
                      <span className="mx-1">·</span>
                      {drug.dosageForm}
                      {drug.strength && (
                        <>
                          <span className="mx-1">·</span>
                          {drug.strength}
                        </>
                      )}
                    </div>
                    {/* Cost Estimate */}
                    {showCostEstimate && price > 0 && (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-gray-600">
                          <CurrencyDollarIcon className="h-3.5 w-3.5" />
                          AED {price.toFixed(2)}
                        </span>
                        {insuranceInfo.hasInsurance ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <ShieldCheckIcon className="h-3.5 w-3.5" />
                            Patient pays: AED {patientPays.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-orange-600">Self-pay</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
              {/* Custom entry option */}
              <button
                type="button"
                onClick={handleAddCustom}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-t border-gray-200 flex items-center gap-2 text-gray-600"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Use "{searchTerm}" as custom medication</span>
              </button>
            </>
          ) : searchTerm.length >= 2 ? (
            <div className="px-4 py-3">
              <div className="text-gray-500 text-sm mb-2">No matching drugs found</div>
              <button
                type="button"
                onClick={handleAddCustom}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 rounded border border-gray-200 flex items-center gap-2 text-gray-700"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Add "{searchTerm}" as custom medication</span>
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 text-gray-500 text-sm">
              Type at least 2 characters to search...
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default DrugPicker;
