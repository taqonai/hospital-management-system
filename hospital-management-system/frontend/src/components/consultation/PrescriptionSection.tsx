import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BeakerIcon,
  ShieldExclamationIcon,
  InformationCircleIcon,
  LightBulbIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { api, pharmacyApi } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import clsx from 'clsx';

// Custom debounce hook
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// Types
interface Medication {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
}

interface Allergy {
  allergen: string;
  type: string;
  severity: string;
}

interface DrugWarning {
  id: string;
  type: 'interaction' | 'allergy' | 'dosage' | 'duplicate' | 'contraindication';
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  message: string;
  medications: string[];
  recommendation?: string;
  alternatives?: Array<{
    name: string;
    genericName: string;
    rationale: string;
  }>;
}

interface ValidationResult {
  isValid: boolean;
  warnings: DrugWarning[];
  suggestions?: string[];
}

interface DrugSuggestion {
  id: string;
  name: string;
  genericName: string;
  class?: string;
  form?: string;
  strength?: string;
}

interface PrescriptionSectionProps {
  patientId: string;
  patientAllergies?: Allergy[];
  onPrescriptionChange?: (prescriptions: Medication[]) => void;
  initialPrescriptions?: Medication[];
  className?: string;
}

const ROUTES = [
  { value: 'PO', label: 'Oral (PO)' },
  { value: 'IV', label: 'Intravenous (IV)' },
  { value: 'IM', label: 'Intramuscular (IM)' },
  { value: 'SC', label: 'Subcutaneous (SC)' },
  { value: 'SL', label: 'Sublingual (SL)' },
  { value: 'TOP', label: 'Topical' },
  { value: 'INH', label: 'Inhalation' },
  { value: 'OPH', label: 'Ophthalmic' },
  { value: 'OT', label: 'Otic' },
  { value: 'PR', label: 'Rectal (PR)' },
  { value: 'NAS', label: 'Nasal' },
];

const FREQUENCIES = [
  { value: 'OD', label: 'Once daily (OD)' },
  { value: 'BD', label: 'Twice daily (BD)' },
  { value: 'TDS', label: 'Three times daily (TDS)' },
  { value: 'QID', label: 'Four times daily (QID)' },
  { value: 'Q4H', label: 'Every 4 hours' },
  { value: 'Q6H', label: 'Every 6 hours' },
  { value: 'Q8H', label: 'Every 8 hours' },
  { value: 'Q12H', label: 'Every 12 hours' },
  { value: 'PRN', label: 'As needed (PRN)' },
  { value: 'STAT', label: 'Immediately (STAT)' },
  { value: 'HS', label: 'At bedtime (HS)' },
  { value: 'AC', label: 'Before meals (AC)' },
  { value: 'PC', label: 'After meals (PC)' },
  { value: 'WEEKLY', label: 'Weekly' },
];

const DURATIONS = [
  '3 days',
  '5 days',
  '7 days',
  '10 days',
  '14 days',
  '21 days',
  '1 month',
  '2 months',
  '3 months',
  '6 months',
  'Ongoing',
];

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-700',
    iconBg: 'bg-red-100',
    icon: 'text-red-600',
    badge: 'bg-red-600 text-white',
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    text: 'text-orange-700',
    iconBg: 'bg-orange-100',
    icon: 'text-orange-600',
    badge: 'bg-orange-500 text-white',
  },
  moderate: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-700',
    iconBg: 'bg-yellow-100',
    icon: 'text-yellow-600',
    badge: 'bg-yellow-500 text-white',
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-700',
    iconBg: 'bg-blue-100',
    icon: 'text-blue-600',
    badge: 'bg-blue-500 text-white',
  },
};

const createEmptyMedication = (): Medication => ({
  id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: '',
  genericName: '',
  dosage: '',
  frequency: 'OD',
  duration: '7 days',
  route: 'PO',
  instructions: '',
});

