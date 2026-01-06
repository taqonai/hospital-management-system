import { useState, useMemo } from 'react';
import {
  CurrencyDollarIcon,
  ArrowPathIcon,
  SparklesIcon,
  CheckBadgeIcon,
  BeakerIcon,
  ArrowsRightLeftIcon,
  ShieldCheckIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface DrugAlternative {
  name: string;
  genericName: string;
  manufacturer: string;
  costTier: 1 | 2 | 3 | 4; // $ to $$$$
  isGeneric: boolean;
  therapeuticEquivalence: 'A' | 'AB' | 'B' | 'C'; // FDA equivalence rating
  formularyStatus: 'preferred' | 'covered' | 'non-preferred' | 'not-covered';
  avgCostPerUnit: number;
  dosageForm: string;
  strength: string;
  notes?: string;
  savings?: number; // percentage savings vs original
}

interface DrugSearchResult {
  originalDrug: string;
  originalCost: number;
  alternatives: DrugAlternative[];
}

const DRUG_DATABASE: Record<string, DrugSearchResult> = {
  lipitor: {
    originalDrug: 'Lipitor (atorvastatin)',
    originalCost: 350,
    alternatives: [
      {
        name: 'Atorvastatin (Generic)',
        genericName: 'atorvastatin',
        manufacturer: 'Various',
        costTier: 1,
        isGeneric: true,
        therapeuticEquivalence: 'AB',
        formularyStatus: 'preferred',
        avgCostPerUnit: 0.15,
        dosageForm: 'Tablet',
        strength: '10mg, 20mg, 40mg, 80mg',
        savings: 95,
      },
      {
        name: 'Simvastatin (Generic)',
        genericName: 'simvastatin',
        manufacturer: 'Various',
        costTier: 1,
        isGeneric: true,
        therapeuticEquivalence: 'B',
        formularyStatus: 'preferred',
        avgCostPerUnit: 0.10,
        dosageForm: 'Tablet',
        strength: '5mg, 10mg, 20mg, 40mg',
        notes: 'Different statin, similar efficacy for most patients',
        savings: 97,
      },
      {
        name: 'Pravastatin (Generic)',
        genericName: 'pravastatin',
        manufacturer: 'Various',
        costTier: 1,
        isGeneric: true,
        therapeuticEquivalence: 'B',
        formularyStatus: 'covered',
        avgCostPerUnit: 0.20,
        dosageForm: 'Tablet',
        strength: '10mg, 20mg, 40mg, 80mg',
        notes: 'Fewer drug interactions',
        savings: 94,
      },
      {
        name: 'Rosuvastatin (Crestor)',
        genericName: 'rosuvastatin',
        manufacturer: 'AstraZeneca',
        costTier: 3,
        isGeneric: false,
        therapeuticEquivalence: 'B',
        formularyStatus: 'non-preferred',
        avgCostPerUnit: 8.50,
        dosageForm: 'Tablet',
        strength: '5mg, 10mg, 20mg, 40mg',
        notes: 'More potent, may be needed for high-risk patients',
        savings: 25,
      },
    ],
  },
  nexium: {
    originalDrug: 'Nexium (esomeprazole)',
    originalCost: 280,
    alternatives: [
      {
        name: 'Esomeprazole (Generic)',
        genericName: 'esomeprazole',
        manufacturer: 'Various',
        costTier: 1,
        isGeneric: true,
        therapeuticEquivalence: 'AB',
        formularyStatus: 'preferred',
        avgCostPerUnit: 0.25,
        dosageForm: 'Capsule',
        strength: '20mg, 40mg',
        savings: 92,
      },
      {
        name: 'Omeprazole (Generic)',
        genericName: 'omeprazole',
        manufacturer: 'Various',
        costTier: 1,
        isGeneric: true,
        therapeuticEquivalence: 'B',
        formularyStatus: 'preferred',
        avgCostPerUnit: 0.08,
        dosageForm: 'Capsule',
        strength: '10mg, 20mg, 40mg',
        notes: 'OTC available, clinically equivalent for most uses',
        savings: 97,
      },
      {
        name: 'Pantoprazole (Generic)',
        genericName: 'pantoprazole',
        manufacturer: 'Various',
        costTier: 1,
        isGeneric: true,
        therapeuticEquivalence: 'B',
        formularyStatus: 'preferred',
        avgCostPerUnit: 0.12,
        dosageForm: 'Tablet',
        strength: '20mg, 40mg',
        savings: 96,
      },
    ],
  },
  advair: {
    originalDrug: 'Advair Diskus (fluticasone/salmeterol)',
    originalCost: 450,
    alternatives: [
      {
        name: 'Wixela Inhub',
        genericName: 'fluticasone/salmeterol',
        manufacturer: 'Mylan',
        costTier: 2,
        isGeneric: true,
        therapeuticEquivalence: 'AB',
        formularyStatus: 'preferred',
        avgCostPerUnit: 3.50,
        dosageForm: 'Inhalation Powder',
        strength: '100/50, 250/50, 500/50 mcg',
        savings: 65,
      },
      {
        name: 'AirDuo RespiClick',
        genericName: 'fluticasone/salmeterol',
        manufacturer: 'Teva',
        costTier: 2,
        isGeneric: true,
        therapeuticEquivalence: 'AB',
        formularyStatus: 'covered',
        avgCostPerUnit: 4.00,
        dosageForm: 'Inhalation Powder',
        strength: '55/14, 113/14, 232/14 mcg',
        savings: 60,
      },
      {
        name: 'Symbicort',
        genericName: 'budesonide/formoterol',
        manufacturer: 'AstraZeneca',
        costTier: 3,
        isGeneric: false,
        therapeuticEquivalence: 'B',
        formularyStatus: 'covered',
        avgCostPerUnit: 12.00,
        dosageForm: 'Inhalation Aerosol',
        strength: '80/4.5, 160/4.5 mcg',
        notes: 'Different ICS/LABA combination, similar efficacy',
        savings: 20,
      },
    ],
  },
  eliquis: {
    originalDrug: 'Eliquis (apixaban)',
    originalCost: 550,
    alternatives: [
      {
        name: 'Xarelto',
        genericName: 'rivaroxaban',
        manufacturer: 'Janssen',
        costTier: 4,
        isGeneric: false,
        therapeuticEquivalence: 'B',
        formularyStatus: 'covered',
        avgCostPerUnit: 17.50,
        dosageForm: 'Tablet',
        strength: '10mg, 15mg, 20mg',
        notes: 'Once daily dosing, different DOAC',
        savings: 5,
      },
      {
        name: 'Warfarin (Generic)',
        genericName: 'warfarin',
        manufacturer: 'Various',
        costTier: 1,
        isGeneric: true,
        therapeuticEquivalence: 'B',
        formularyStatus: 'preferred',
        avgCostPerUnit: 0.05,
        dosageForm: 'Tablet',
        strength: '1mg, 2mg, 2.5mg, 3mg, 4mg, 5mg, 6mg, 7.5mg, 10mg',
        notes: 'Requires INR monitoring, more drug/food interactions',
        savings: 98,
      },
    ],
  },
  humira: {
    originalDrug: 'Humira (adalimumab)',
    originalCost: 6500,
    alternatives: [
      {
        name: 'Hadlima',
        genericName: 'adalimumab-bwwd',
        manufacturer: 'Samsung Bioepis',
        costTier: 3,
        isGeneric: false,
        therapeuticEquivalence: 'AB',
        formularyStatus: 'preferred',
        avgCostPerUnit: 4200,
        dosageForm: 'Injection',
        strength: '40mg/0.8mL',
        notes: 'FDA-approved biosimilar',
        savings: 35,
      },
      {
        name: 'Hyrimoz',
        genericName: 'adalimumab-adaz',
        manufacturer: 'Sandoz',
        costTier: 3,
        isGeneric: false,
        therapeuticEquivalence: 'AB',
        formularyStatus: 'covered',
        avgCostPerUnit: 4100,
        dosageForm: 'Injection',
        strength: '40mg/0.8mL',
        notes: 'FDA-approved biosimilar',
        savings: 37,
      },
      {
        name: 'Cyltezo',
        genericName: 'adalimumab-adbm',
        manufacturer: 'Boehringer',
        costTier: 3,
        isGeneric: false,
        therapeuticEquivalence: 'AB',
        formularyStatus: 'covered',
        avgCostPerUnit: 4000,
        dosageForm: 'Injection',
        strength: '40mg/0.8mL',
        notes: 'Interchangeable biosimilar',
        savings: 38,
      },
    ],
  },
};

const COMMON_DRUGS = [
  'Lipitor', 'Nexium', 'Advair', 'Eliquis', 'Humira',
  'Abilify', 'Crestor', 'Januvia', 'Symbicort', 'Xarelto',
  'Lyrica', 'Spiriva', 'Trulicity', 'Vyvanse', 'Ozempic'
];

const getCostTierDisplay = (tier: number) => {
  return '$'.repeat(tier);
};

const getCostTierColor = (tier: number) => {
  switch (tier) {
    case 1: return 'text-emerald-600 bg-emerald-500/10';
    case 2: return 'text-blue-600 bg-blue-500/10';
    case 3: return 'text-amber-600 bg-amber-500/10';
    case 4: return 'text-red-600 bg-red-500/10';
    default: return 'text-gray-600 bg-gray-500/10';
  }
};

const getFormularyStatusConfig = (status: DrugAlternative['formularyStatus']) => {
  switch (status) {
    case 'preferred':
      return { label: 'Preferred', bgClass: 'bg-emerald-500/10', textClass: 'text-emerald-700', borderClass: 'border-emerald-500/30' };
    case 'covered':
      return { label: 'Covered', bgClass: 'bg-blue-500/10', textClass: 'text-blue-700', borderClass: 'border-blue-500/30' };
    case 'non-preferred':
      return { label: 'Non-Preferred', bgClass: 'bg-amber-500/10', textClass: 'text-amber-700', borderClass: 'border-amber-500/30' };
    case 'not-covered':
      return { label: 'Not Covered', bgClass: 'bg-red-500/10', textClass: 'text-red-700', borderClass: 'border-red-500/30' };
  }
};

const getEquivalenceInfo = (rating: DrugAlternative['therapeuticEquivalence']) => {
  switch (rating) {
    case 'A':
    case 'AB':
      return { label: rating, description: 'Therapeutically equivalent', color: 'text-emerald-600' };
    case 'B':
      return { label: rating, description: 'Therapeutic alternative', color: 'text-blue-600' };
    case 'C':
      return { label: rating, description: 'Not equivalent', color: 'text-amber-600' };
  }
};

export default function CostAlternatives() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<DrugSearchResult | null>(null);
  const [selectedAlternative, setSelectedAlternative] = useState<DrugAlternative | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    return COMMON_DRUGS.filter((drug) =>
      drug.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [searchTerm]);

  const handleSearch = async (drugName?: string) => {
    const term = drugName || searchTerm;
    if (!term.trim()) {
      toast.error('Please enter a drug name');
      return;
    }

    setSearching(true);
    setShowSuggestions(false);
    setSelectedAlternative(null);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const normalizedTerm = term.toLowerCase().replace(/\s+/g, '');
    const result = DRUG_DATABASE[normalizedTerm];

    if (result) {
      setSearchResult(result);
      toast.success(`Found ${result.alternatives.length} alternatives`);
    } else {
      // Generate mock alternatives for drugs not in database
      setSearchResult({
        originalDrug: term,
        originalCost: Math.floor(Math.random() * 300) + 100,
        alternatives: [
          {
            name: `Generic ${term}`,
            genericName: term.toLowerCase(),
            manufacturer: 'Various',
            costTier: 1,
            isGeneric: true,
            therapeuticEquivalence: 'AB',
            formularyStatus: 'preferred',
            avgCostPerUnit: Math.random() * 2,
            dosageForm: 'Tablet',
            strength: 'Various',
            savings: Math.floor(Math.random() * 40) + 60,
          },
        ],
      });
      toast.success('Showing available alternatives');
    }

    setSearching(false);
  };

  const handleSelectAlternative = (alt: DrugAlternative) => {
    setSelectedAlternative(alt);
    toast.success(`${alt.name} selected for prescription`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Search Panel */}
      <div className="lg:col-span-1 relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10">
            <CurrencyDollarIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900">Cost Alternatives</h3>
            <p className="text-sm text-gray-500">Find affordable drug options</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Drug Name
            </label>
            <input
              type="text"
              placeholder="e.g., Lipitor, Nexium..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all text-gray-900 placeholder-gray-400"
            />

            {/* Autocomplete Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                {filteredSuggestions.map((drug) => (
                  <button
                    key={drug}
                    onClick={() => {
                      setSearchTerm(drug);
                      setShowSuggestions(false);
                      handleSearch(drug);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    {drug}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleSearch()}
            disabled={searching}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {searching ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5" />
                Find Alternatives
              </>
            )}
          </button>

          {/* Quick Search Tags */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Quick search:</p>
            <div className="flex flex-wrap gap-2">
              {['Lipitor', 'Nexium', 'Advair', 'Eliquis'].map((drug) => (
                <button
                  key={drug}
                  onClick={() => {
                    setSearchTerm(drug);
                    handleSearch(drug);
                  }}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                >
                  {drug}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Alternative */}
        {selectedAlternative && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-2">
              <CheckBadgeIcon className="h-5 w-5 text-emerald-600" />
              <span className="font-medium text-emerald-700">Selected for Prescription</span>
            </div>
            <p className="text-sm text-emerald-600">{selectedAlternative.name}</p>
            <p className="text-xs text-emerald-500 mt-1">{selectedAlternative.strength}</p>
          </div>
        )}
      </div>

      {/* Results Panel */}
      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <h3 className="font-semibold text-lg text-gray-900 mb-6">Available Alternatives</h3>

        {!searchResult ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
              <ArrowsRightLeftIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500">
              Search for a drug to see cost-effective alternatives
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Original Drug Info */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-500">Original Drug</span>
                  <p className="font-semibold text-gray-900">{searchResult.originalDrug}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-500">Est. Monthly Cost</span>
                  <p className="font-bold text-red-600">${searchResult.originalCost.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Alternatives List */}
            <div className="space-y-3">
              {searchResult.alternatives.map((alt, idx) => {
                const formularyConfig = getFormularyStatusConfig(alt.formularyStatus);
                const equivalenceInfo = getEquivalenceInfo(alt.therapeuticEquivalence);

                return (
                  <div
                    key={idx}
                    className={clsx(
                      'p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-md animate-fade-in-up',
                      selectedAlternative?.name === alt.name
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    )}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h4 className="font-semibold text-gray-900">{alt.name}</h4>
                          {alt.isGeneric && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-700 rounded-full flex items-center gap-1">
                              <BeakerIcon className="h-3 w-3" />
                              Generic
                            </span>
                          )}
                          <span className={clsx('px-2 py-0.5 text-xs font-bold rounded-full', getCostTierColor(alt.costTier))}>
                            {getCostTierDisplay(alt.costTier)}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-2">
                          {alt.manufacturer} | {alt.dosageForm} | {alt.strength}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {/* Formulary Status */}
                          <span className={clsx('px-2 py-1 text-xs font-medium rounded-lg border', formularyConfig.bgClass, formularyConfig.textClass, formularyConfig.borderClass)}>
                            <TagIcon className="h-3 w-3 inline mr-1" />
                            {formularyConfig.label}
                          </span>

                          {/* Therapeutic Equivalence */}
                          <span className={clsx('px-2 py-1 text-xs font-medium rounded-lg bg-gray-100', equivalenceInfo.color)}>
                            <ShieldCheckIcon className="h-3 w-3 inline mr-1" />
                            {equivalenceInfo.label}: {equivalenceInfo.description}
                          </span>
                        </div>

                        {alt.notes && (
                          <p className="text-xs text-gray-500 italic">{alt.notes}</p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        {alt.savings && (
                          <div className="mb-2">
                            <span className="px-2 py-1 text-xs font-bold bg-emerald-500/10 text-emerald-700 rounded-full">
                              Save {alt.savings}%
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-gray-500">
                          ~${alt.avgCostPerUnit.toFixed(2)}/unit
                        </p>
                        <button
                          onClick={() => handleSelectAlternative(alt)}
                          className={clsx(
                            'mt-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300',
                            selectedAlternative?.name === alt.name
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 hover:bg-emerald-600 text-gray-700 hover:text-white'
                          )}
                        >
                          {selectedAlternative?.name === alt.name ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Cost Tier Guide</h4>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2 py-0.5 font-bold rounded', getCostTierColor(1))}>$</span>
                  <span className="text-gray-600">Lowest Cost</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2 py-0.5 font-bold rounded', getCostTierColor(2))}>$$</span>
                  <span className="text-gray-600">Low Cost</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2 py-0.5 font-bold rounded', getCostTierColor(3))}>$$$</span>
                  <span className="text-gray-600">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2 py-0.5 font-bold rounded', getCostTierColor(4))}>$$$$</span>
                  <span className="text-gray-600">High Cost</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
