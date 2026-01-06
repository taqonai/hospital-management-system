import { useState, useMemo } from 'react';
import {
  BeakerIcon,
  ArrowPathIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface TDMDrug {
  name: string;
  genericName: string;
  therapeuticRange: { min: number; max: number };
  toxicLevel: number;
  unit: string;
  halfLife: string;
  monitoringFrequency: string;
  sampleTiming: string;
}

interface TDMResult {
  status: 'subtherapeutic' | 'therapeutic' | 'supratherapeutic' | 'toxic';
  interpretation: string;
  recommendations: string[];
  nextMonitoring: string;
  adjustedRange?: { min: number; max: number };
}

const TDM_DRUGS: TDMDrug[] = [
  {
    name: 'Vancomycin',
    genericName: 'vancomycin',
    therapeuticRange: { min: 10, max: 20 },
    toxicLevel: 25,
    unit: 'mcg/mL',
    halfLife: '4-6 hours',
    monitoringFrequency: 'Every 3-5 doses until stable, then weekly',
    sampleTiming: 'Trough: 30 min before next dose',
  },
  {
    name: 'Digoxin',
    genericName: 'digoxin',
    therapeuticRange: { min: 0.8, max: 2.0 },
    toxicLevel: 2.5,
    unit: 'ng/mL',
    halfLife: '36-48 hours',
    monitoringFrequency: 'Weekly initially, then monthly when stable',
    sampleTiming: 'At least 6-8 hours post-dose',
  },
  {
    name: 'Lithium',
    genericName: 'lithium carbonate',
    therapeuticRange: { min: 0.6, max: 1.2 },
    toxicLevel: 1.5,
    unit: 'mEq/L',
    halfLife: '18-24 hours',
    monitoringFrequency: 'Weekly for 4 weeks, then every 2-3 months',
    sampleTiming: '12 hours post-dose (trough)',
  },
  {
    name: 'Phenytoin',
    genericName: 'phenytoin',
    therapeuticRange: { min: 10, max: 20 },
    toxicLevel: 25,
    unit: 'mcg/mL',
    halfLife: '22 hours',
    monitoringFrequency: 'Weekly until stable, then every 1-3 months',
    sampleTiming: 'Trough level preferred',
  },
  {
    name: 'Carbamazepine',
    genericName: 'carbamazepine',
    therapeuticRange: { min: 4, max: 12 },
    toxicLevel: 15,
    unit: 'mcg/mL',
    halfLife: '12-17 hours',
    monitoringFrequency: 'Every 2-4 weeks initially, then quarterly',
    sampleTiming: 'Trough level',
  },
  {
    name: 'Valproic Acid',
    genericName: 'valproate',
    therapeuticRange: { min: 50, max: 100 },
    toxicLevel: 120,
    unit: 'mcg/mL',
    halfLife: '9-16 hours',
    monitoringFrequency: 'Weekly for 4 weeks, then monthly',
    sampleTiming: 'Trough level',
  },
  {
    name: 'Theophylline',
    genericName: 'theophylline',
    therapeuticRange: { min: 10, max: 20 },
    toxicLevel: 25,
    unit: 'mcg/mL',
    halfLife: '3-9 hours',
    monitoringFrequency: 'Every 6-12 months when stable',
    sampleTiming: 'Peak: 1-2 hours post-dose; Trough: just before dose',
  },
  {
    name: 'Gentamicin',
    genericName: 'gentamicin',
    therapeuticRange: { min: 5, max: 10 },
    toxicLevel: 12,
    unit: 'mcg/mL',
    halfLife: '2-3 hours',
    monitoringFrequency: 'After 3rd dose, then every 2-3 days',
    sampleTiming: 'Peak: 30 min post-infusion; Trough: 30 min pre-dose',
  },
  {
    name: 'Tobramycin',
    genericName: 'tobramycin',
    therapeuticRange: { min: 5, max: 10 },
    toxicLevel: 12,
    unit: 'mcg/mL',
    halfLife: '2-3 hours',
    monitoringFrequency: 'After 3rd dose, then every 2-3 days',
    sampleTiming: 'Peak: 30 min post-infusion; Trough: 30 min pre-dose',
  },
  {
    name: 'Amikacin',
    genericName: 'amikacin',
    therapeuticRange: { min: 20, max: 30 },
    toxicLevel: 35,
    unit: 'mcg/mL',
    halfLife: '2-3 hours',
    monitoringFrequency: 'After 3rd dose, then every 2-3 days',
    sampleTiming: 'Peak: 30 min post-infusion; Trough: 30 min pre-dose',
  },
];

const getStatusConfig = (status: TDMResult['status']) => {
  switch (status) {
    case 'subtherapeutic':
      return {
        color: 'blue',
        bgClass: 'bg-blue-500/10',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-500/30',
        icon: InformationCircleIcon,
        label: 'Subtherapeutic',
      };
    case 'therapeutic':
      return {
        color: 'emerald',
        bgClass: 'bg-emerald-500/10',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-500/30',
        icon: CheckCircleIcon,
        label: 'Therapeutic',
      };
    case 'supratherapeutic':
      return {
        color: 'amber',
        bgClass: 'bg-amber-500/10',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-500/30',
        icon: ExclamationTriangleIcon,
        label: 'Supratherapeutic',
      };
    case 'toxic':
      return {
        color: 'red',
        bgClass: 'bg-red-500/10',
        textClass: 'text-red-700',
        borderClass: 'border-red-500/30',
        icon: ExclamationTriangleIcon,
        label: 'Toxic',
      };
  }
};

export default function TDMMonitoring() {
  const [selectedDrug, setSelectedDrug] = useState<TDMDrug | null>(null);
  const [patientWeight, setPatientWeight] = useState('');
  const [serumCreatinine, setSerumCreatinine] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [lastDoseTime, setLastDoseTime] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<TDMResult | null>(null);

  const analyzeLevel = async () => {
    if (!selectedDrug) {
      toast.error('Please select a drug');
      return;
    }
    if (!currentLevel) {
      toast.error('Please enter the current drug level');
      return;
    }

    setAnalyzing(true);

    // Simulate API call with therapeutic drug monitoring logic
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const level = parseFloat(currentLevel);
    const { therapeuticRange, toxicLevel } = selectedDrug;

    // Adjust for renal function if creatinine provided
    let adjustedRange = { ...therapeuticRange };
    const creatinine = parseFloat(serumCreatinine);
    if (creatinine && creatinine > 1.2) {
      // Reduce target range for impaired renal function
      const reduction = Math.min(0.3, (creatinine - 1.2) * 0.1);
      adjustedRange = {
        min: therapeuticRange.min * (1 - reduction),
        max: therapeuticRange.max * (1 - reduction),
      };
    }

    let status: TDMResult['status'];
    let interpretation: string;
    let recommendations: string[] = [];
    let nextMonitoring: string;

    if (level >= toxicLevel) {
      status = 'toxic';
      interpretation = `Level of ${level} ${selectedDrug.unit} is in the TOXIC range (>${toxicLevel} ${selectedDrug.unit}). Immediate intervention required.`;
      recommendations = [
        'Hold next dose immediately',
        'Monitor for signs of toxicity',
        'Consider antidote if available',
        'Repeat level in 4-6 hours',
        'Assess organ function (renal, hepatic)',
      ];
      nextMonitoring = '4-6 hours';
    } else if (level > adjustedRange.max) {
      status = 'supratherapeutic';
      interpretation = `Level of ${level} ${selectedDrug.unit} is above therapeutic range (${adjustedRange.min}-${adjustedRange.max} ${selectedDrug.unit}).`;
      recommendations = [
        'Consider holding 1-2 doses',
        'Reduce maintenance dose by 20-25%',
        'Recheck level after dose adjustment',
        'Monitor for early toxicity signs',
      ];
      nextMonitoring = '24-48 hours after dose adjustment';
    } else if (level >= adjustedRange.min) {
      status = 'therapeutic';
      interpretation = `Level of ${level} ${selectedDrug.unit} is within therapeutic range (${adjustedRange.min}-${adjustedRange.max} ${selectedDrug.unit}). Optimal therapy achieved.`;
      recommendations = [
        'Continue current dosing regimen',
        'Monitor for clinical response',
        'Routine monitoring per protocol',
      ];
      nextMonitoring = selectedDrug.monitoringFrequency;
    } else {
      status = 'subtherapeutic';
      interpretation = `Level of ${level} ${selectedDrug.unit} is below therapeutic range (${adjustedRange.min}-${adjustedRange.max} ${selectedDrug.unit}). May not achieve therapeutic effect.`;
      recommendations = [
        'Consider increasing dose by 20-25%',
        'Assess patient adherence',
        'Review drug interactions',
        'Recheck level after dose increase',
      ];
      nextMonitoring = '48-72 hours after dose adjustment';
    }

    // Add renal-specific recommendations
    if (creatinine && creatinine > 1.5) {
      recommendations.push('Extended dosing intervals recommended due to renal impairment');
      recommendations.push('Consider nephrotoxicity risk assessment');
    }

    setResult({
      status,
      interpretation,
      recommendations,
      nextMonitoring,
      adjustedRange: creatinine && creatinine > 1.2 ? adjustedRange : undefined,
    });

    setAnalyzing(false);
    toast.success('Analysis complete');
  };

  const levelPercentage = useMemo(() => {
    if (!selectedDrug || !currentLevel) return 0;
    const level = parseFloat(currentLevel);
    const maxDisplay = selectedDrug.toxicLevel * 1.2;
    return Math.min(100, (level / maxDisplay) * 100);
  }, [selectedDrug, currentLevel]);

  const getBarColor = () => {
    if (!result) return 'bg-gray-300';
    switch (result.status) {
      case 'subtherapeutic': return 'bg-blue-500';
      case 'therapeutic': return 'bg-emerald-500';
      case 'supratherapeutic': return 'bg-amber-500';
      case 'toxic': return 'bg-red-500';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-indigo-500/10">
            <BeakerIcon className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900">TDM Monitoring</h3>
            <p className="text-sm text-gray-500">Therapeutic Drug Monitoring Analysis</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Drug Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Drug *
            </label>
            <select
              value={selectedDrug?.name || ''}
              onChange={(e) => {
                const drug = TDM_DRUGS.find((d) => d.name === e.target.value);
                setSelectedDrug(drug || null);
                setResult(null);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-gray-900"
            >
              <option value="">Select a TDM drug...</option>
              {TDM_DRUGS.map((drug) => (
                <option key={drug.name} value={drug.name}>
                  {drug.name} ({drug.genericName})
                </option>
              ))}
            </select>
          </div>

          {/* Drug Info Card */}
          {selectedDrug && (
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 animate-fade-in-up">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-indigo-600 font-medium">Therapeutic Range:</span>
                  <p className="text-gray-700">
                    {selectedDrug.therapeuticRange.min}-{selectedDrug.therapeuticRange.max} {selectedDrug.unit}
                  </p>
                </div>
                <div>
                  <span className="text-indigo-600 font-medium">Toxic Level:</span>
                  <p className="text-gray-700">
                    &gt;{selectedDrug.toxicLevel} {selectedDrug.unit}
                  </p>
                </div>
                <div>
                  <span className="text-indigo-600 font-medium">Half-life:</span>
                  <p className="text-gray-700">{selectedDrug.halfLife}</p>
                </div>
                <div>
                  <span className="text-indigo-600 font-medium">Sample Timing:</span>
                  <p className="text-gray-700">{selectedDrug.sampleTiming}</p>
                </div>
              </div>
            </div>
          )}

          {/* Patient Parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Weight (kg)
              </label>
              <input
                type="number"
                placeholder="e.g., 70"
                value={patientWeight}
                onChange={(e) => setPatientWeight(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-gray-900 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serum Creatinine (mg/dL)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g., 1.0"
                value={serumCreatinine}
                onChange={(e) => setSerumCreatinine(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Drug Level * {selectedDrug && `(${selectedDrug.unit})`}
              </label>
              <input
                type="number"
                step="0.1"
                placeholder={selectedDrug ? `e.g., ${(selectedDrug.therapeuticRange.min + selectedDrug.therapeuticRange.max) / 2}` : 'Enter level'}
                value={currentLevel}
                onChange={(e) => {
                  setCurrentLevel(e.target.value);
                  setResult(null);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-gray-900 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Dose Time
              </label>
              <input
                type="datetime-local"
                value={lastDoseTime}
                onChange={(e) => setLastDoseTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient Age (years)
            </label>
            <input
              type="number"
              placeholder="e.g., 65"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-gray-900 placeholder-gray-400"
            />
          </div>

          <button
            onClick={analyzeLevel}
            disabled={analyzing || !selectedDrug || !currentLevel}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <ChartBarIcon className="h-5 w-5" />
                Analyze Level
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Panel */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <h3 className="font-semibold text-lg text-gray-900 mb-6">Level Interpretation</h3>

        {!result ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
              <ChartBarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500">
              Select a drug and enter the current level to analyze
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Badge */}
            {(() => {
              const config = getStatusConfig(result.status);
              const StatusIcon = config.icon;
              return (
                <div className={clsx('p-4 rounded-xl border-2', config.bgClass, config.borderClass)}>
                  <div className="flex items-center gap-3">
                    <StatusIcon className={clsx('h-8 w-8', config.textClass)} />
                    <div>
                      <span className={clsx('text-lg font-bold', config.textClass)}>
                        {config.label}
                      </span>
                      {result.adjustedRange && (
                        <p className="text-sm text-gray-500 mt-1">
                          Adjusted range for renal function: {result.adjustedRange.min.toFixed(1)}-{result.adjustedRange.max.toFixed(1)} {selectedDrug?.unit}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Level Visualization */}
            {selectedDrug && currentLevel && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>0</span>
                  <span className="text-emerald-600 font-medium">
                    Therapeutic: {selectedDrug.therapeuticRange.min}-{selectedDrug.therapeuticRange.max}
                  </span>
                  <span className="text-red-600 font-medium">
                    Toxic: &gt;{selectedDrug.toxicLevel}
                  </span>
                </div>

                <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                  {/* Therapeutic zone indicator */}
                  <div
                    className="absolute h-full bg-emerald-200 opacity-50"
                    style={{
                      left: `${(selectedDrug.therapeuticRange.min / (selectedDrug.toxicLevel * 1.2)) * 100}%`,
                      width: `${((selectedDrug.therapeuticRange.max - selectedDrug.therapeuticRange.min) / (selectedDrug.toxicLevel * 1.2)) * 100}%`,
                    }}
                  />
                  {/* Toxic zone indicator */}
                  <div
                    className="absolute h-full bg-red-200 opacity-50"
                    style={{
                      left: `${(selectedDrug.toxicLevel / (selectedDrug.toxicLevel * 1.2)) * 100}%`,
                      right: 0,
                    }}
                  />
                  {/* Current level bar */}
                  <div
                    className={clsx('h-full rounded-full transition-all duration-500', getBarColor())}
                    style={{ width: `${levelPercentage}%` }}
                  />
                </div>

                <div className="mt-2 text-center">
                  <span className="text-xl font-bold text-gray-900">
                    {currentLevel} {selectedDrug.unit}
                  </span>
                </div>
              </div>
            )}

            {/* Interpretation */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-gray-700">{result.interpretation}</p>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Recommendations</h4>
              <ul className="space-y-2">
                {result.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Monitoring */}
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-indigo-600" />
                <span className="font-medium text-indigo-700">Next Monitoring:</span>
              </div>
              <p className="text-indigo-600 mt-1">{result.nextMonitoring}</p>
            </div>

            {/* Monitoring Schedule Info */}
            {selectedDrug && (
              <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p><strong>Standard monitoring:</strong> {selectedDrug.monitoringFrequency}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
