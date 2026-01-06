import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlusIcon,
  XMarkIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  ArrowTrendingDownIcon,
  InformationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Medication {
  name: string;
  isAnticholinergic?: boolean;
  anticholinergicScore?: number;
  isBeersListDrug?: boolean;
  beersCategory?: string;
  fallRiskContributor?: boolean;
}

interface PolypharmacyResult {
  overallRiskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very-high';
  anticholinergicBurden: {
    score: number;
    level: 'minimal' | 'moderate' | 'high';
    drugs: string[];
  };
  fallRisk: {
    score: number;
    level: 'low' | 'moderate' | 'high';
    contributors: string[];
  };
  beersViolations: {
    count: number;
    violations: Array<{
      drug: string;
      category: string;
      recommendation: string;
    }>;
  };
  deprescribingRecommendations: Array<{
    drug: string;
    priority: 'high' | 'moderate' | 'low';
    reason: string;
    suggestion: string;
  }>;
}

const MEDICATION_DATABASE: Record<string, Medication> = {
  'diphenhydramine': { name: 'Diphenhydramine (Benadryl)', isAnticholinergic: true, anticholinergicScore: 3, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'oxybutynin': { name: 'Oxybutynin (Ditropan)', isAnticholinergic: true, anticholinergicScore: 3, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'amitriptyline': { name: 'Amitriptyline (Elavil)', isAnticholinergic: true, anticholinergicScore: 3, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'hydroxyzine': { name: 'Hydroxyzine (Vistaril)', isAnticholinergic: true, anticholinergicScore: 3, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'promethazine': { name: 'Promethazine (Phenergan)', isAnticholinergic: true, anticholinergicScore: 3, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'paroxetine': { name: 'Paroxetine (Paxil)', isAnticholinergic: true, anticholinergicScore: 2, isBeersListDrug: true, beersCategory: 'Use with caution', fallRiskContributor: true },
  'olanzapine': { name: 'Olanzapine (Zyprexa)', isAnticholinergic: true, anticholinergicScore: 2, isBeersListDrug: true, beersCategory: 'Use with caution', fallRiskContributor: true },
  'quetiapine': { name: 'Quetiapine (Seroquel)', isAnticholinergic: true, anticholinergicScore: 2, isBeersListDrug: true, beersCategory: 'Use with caution', fallRiskContributor: true },
  'ranitidine': { name: 'Ranitidine (Zantac)', isAnticholinergic: true, anticholinergicScore: 1, fallRiskContributor: false },
  'metoprolol': { name: 'Metoprolol (Lopressor)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: true },
  'lisinopril': { name: 'Lisinopril (Zestril)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: false },
  'metformin': { name: 'Metformin (Glucophage)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: false },
  'amlodipine': { name: 'Amlodipine (Norvasc)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: true },
  'furosemide': { name: 'Furosemide (Lasix)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: true },
  'omeprazole': { name: 'Omeprazole (Prilosec)', isAnticholinergic: false, anticholinergicScore: 0, isBeersListDrug: true, beersCategory: 'Use with caution >8 weeks' },
  'diazepam': { name: 'Diazepam (Valium)', isAnticholinergic: false, anticholinergicScore: 0, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'alprazolam': { name: 'Alprazolam (Xanax)', isAnticholinergic: false, anticholinergicScore: 0, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'zolpidem': { name: 'Zolpidem (Ambien)', isAnticholinergic: false, anticholinergicScore: 0, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'tramadol': { name: 'Tramadol (Ultram)', isAnticholinergic: false, anticholinergicScore: 0, isBeersListDrug: true, beersCategory: 'Avoid', fallRiskContributor: true },
  'gabapentin': { name: 'Gabapentin (Neurontin)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: true },
  'prednisone': { name: 'Prednisone (Deltasone)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: false },
  'aspirin': { name: 'Aspirin', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: false },
  'atorvastatin': { name: 'Atorvastatin (Lipitor)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: false },
  'warfarin': { name: 'Warfarin (Coumadin)', isAnticholinergic: false, anticholinergicScore: 0, fallRiskContributor: true },
};

const COMMON_MEDICATIONS = Object.keys(MEDICATION_DATABASE);

const getRiskLevelConfig = (level: PolypharmacyResult['riskLevel']) => {
  switch (level) {
    case 'low':
      return { color: 'emerald', bgClass: 'bg-emerald-500', textClass: 'text-emerald-700', label: 'Low Risk' };
    case 'moderate':
      return { color: 'amber', bgClass: 'bg-amber-500', textClass: 'text-amber-700', label: 'Moderate Risk' };
    case 'high':
      return { color: 'orange', bgClass: 'bg-orange-500', textClass: 'text-orange-700', label: 'High Risk' };
    case 'very-high':
      return { color: 'red', bgClass: 'bg-red-500', textClass: 'text-red-700', label: 'Very High Risk' };
  }
};

export default function PolypharmacyRisk() {
  const [medications, setMedications] = useState<string[]>(['', '']);
  const [patientAge, setPatientAge] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PolypharmacyResult | null>(null);

  const handleAddMedication = () => {
    setMedications([...medications, '']);
  };

  const handleRemoveMedication = (index: number) => {
    if (medications.length > 2) {
      setMedications(medications.filter((_, i) => i !== index));
    }
  };

  const handleMedicationChange = (index: number, value: string) => {
    const updated = [...medications];
    updated[index] = value;
    setMedications(updated);
    setResult(null);
  };

  const analyzeRisk = async () => {
    const validMeds = medications.filter((m) => m.trim());
    if (validMeds.length < 2) {
      toast.error('Please enter at least 2 medications');
      return;
    }

    setAnalyzing(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const age = parseInt(patientAge) || 65;
    const medData = validMeds.map((med) => {
      const normalized = med.toLowerCase().trim();
      return MEDICATION_DATABASE[normalized] || {
        name: med,
        isAnticholinergic: false,
        anticholinergicScore: 0,
        fallRiskContributor: false,
      };
    });

    // Calculate anticholinergic burden
    const anticholinergicDrugs = medData.filter((m) => m.isAnticholinergic);
    const acbScore = medData.reduce((sum, m) => sum + (m.anticholinergicScore || 0), 0);
    const acbLevel = acbScore >= 6 ? 'high' : acbScore >= 3 ? 'moderate' : 'minimal';

    // Calculate fall risk
    const fallRiskDrugs = medData.filter((m) => m.fallRiskContributor);
    const fallRiskScore = Math.min(100, fallRiskDrugs.length * 15 + (age >= 75 ? 20 : age >= 65 ? 10 : 0));
    const fallRiskLevel = fallRiskScore >= 60 ? 'high' : fallRiskScore >= 30 ? 'moderate' : 'low';

    // Check Beers criteria violations
    const beersViolations = medData
      .filter((m) => m.isBeersListDrug)
      .map((m) => ({
        drug: m.name,
        category: m.beersCategory || 'Listed',
        recommendation: m.beersCategory === 'Avoid'
          ? 'Consider discontinuation or alternative therapy'
          : 'Use with caution, reassess need periodically',
      }));

    // Calculate overall risk score
    const polypharmacyScore = Math.min(40, validMeds.length * 5);
    const ageScore = age >= 80 ? 25 : age >= 70 ? 15 : age >= 65 ? 10 : 0;
    const acbRiskScore = acbScore * 5;
    const beersScore = beersViolations.length * 10;
    const overallScore = Math.min(100, polypharmacyScore + ageScore + acbRiskScore + beersScore);

    const riskLevel: PolypharmacyResult['riskLevel'] =
      overallScore >= 75 ? 'very-high' :
      overallScore >= 50 ? 'high' :
      overallScore >= 25 ? 'moderate' : 'low';

    // Generate deprescribing recommendations
    const deprescribingRecs = [];

    for (const med of medData) {
      if (med.isBeersListDrug && med.beersCategory === 'Avoid') {
        deprescribingRecs.push({
          drug: med.name,
          priority: 'high' as const,
          reason: 'Listed on Beers Criteria as "Avoid"',
          suggestion: 'Consider discontinuation with taper if needed',
        });
      } else if (med.anticholinergicScore && med.anticholinergicScore >= 3) {
        deprescribingRecs.push({
          drug: med.name,
          priority: 'high' as const,
          reason: 'High anticholinergic burden',
          suggestion: 'Consider alternative with lower anticholinergic activity',
        });
      } else if (med.fallRiskContributor && age >= 65) {
        deprescribingRecs.push({
          drug: med.name,
          priority: 'moderate' as const,
          reason: 'Contributes to fall risk in elderly',
          suggestion: 'Reassess necessity, consider dose reduction',
        });
      }
    }

    if (validMeds.length >= 10) {
      deprescribingRecs.push({
        drug: 'General',
        priority: 'high' as const,
        reason: `Patient on ${validMeds.length} medications (polypharmacy)`,
        suggestion: 'Comprehensive medication review recommended',
      });
    }

    setResult({
      overallRiskScore: overallScore,
      riskLevel,
      anticholinergicBurden: {
        score: acbScore,
        level: acbLevel,
        drugs: anticholinergicDrugs.map((d) => d.name),
      },
      fallRisk: {
        score: fallRiskScore,
        level: fallRiskLevel,
        contributors: fallRiskDrugs.map((d) => d.name),
      },
      beersViolations: {
        count: beersViolations.length,
        violations: beersViolations,
      },
      deprescribingRecommendations: deprescribingRecs,
    });

    setAnalyzing(false);
    toast.success('Analysis complete');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-orange-500/10">
            <ShieldExclamationIcon className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900">Polypharmacy Risk Assessment</h3>
            <p className="text-sm text-gray-500">Evaluate medication burden and safety</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient Age (years)
            </label>
            <input
              type="number"
              placeholder="e.g., 72"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Medications
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {medications.map((med, index) => (
                <div key={index} className="flex gap-2 animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                  <input
                    type="text"
                    list={`med-suggestions-${index}`}
                    placeholder={`Medication ${index + 1}`}
                    value={med}
                    onChange={(e) => handleMedicationChange(index, e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all text-gray-900 placeholder-gray-400"
                  />
                  <datalist id={`med-suggestions-${index}`}>
                    {COMMON_MEDICATIONS.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  {medications.length > 2 && (
                    <button
                      onClick={() => handleRemoveMedication(index)}
                      className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleAddMedication}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 font-medium transition-all duration-300 flex items-center justify-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Add Medication
          </button>

          <button
            onClick={analyzeRisk}
            disabled={analyzing}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <ChartBarIcon className="h-5 w-5" />
                Assess Risk
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Panel */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <h3 className="font-semibold text-lg text-gray-900 mb-6">Risk Assessment Results</h3>

        {!result ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
              <ShieldExclamationIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500">
              Enter patient medications to assess polypharmacy risk
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
            {/* Overall Risk Gauge */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Overall Risk Score</span>
                <span className={clsx('px-3 py-1 text-sm font-bold rounded-full', getRiskLevelConfig(result.riskLevel).bgClass, 'text-white')}>
                  {getRiskLevelConfig(result.riskLevel).label}
                </span>
              </div>

              {/* Gauge visualization */}
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all duration-1000', getRiskLevelConfig(result.riskLevel).bgClass)}
                  style={{ width: `${result.overallRiskScore}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span className="font-bold text-lg text-gray-900">{result.overallRiskScore}</span>
                <span>100</span>
              </div>
            </div>

            {/* Anticholinergic Burden */}
            <div className={clsx('p-4 rounded-xl border', result.anticholinergicBurden.level === 'high' ? 'bg-red-500/10 border-red-500/30' : result.anticholinergicBurden.level === 'moderate' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30')}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Anticholinergic Burden (ACB)</span>
                <span className={clsx('text-2xl font-bold', result.anticholinergicBurden.level === 'high' ? 'text-red-600' : result.anticholinergicBurden.level === 'moderate' ? 'text-amber-600' : 'text-emerald-600')}>
                  {result.anticholinergicBurden.score}
                </span>
              </div>
              <p className={clsx('text-sm', result.anticholinergicBurden.level === 'high' ? 'text-red-600' : result.anticholinergicBurden.level === 'moderate' ? 'text-amber-600' : 'text-emerald-600')}>
                {result.anticholinergicBurden.level === 'high' && 'High burden - increased risk of cognitive impairment'}
                {result.anticholinergicBurden.level === 'moderate' && 'Moderate burden - monitor for anticholinergic effects'}
                {result.anticholinergicBurden.level === 'minimal' && 'Minimal burden'}
              </p>
              {result.anticholinergicBurden.drugs.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  Contributing: {result.anticholinergicBurden.drugs.join(', ')}
                </div>
              )}
            </div>

            {/* Fall Risk */}
            <div className={clsx('p-4 rounded-xl border', result.fallRisk.level === 'high' ? 'bg-red-500/10 border-red-500/30' : result.fallRisk.level === 'moderate' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30')}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Fall Risk Assessment</span>
                <span className={clsx('text-2xl font-bold', result.fallRisk.level === 'high' ? 'text-red-600' : result.fallRisk.level === 'moderate' ? 'text-amber-600' : 'text-emerald-600')}>
                  {result.fallRisk.score}%
                </span>
              </div>
              <p className={clsx('text-sm', result.fallRisk.level === 'high' ? 'text-red-600' : result.fallRisk.level === 'moderate' ? 'text-amber-600' : 'text-emerald-600')}>
                {result.fallRisk.level === 'high' && 'High fall risk - implement fall precautions'}
                {result.fallRisk.level === 'moderate' && 'Moderate fall risk - review contributing medications'}
                {result.fallRisk.level === 'low' && 'Low fall risk'}
              </p>
              {result.fallRisk.contributors.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  Contributors: {result.fallRisk.contributors.slice(0, 5).join(', ')}
                  {result.fallRisk.contributors.length > 5 && ` +${result.fallRisk.contributors.length - 5} more`}
                </div>
              )}
            </div>

            {/* Beers Criteria Violations */}
            {result.beersViolations.count > 0 && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-700">
                    Beers Criteria Violations ({result.beersViolations.count})
                  </span>
                </div>
                <div className="space-y-2">
                  {result.beersViolations.violations.map((violation, idx) => (
                    <div key={idx} className="p-2 bg-white/50 rounded-lg text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{violation.drug}</span>
                        <span className={clsx('px-2 py-0.5 text-xs rounded-full', violation.category === 'Avoid' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white')}>
                          {violation.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{violation.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.beersViolations.count === 0 && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                  <span className="text-emerald-700">No Beers Criteria violations detected</span>
                </div>
              </div>
            )}

            {/* Deprescribing Recommendations */}
            {result.deprescribingRecommendations.length > 0 && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowTrendingDownIcon className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-700">Deprescribing Recommendations</span>
                </div>
                <div className="space-y-3">
                  {result.deprescribingRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className={clsx('p-3 rounded-lg border', rec.priority === 'high' ? 'bg-red-50 border-red-200' : rec.priority === 'moderate' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200')}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{rec.drug}</span>
                        <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', rec.priority === 'high' ? 'bg-red-500 text-white' : rec.priority === 'moderate' ? 'bg-amber-500 text-white' : 'bg-gray-500 text-white')}>
                          {rec.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{rec.reason}</p>
                      <p className="text-xs text-purple-700 font-medium">{rec.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Note */}
            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-2">
              <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                This assessment is based on Beers Criteria 2023 and anticholinergic burden scale.
                Always consult with a clinical pharmacist before making medication changes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
