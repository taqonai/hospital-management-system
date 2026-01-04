import { useState } from 'react';
import {
  BeakerIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  PlusIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Types
interface Interaction {
  drug1: string;
  drug2: string;
  severity: string;
  severityLevel: number;
  effect: string;
  mechanism: string;
  management: string;
  clinicalEvidence: string;
  color: string;
}

interface FoodInteraction {
  drug: string;
  foodType: string;
  foods: string[];
  effect: string;
  management: string;
}

interface AllergyAlert {
  drug: string;
  allergen: string;
  alertType: string;
  severity: string;
  message: string;
  action: string;
}

interface Contraindication {
  drug: string;
  condition: string;
  risk: string;
  action: string;
  severity: string;
}

interface DrugInfo {
  name: string;
  genericName: string;
  class?: string;
  subclass?: string;
  brandNames?: string[];
  mechanism?: string;
  found: boolean;
}

interface Recommendation {
  priority: string;
  type: string;
  message: string;
  action: string;
}

interface Summary {
  totalInteractions: number;
  criticalCount: number;
  severeCount: number;
  moderateCount: number;
  minorCount: number;
  allergyAlertCount: number;
  contraindicationCount: number;
  overallRisk: string;
}

interface InteractionCheckResult {
  interactions: Interaction[];
  foodInteractions: FoodInteraction[];
  conditionContraindications: Contraindication[];
  allergyAlerts: AllergyAlert[];
  summary: Summary;
  recommendations: Recommendation[];
  drugInfo: DrugInfo[];
  modelVersion: string;
}

interface DrugInteractionCheckerProps {
  className?: string;
  onCheckComplete?: (result: InteractionCheckResult) => void;
}

const SEVERITY_CONFIG = {
  CONTRAINDICATED: {
    label: 'Contraindicated',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-500',
    icon: ExclamationCircleIcon,
    description: 'Do not use together',
  },
  SEVERE: {
    label: 'Severe',
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-600',
    borderColor: 'border-red-400',
    icon: ExclamationTriangleIcon,
    description: 'Consider alternatives',
  },
  MODERATE: {
    label: 'Moderate',
    color: 'orange',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-400',
    icon: ExclamationTriangleIcon,
    description: 'Monitor closely',
  },
  MINOR: {
    label: 'Minor',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-600',
    borderColor: 'border-yellow-400',
    icon: InformationCircleIcon,
    description: 'Be aware',
  },
};

const RISK_CONFIG = {
  CRITICAL: { color: 'red', label: 'Critical Risk' },
  HIGH: { color: 'red', label: 'High Risk' },
  MODERATE: { color: 'orange', label: 'Moderate Risk' },
  LOW: { color: 'yellow', label: 'Low Risk' },
  MINIMAL: { color: 'green', label: 'Minimal Risk' },
};

const DEMO_MEDICATION_SETS = [
  {
    label: 'Anticoagulation Regimen',
    medications: ['Warfarin', 'Aspirin', 'Omeprazole'],
    allergies: [],
  },
  {
    label: 'Cardiac + Pain Meds',
    medications: ['Lisinopril', 'Metoprolol', 'Ibuprofen', 'Simvastatin'],
    allergies: [],
  },
  {
    label: 'Polypharmacy Example',
    medications: ['Warfarin', 'Amiodarone', 'Digoxin', 'Furosemide', 'Metformin'],
    allergies: ['Penicillin'],
  },
  {
    label: 'Opioid + Benzo (High Risk)',
    medications: ['Oxycodone', 'Alprazolam', 'Gabapentin'],
    allergies: [],
  },
];

export default function DrugInteractionChecker({
  className = '',
  onCheckComplete,
}: DrugInteractionCheckerProps) {
  // Form state
  const [medications, setMedications] = useState<string[]>([]);
  const [currentMed, setCurrentMed] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [currentAllergy, setCurrentAllergy] = useState('');
  const [patientAge, setPatientAge] = useState<number | undefined>(undefined);
  const [conditions] = useState<string[]>([]);

  // Analysis state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InteractionCheckResult | null>(null);

  // UI state
  const [showInteractions, setShowInteractions] = useState(true);
  const [showFoodInteractions, setShowFoodInteractions] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [expandedInteraction, setExpandedInteraction] = useState<number | null>(null);

  // Add medication
  const addMedication = () => {
    const med = currentMed.trim();
    if (med && !medications.includes(med)) {
      setMedications([...medications, med]);
      setCurrentMed('');
    }
  };

  // Remove medication
  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  // Add allergy
  const addAllergy = () => {
    const allergy = currentAllergy.trim();
    if (allergy && !allergies.includes(allergy)) {
      setAllergies([...allergies, allergy]);
      setCurrentAllergy('');
    }
  };

  // Remove allergy
  const removeAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  // Load demo set
  const loadDemoSet = (demo: typeof DEMO_MEDICATION_SETS[0]) => {
    setMedications(demo.medications);
    setAllergies(demo.allergies);
    setResult(null);
    setError(null);
  };

  // Check interactions
  const checkInteractions = async () => {
    if (medications.length < 1) {
      setError('Please add at least one medication');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ai/pharmacy/check-interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          medications,
          allergies,
          patientAge: patientAge || null,
          patientConditions: conditions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check interactions');
      }

      const checkResult = await response.json();
      setResult(checkResult);

      if (onCheckComplete) {
        onCheckComplete(checkResult);
      }
    } catch (err) {
      setError('Failed to check drug interactions. Please try again.');
      console.error('Interaction check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityConfig = (severity: string) => {
    return SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.MINOR;
  };

  const getRiskConfig = (risk: string) => {
    return RISK_CONFIG[risk as keyof typeof RISK_CONFIG] || RISK_CONFIG.MINIMAL;
  };

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BeakerIcon className="h-6 w-6 text-emerald-500" />
            Drug Interaction Checker
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered drug safety analysis with clinical recommendations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          {/* Medications */}
          <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BeakerIcon className="h-5 w-5 text-emerald-500" />
              Medications
            </h3>

            {/* Demo Sets */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Quick Demo Sets:</p>
              <div className="flex flex-wrap gap-2">
                {DEMO_MEDICATION_SETS.map((demo, index) => (
                  <button
                    key={index}
                    onClick={() => loadDemoSet(demo)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Medication */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={currentMed}
                onChange={(e) => setCurrentMed(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addMedication()}
                placeholder="Enter medication name..."
                className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                onClick={addMedication}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Medication List */}
            <div className="space-y-2">
              {medications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No medications added yet
                </p>
              ) : (
                medications.map((med, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {med}
                    </span>
                    <button
                      onClick={() => removeMedication(index)}
                      className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Allergies */}
          <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShieldExclamationIcon className="h-5 w-5 text-red-500" />
              Drug Allergies
            </h3>

            {/* Add Allergy */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={currentAllergy}
                onChange={(e) => setCurrentAllergy(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                placeholder="e.g., Penicillin, Sulfa..."
                className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
              <button
                onClick={addAllergy}
                className="px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Allergy List */}
            <div className="flex flex-wrap gap-2">
              {allergies.map((allergy, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm"
                >
                  {allergy}
                  <button
                    onClick={() => removeAllergy(index)}
                    className="ml-1 hover:text-red-900"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Patient Info */}
          <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Patient Information (Optional)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  value={patientAge || ''}
                  onChange={(e) => setPatientAge(parseInt(e.target.value) || undefined)}
                  placeholder="Age"
                  min={0}
                  max={120}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50"
                />
              </div>
            </div>
          </div>

          {/* Check Button */}
          <button
            onClick={checkInteractions}
            disabled={loading || medications.length < 1}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Checking Interactions...
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="h-5 w-5" />
                Check Interactions
              </>
            )}
          </button>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {loading && (
            <div className="rounded-xl p-12 backdrop-blur-xl bg-white/70 border border-white/50 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-200" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin" />
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Analyzing drug interactions...
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Checking databases and clinical guidelines
              </p>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Risk Summary */}
              <div
                className={clsx(
                  'rounded-xl p-4 border-2',
                  result.summary.overallRisk === 'CRITICAL' || result.summary.overallRisk === 'HIGH'
                    ? 'bg-red-50 border-red-500'
                    : result.summary.overallRisk === 'MODERATE'
                    ? 'bg-orange-50 border-orange-500'
                    : result.summary.overallRisk === 'LOW'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-green-50 border-green-500'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {result.summary.overallRisk === 'CRITICAL' ||
                    result.summary.overallRisk === 'HIGH' ? (
                      <ExclamationCircleIcon className="h-8 w-8 text-red-500" />
                    ) : result.summary.overallRisk === 'MODERATE' ? (
                      <ExclamationTriangleIcon className="h-8 w-8 text-orange-500" />
                    ) : (
                      <CheckCircleIcon className="h-8 w-8 text-green-500" />
                    )}
                    <div>
                      <h3
                        className={clsx(
                          'font-bold text-lg',
                          result.summary.overallRisk === 'CRITICAL' ||
                            result.summary.overallRisk === 'HIGH'
                            ? 'text-red-700'
                            : result.summary.overallRisk === 'MODERATE'
                            ? 'text-orange-700'
                            : 'text-green-700'
                        )}
                      >
                        {getRiskConfig(result.summary.overallRisk).label}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {result.summary.totalInteractions} interaction(s) found
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex gap-2">
                      {result.summary.criticalCount > 0 && (
                        <span className="px-2 py-1 rounded bg-red-200 text-red-800 text-xs font-medium">
                          {result.summary.criticalCount} Critical
                        </span>
                      )}
                      {result.summary.severeCount > 0 && (
                        <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium">
                          {result.summary.severeCount} Severe
                        </span>
                      )}
                      {result.summary.moderateCount > 0 && (
                        <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-medium">
                          {result.summary.moderateCount} Moderate
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Allergy Alerts */}
              {result.allergyAlerts.length > 0 && (
                <div className="rounded-xl p-4 backdrop-blur-xl bg-red-50 border-2 border-red-500">
                  <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <ShieldExclamationIcon className="h-5 w-5" />
                    Allergy Alerts
                  </h3>
                  <div className="space-y-2">
                    {result.allergyAlerts.map((alert, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg bg-white/70 border border-red-300"
                      >
                        <p className="font-medium text-red-700">{alert.message}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {alert.action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drug-Drug Interactions */}
              {result.interactions.length > 0 && (
                <div className="rounded-xl backdrop-blur-xl bg-white/70 border border-white/50 overflow-hidden">
                  <button
                    onClick={() => setShowInteractions(!showInteractions)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
                      Drug-Drug Interactions ({result.interactions.length})
                    </h3>
                    {showInteractions ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {showInteractions && (
                    <div className="px-4 pb-4 space-y-3">
                      {result.interactions.map((interaction, index) => {
                        const config = getSeverityConfig(interaction.severity);
                        const isExpanded = expandedInteraction === index;

                        return (
                          <div
                            key={index}
                            className={clsx(
                              'rounded-lg border-l-4 overflow-hidden transition-all',
                              config.borderColor,
                              config.bgColor
                            )}
                          >
                            <button
                              onClick={() => setExpandedInteraction(isExpanded ? null : index)}
                              className="w-full p-4 text-left"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <config.icon className={clsx('h-5 w-5 mt-0.5', config.textColor)} />
                                  <div>
                                    <p className={clsx('font-semibold', config.textColor)}>
                                      {interaction.drug1} + {interaction.drug2}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {interaction.effect}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={clsx(
                                      'px-2 py-1 rounded text-xs font-semibold uppercase',
                                      config.bgColor,
                                      config.textColor
                                    )}
                                  >
                                    {interaction.severity}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 pt-0 border-t border-gray-200 mt-2">
                                <div className="grid grid-cols-1 gap-3 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Mechanism:
                                    </span>
                                    <p className="text-gray-600">
                                      {interaction.mechanism}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Management:
                                    </span>
                                    <p className="text-gray-600">
                                      {interaction.management}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Evidence:
                                    </span>
                                    <span className="ml-2 text-gray-600">
                                      {interaction.clinicalEvidence}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Food Interactions */}
              {result.foodInteractions.length > 0 && (
                <div className="rounded-xl backdrop-blur-xl bg-white/70 border border-white/50 overflow-hidden">
                  <button
                    onClick={() => setShowFoodInteractions(!showFoodInteractions)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                      Food Interactions ({result.foodInteractions.length})
                    </h3>
                    {showFoodInteractions ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {showFoodInteractions && (
                    <div className="px-4 pb-4 space-y-2">
                      {result.foodInteractions.map((food, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-blue-50 border border-blue-200"
                        >
                          <p className="font-medium text-blue-700">
                            {food.drug}: {food.foodType}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {food.effect}
                          </p>
                          <p className="text-sm text-blue-600 mt-1">
                            {food.management}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="rounded-xl backdrop-blur-xl bg-white/70 border border-white/50 overflow-hidden">
                  <button
                    onClick={() => setShowRecommendations(!showRecommendations)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-purple-500" />
                      Recommendations ({result.recommendations.length})
                    </h3>
                    {showRecommendations ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {showRecommendations && (
                    <div className="px-4 pb-4 space-y-2">
                      {result.recommendations.map((rec, index) => (
                        <div
                          key={index}
                          className={clsx(
                            'p-3 rounded-lg border-l-4',
                            rec.priority === 'CRITICAL'
                              ? 'bg-red-50 border-red-500'
                              : rec.priority === 'HIGH'
                              ? 'bg-orange-50 border-orange-500'
                              : 'bg-blue-50 border-blue-500'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded text-xs font-medium',
                                rec.priority === 'CRITICAL'
                                  ? 'bg-red-200 text-red-800'
                                  : rec.priority === 'HIGH'
                                  ? 'bg-orange-200 text-orange-800'
                                  : 'bg-blue-200 text-blue-800'
                              )}
                            >
                              {rec.priority}
                            </span>
                            <span className="text-xs text-gray-500">
                              {rec.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="font-medium text-gray-700 mt-2">
                            {rec.message}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {rec.action}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No Interactions Found */}
              {result.interactions.length === 0 &&
                result.allergyAlerts.length === 0 &&
                result.conditionContraindications.length === 0 && (
                  <div className="rounded-xl p-8 backdrop-blur-xl bg-green-50 border border-green-200 text-center">
                    <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-700">
                      No Significant Interactions Found
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      The medications appear safe to use together. Always verify with clinical
                      judgment.
                    </p>
                  </div>
                )}

              {/* Model Version */}
              <div className="text-center">
                <p className="text-xs text-gray-400">
                  Model Version: {result.modelVersion} | Drug interaction database
                </p>
              </div>
            </>
          )}

          {!result && !loading && (
            <div className="rounded-xl p-12 backdrop-blur-xl bg-white/70 border border-white/50 flex flex-col items-center justify-center">
              <BeakerIcon className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600">
                Ready to Check
              </h3>
              <p className="text-sm text-gray-500 mt-1 text-center max-w-md">
                Add medications to check for drug-drug interactions, food interactions, and safety
                alerts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