export default function PrescriptionSection({
  patientId,
  patientAllergies = [],
  onPrescriptionChange,
  initialPrescriptions = [],
  className = '',
}: PrescriptionSectionProps) {
  // State
  const [medications, setMedications] = useState<Medication[]>(
    initialPrescriptions.length > 0 ? initialPrescriptions : [createEmptyMedication()]
  );
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});
  const [drugSearchQuery, setDrugSearchQuery] = useState<Record<string, string>>({});
  const [showDrugSuggestions, setShowDrugSuggestions] = useState<Record<string, boolean>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Drug search query
  const activeDrugSearch = Object.entries(drugSearchQuery).find(([_, query]) => query.length >= 2);
  const { data: drugSuggestions, isLoading: drugSearchLoading } = useQuery({
    queryKey: ['drug-search', activeDrugSearch?.[1]],
    queryFn: async () => {
      const response = await pharmacyApi.getDrugs({ search: activeDrugSearch?.[1], limit: 10 });
      return response.data.data?.drugs || [];
    },
    enabled: !!activeDrugSearch && activeDrugSearch[1].length >= 2,
    staleTime: 30000,
  });

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: async (meds: Medication[]) => {
      const response = await api.post('/ai-consultation/validate-prescription', {
        patientId,
        medications: meds
          .filter((m) => m.name.trim())
          .map((m) => ({
            name: m.name,
            genericName: m.genericName,
            dosage: m.dosage,
            frequency: m.frequency,
            route: m.route,
            duration: m.duration,
          })),
        allergies: patientAllergies.map((a) => a.allergen),
      });
      return response.data.data as ValidationResult;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setIsValidating(false);
    },
    onError: () => {
      setIsValidating(false);
    },
  });

  // Debounced validation
  const debouncedValidate = useDebouncedCallback((meds: Medication[]) => {
    const validMeds = meds.filter((m) => m.name.trim());
    if (validMeds.length > 0) {
      setIsValidating(true);
      validateMutation.mutate(meds);
    } else {
      setValidationResult(null);
    }
  }, 500);

  // Check for allergy matches locally
  const checkLocalAllergyWarnings = useCallback(
    (meds: Medication[]): DrugWarning[] => {
      const warnings: DrugWarning[] = [];

      meds.forEach((med) => {
        if (!med.name.trim()) return;

        patientAllergies.forEach((allergy) => {
          const allergenLower = allergy.allergen.toLowerCase();
          const medNameLower = med.name.toLowerCase();
          const genericLower = med.genericName.toLowerCase();

          if (medNameLower.includes(allergenLower) || genericLower.includes(allergenLower)) {
            warnings.push({
              id: `allergy-${med.id}-${allergy.allergen}`,
              type: 'allergy',
              severity:
                allergy.severity === 'LIFE_THREATENING'
                  ? 'critical'
                  : allergy.severity === 'SEVERE'
                  ? 'critical'
                  : 'high',
              title: `Allergy Warning: ${allergy.allergen}`,
              message: `Patient is allergic to ${allergy.allergen}. ${med.name} may trigger a reaction.`,
              medications: [med.name],
              recommendation: 'Consider alternative medication. Do not prescribe unless benefits outweigh risks.',
            });
          }
        });
      });

      return warnings;
    },
    [patientAllergies]
  );

  // Combined warnings (local + API)
  const allWarnings = useMemo(() => {
    const localWarnings = checkLocalAllergyWarnings(medications);
    const apiWarnings = validationResult?.warnings || [];

    // Combine and deduplicate
    const warningMap = new Map<string, DrugWarning>();
    [...localWarnings, ...apiWarnings].forEach((w) => {
      warningMap.set(w.id, w);
    });

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
    return Array.from(warningMap.values()).sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }, [medications, validationResult, checkLocalAllergyWarnings]);

  // Warning counts by severity
  const warningCounts = useMemo(() => {
    return allWarnings.reduce(
      (acc, w) => {
        acc[w.severity] = (acc[w.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [allWarnings]);

  // Trigger validation on medication changes
  useEffect(() => {
    debouncedValidate(medications);
    onPrescriptionChange?.(medications);
  }, [medications, debouncedValidate, onPrescriptionChange]);

  // Handlers
  const addMedication = () => {
    setMedications((prev) => [...prev, createEmptyMedication()]);
  };

  const removeMedication = (id: string) => {
    setMedications((prev) => {
      const filtered = prev.filter((m) => m.id !== id);
      return filtered.length > 0 ? filtered : [createEmptyMedication()];
    });
  };

  const updateMedication = (id: string, field: keyof Medication, value: string) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const selectDrug = (medId: string, drug: DrugSuggestion) => {
    setMedications((prev) =>
      prev.map((m) =>
        m.id === medId
          ? {
              ...m,
              name: drug.name,
              genericName: drug.genericName || '',
            }
          : m
      )
    );
    setShowDrugSuggestions((prev) => ({ ...prev, [medId]: false }));
    setDrugSearchQuery((prev) => ({ ...prev, [medId]: '' }));
  };

  const handleDrugNameChange = (medId: string, value: string) => {
    updateMedication(medId, 'name', value);
    setDrugSearchQuery((prev) => ({ ...prev, [medId]: value }));
    setShowDrugSuggestions((prev) => ({ ...prev, [medId]: value.length >= 2 }));
  };

  const toggleWarningExpanded = (warningId: string) => {
    setExpandedWarnings((prev) => ({
      ...prev,
      [warningId]: !prev[warningId],
    }));
  };

  const getWarningIcon = (type: string) => {
    switch (type) {
      case 'allergy':
        return ShieldExclamationIcon;
      case 'interaction':
        return BeakerIcon;
      case 'duplicate':
        return ClipboardDocumentIcon;
      default:
        return ExclamationTriangleIcon;
    }
  };

  // Get warnings for a specific medication
  const getWarningsForMedication = (medName: string): DrugWarning[] => {
    if (!medName.trim()) return [];
    return allWarnings.filter((w) =>
      w.medications.some((m) => m.toLowerCase() === medName.toLowerCase())
    );
  };

  // Count valid medications
  const validMedicationCount = medications.filter((m) => m.name.trim()).length;

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <ClipboardDocumentIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Prescription</h2>
            <p className="text-sm text-gray-500">
              {validMedicationCount} medication{validMedicationCount !== 1 ? 's' : ''} added
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isValidating && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <ArrowPathIcon className="h-3 w-3 animate-spin" />
              Validating...
            </span>
          )}
          {!isValidating && allWarnings.length === 0 && validMedicationCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              No warnings
            </span>
          )}
        </div>
      </div>

      {/* Patient Allergies */}
      {patientAllergies.length > 0 && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <ShieldExclamationIcon className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">Known Drug Allergies</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {patientAllergies.map((allergy, idx) => (
              <span
                key={idx}
                className={clsx(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  allergy.severity === 'LIFE_THREATENING' || allergy.severity === 'SEVERE'
                    ? 'bg-red-200 text-red-800'
                    : 'bg-red-100 text-red-700'
                )}
              >
                {allergy.allergen} ({allergy.severity})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Warnings Summary */}
      {allWarnings.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div
            className={clsx(
              'px-4 py-3 flex items-center justify-between',
              warningCounts.critical
                ? 'bg-red-100'
                : warningCounts.high
                ? 'bg-orange-100'
                : 'bg-yellow-100'
            )}
          >
            <div className="flex items-center gap-2">
              <ExclamationCircleIcon
                className={clsx(
                  'h-5 w-5',
                  warningCounts.critical
                    ? 'text-red-600 animate-pulse'
                    : warningCounts.high
                    ? 'text-orange-600'
                    : 'text-yellow-600'
                )}
              />
              <span className="font-semibold text-gray-900">
                {allWarnings.length} Warning{allWarnings.length !== 1 ? 's' : ''} Found
              </span>
            </div>
            <div className="flex items-center gap-2">
              {warningCounts.critical > 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                  {warningCounts.critical} Critical
                </span>
              )}
              {warningCounts.high > 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500 text-white">
                  {warningCounts.high} High
                </span>
              )}
              {warningCounts.moderate > 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500 text-white">
                  {warningCounts.moderate} Moderate
                </span>
              )}
            </div>
          </div>

          <div className="p-3 space-y-2">
            {allWarnings.map((warning) => {
              const styles = SEVERITY_STYLES[warning.severity];
              const WarningIcon = getWarningIcon(warning.type);
              const isExpanded = expandedWarnings[warning.id];

              return (
                <div
                  key={warning.id}
                  className={clsx(
                    'rounded-lg border-l-4 overflow-hidden transition-all',
                    styles.bg,
                    styles.border
                  )}
                >
                  <button
                    onClick={() => toggleWarningExpanded(warning.id)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={clsx('p-1.5 rounded-lg', styles.iconBg)}>
                        <WarningIcon className={clsx('h-4 w-4', styles.icon)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={clsx('text-sm font-semibold', styles.text)}>
                            {warning.title}
                          </span>
                          <span
                            className={clsx(
                              'px-1.5 py-0.5 rounded text-xs font-bold uppercase',
                              styles.badge
                            )}
                          >
                            {warning.severity}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{warning.message}</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUpIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {warning.recommendation && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-white/60">
                          <LightBulbIcon className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-gray-700">Recommendation:</p>
                            <p className="text-xs text-gray-600">{warning.recommendation}</p>
                          </div>
                        </div>
                      )}

                      {warning.alternatives && warning.alternatives.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-700">
                            Suggested Alternatives:
                          </p>
                          {warning.alternatives.map((alt, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 p-2 rounded-lg bg-green-50 border border-green-200"
                            >
                              <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-green-800">
                                  {alt.name} ({alt.genericName})
                                </p>
                                <p className="text-xs text-green-700">{alt.rationale}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Medication List */}
      <div className="space-y-4">
        {medications.map((med, index) => {
          const medWarnings = getWarningsForMedication(med.name);
          const hasCriticalWarning = medWarnings.some((w) => w.severity === 'critical');
          const hasHighWarning = medWarnings.some((w) => w.severity === 'high');

          return (
            <div
              key={med.id}
              className={clsx(
                'rounded-xl border-2 overflow-hidden transition-all',
                hasCriticalWarning
                  ? 'border-red-500 bg-red-50/50'
                  : hasHighWarning
                  ? 'border-orange-400 bg-orange-50/30'
                  : 'border-gray-200 bg-white'
              )}
            >
              {/* Medication Header */}
              <div
                className={clsx(
                  'px-4 py-2 flex items-center justify-between',
                  hasCriticalWarning
                    ? 'bg-red-100'
                    : hasHighWarning
                    ? 'bg-orange-100'
                    : 'bg-gray-50'
                )}
              >
                <span className="text-sm font-semibold text-gray-900">
                  Medication #{index + 1}
                </span>
                <div className="flex items-center gap-2">
                  {medWarnings.length > 0 && (
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                        hasCriticalWarning
                          ? 'bg-red-200 text-red-800'
                          : hasHighWarning
                          ? 'bg-orange-200 text-orange-800'
                          : 'bg-yellow-200 text-yellow-800'
                      )}
                    >
                      <ExclamationTriangleIcon className="h-3 w-3" />
                      {medWarnings.length} warning{medWarnings.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <button
                    onClick={() => removeMedication(med.id)}
                    className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove medication"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Medication Form */}
              <div className="p-4 space-y-4">
                {/* Drug Name with Autocomplete */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Drug Name *
                    </label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => handleDrugNameChange(med.id, e.target.value)}
                        onFocus={() =>
                          setShowDrugSuggestions((prev) => ({
                            ...prev,
                            [med.id]: med.name.length >= 2,
                          }))
                        }
                        onBlur={() =>
                          setTimeout(
                            () =>
                              setShowDrugSuggestions((prev) => ({ ...prev, [med.id]: false })),
                            200
                          )
                        }
                        placeholder="Search medication..."
                        className={clsx(
                          'w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 transition-colors',
                          hasCriticalWarning
                            ? 'border-red-400 focus:ring-red-500/30 focus:border-red-500'
                            : hasHighWarning
                            ? 'border-orange-400 focus:ring-orange-500/30 focus:border-orange-500'
                            : 'border-gray-300 focus:ring-blue-500/30 focus:border-blue-500'
                        )}
                      />
                      {drugSearchLoading && activeDrugSearch?.[0] === med.id && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <LoadingSpinner size="sm" />
                        </div>
                      )}
                    </div>

                    {/* Drug Suggestions Dropdown */}
                    {showDrugSuggestions[med.id] &&
                      drugSuggestions &&
                      drugSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                          {drugSuggestions.map((drug: DrugSuggestion) => (
                            <button
                              key={drug.id}
                              onClick={() => selectDrug(med.id, drug)}
                              className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors"
                            >
                              <p className="text-sm font-medium text-gray-900">{drug.name}</p>
                              {drug.genericName && (
                                <p className="text-xs text-gray-500">{drug.genericName}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Generic Name
                    </label>
                    <input
                      type="text"
                      value={med.genericName}
                      onChange={(e) => updateMedication(med.id, 'genericName', e.target.value)}
                      placeholder="Generic name"
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Dosage, Frequency, Route */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dosage *
                    </label>
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedication(med.id, 'dosage', e.target.value)}
                      placeholder="e.g., 500mg"
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency *
                    </label>
                    <select
                      value={med.frequency}
                      onChange={(e) => updateMedication(med.id, 'frequency', e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    >
                      {FREQUENCIES.map((freq) => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                    <select
                      value={med.route}
                      onChange={(e) => updateMedication(med.id, 'route', e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    >
                      {ROUTES.map((route) => (
                        <option key={route.value} value={route.value}>
                          {route.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Duration and Instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <select
                      value={med.duration}
                      onChange={(e) => updateMedication(med.id, 'duration', e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    >
                      {DURATIONS.map((dur) => (
                        <option key={dur} value={dur}>
                          {dur}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Special Instructions
                    </label>
                    <input
                      type="text"
                      value={med.instructions}
                      onChange={(e) => updateMedication(med.id, 'instructions', e.target.value)}
                      placeholder="e.g., Take with food"
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Inline Warnings for this medication */}
                {medWarnings.length > 0 && (
                  <div className="space-y-2">
                    {medWarnings.map((warning) => {
                      const styles = SEVERITY_STYLES[warning.severity];
                      return (
                        <div
                          key={warning.id}
                          className={clsx(
                            'p-2 rounded-lg border-l-2 flex items-start gap-2',
                            styles.bg,
                            styles.border
                          )}
                        >
                          <ExclamationTriangleIcon className={clsx('h-4 w-4 mt-0.5', styles.icon)} />
                          <div className="flex-1">
                            <p className={clsx('text-xs font-semibold', styles.text)}>
                              {warning.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">{warning.message}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Medication Button */}
        <button
          onClick={addMedication}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="font-medium">Add Medication</span>
        </button>
      </div>

      {/* Summary Section */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Prescription Summary</h4>
            <p className="text-sm text-gray-500 mt-0.5">
              {validMedicationCount} medication{validMedicationCount !== 1 ? 's' : ''} |{' '}
              {allWarnings.length} warning{allWarnings.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allWarnings.length === 0 && validMedicationCount > 0 ? (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                <CheckCircleIcon className="h-4 w-4" />
                Ready to prescribe
              </span>
            ) : allWarnings.some((w) => w.severity === 'critical') ? (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                <ExclamationCircleIcon className="h-4 w-4" />
                Review critical warnings
              </span>
            ) : allWarnings.length > 0 ? (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Review warnings
              </span>
            ) : null}
          </div>
        </div>

        {/* Quick list of medications */}
        {validMedicationCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {medications
              .filter((m) => m.name.trim())
              .map((med) => {
                const hasWarning = getWarningsForMedication(med.name).length > 0;
                return (
                  <span
                    key={med.id}
                    className={clsx(
                      'px-2 py-1 rounded-lg text-xs font-medium',
                      hasWarning ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    {med.name} {med.dosage} {med.frequency}
                  </span>
                );
              })}
          </div>
        )}
      </div>

      {/* AI Disclaimer */}
      <div className="text-xs text-gray-500 text-center">
        <InformationCircleIcon className="h-3.5 w-3.5 inline mr-1" />
        Drug interaction checks are AI-assisted. Always verify with clinical references.
      </div>
    </div>
  );
}
