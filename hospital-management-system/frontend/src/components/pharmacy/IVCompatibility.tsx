import { useState, useMemo } from 'react';
import {
  BeakerIcon,
  ArrowPathIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface IVMedication {
  id: string;
  name: string;
}

type CompatibilityStatus = 'compatible' | 'incompatible' | 'unknown' | 'conditional';

interface CompatibilityResult {
  drug1: string;
  drug2: string;
  status: CompatibilityStatus;
  notes?: string;
  timeLimit?: string;
  concentration?: string;
}

interface IVSolution {
  id: string;
  name: string;
  abbreviation: string;
}

const IV_SOLUTIONS: IVSolution[] = [
  { id: 'ns', name: 'Normal Saline (0.9% NaCl)', abbreviation: 'NS' },
  { id: 'd5w', name: 'Dextrose 5% in Water', abbreviation: 'D5W' },
  { id: 'd5ns', name: 'Dextrose 5% in Normal Saline', abbreviation: 'D5NS' },
  { id: 'lr', name: 'Lactated Ringers', abbreviation: 'LR' },
  { id: 'd5lr', name: 'Dextrose 5% in Lactated Ringers', abbreviation: 'D5LR' },
  { id: 'halfns', name: '0.45% Sodium Chloride', abbreviation: '1/2 NS' },
  { id: 'd10w', name: 'Dextrose 10% in Water', abbreviation: 'D10W' },
  { id: 'swfi', name: 'Sterile Water for Injection', abbreviation: 'SWFI' },
];

const COMMON_IV_MEDICATIONS = [
  'Vancomycin',
  'Piperacillin/Tazobactam',
  'Ceftriaxone',
  'Metronidazole',
  'Gentamicin',
  'Furosemide',
  'Pantoprazole',
  'Heparin',
  'Insulin',
  'Potassium Chloride',
  'Magnesium Sulfate',
  'Morphine',
  'Hydromorphone',
  'Fentanyl',
  'Midazolam',
  'Propofol',
  'Norepinephrine',
  'Dopamine',
  'Dobutamine',
  'Phenylephrine',
  'Amiodarone',
  'Diltiazem',
  'Nitroglycerin',
  'Albumin',
  'Acyclovir',
  'Fluconazole',
  'Amphotericin B',
];

// Compatibility database (simplified for demonstration)
const COMPATIBILITY_DATABASE: Record<string, Record<string, { status: CompatibilityStatus; notes?: string; timeLimit?: string }>> = {
  'vancomycin': {
    'piperacillin/tazobactam': { status: 'incompatible', notes: 'Physical incompatibility - precipitate forms' },
    'ceftriaxone': { status: 'compatible' },
    'metronidazole': { status: 'compatible' },
    'heparin': { status: 'compatible' },
    'furosemide': { status: 'incompatible', notes: 'Vancomycin precipitates in presence of furosemide' },
    'insulin': { status: 'compatible' },
    'morphine': { status: 'compatible' },
    'pantoprazole': { status: 'incompatible', notes: 'Color change and precipitation' },
    'potassium chloride': { status: 'compatible' },
    'amiodarone': { status: 'unknown' },
    'phenylephrine': { status: 'compatible' },
  },
  'piperacillin/tazobactam': {
    'vancomycin': { status: 'incompatible', notes: 'Physical incompatibility - precipitate forms' },
    'amiodarone': { status: 'incompatible', notes: 'Precipitation occurs' },
    'dopamine': { status: 'compatible' },
    'heparin': { status: 'compatible' },
    'insulin': { status: 'compatible' },
    'potassium chloride': { status: 'compatible' },
    'acyclovir': { status: 'incompatible', notes: 'Physical incompatibility' },
  },
  'ceftriaxone': {
    'calcium': { status: 'incompatible', notes: 'CONTRAINDICATED - fatal ceftriaxone-calcium precipitates' },
    'lr': { status: 'incompatible', notes: 'Contains calcium - avoid' },
    'vancomycin': { status: 'compatible' },
    'metronidazole': { status: 'compatible' },
    'heparin': { status: 'compatible' },
    'insulin': { status: 'compatible' },
  },
  'furosemide': {
    'vancomycin': { status: 'incompatible', notes: 'Precipitate forms' },
    'amiodarone': { status: 'incompatible', notes: 'Precipitate forms' },
    'dopamine': { status: 'compatible' },
    'heparin': { status: 'compatible' },
    'morphine': { status: 'compatible' },
    'midazolam': { status: 'incompatible', notes: 'Precipitation' },
  },
  'heparin': {
    'vancomycin': { status: 'compatible' },
    'morphine': { status: 'compatible' },
    'insulin': { status: 'compatible' },
    'dopamine': { status: 'compatible' },
    'amiodarone': { status: 'compatible' },
    'gentamicin': { status: 'incompatible', notes: 'Aminoglycosides are inactivated by heparin' },
    'tobramycin': { status: 'incompatible', notes: 'Aminoglycosides are inactivated by heparin' },
  },
  'amiodarone': {
    'furosemide': { status: 'incompatible', notes: 'Precipitate forms' },
    'heparin': { status: 'compatible' },
    'insulin': { status: 'compatible' },
    'piperacillin/tazobactam': { status: 'incompatible', notes: 'Precipitation occurs' },
    'sodium bicarbonate': { status: 'incompatible', notes: 'Precipitate forms' },
  },
  'insulin': {
    'heparin': { status: 'compatible' },
    'potassium chloride': { status: 'compatible' },
    'morphine': { status: 'compatible' },
    'dopamine': { status: 'compatible' },
  },
  'propofol': {
    'blood products': { status: 'incompatible', notes: 'Never mix - separate line required' },
    'amiodarone': { status: 'conditional', notes: 'Y-site compatible for 1 hour only', timeLimit: '1 hour' },
  },
  'phenytoin': {
    'ns': { status: 'compatible', notes: 'Only compatible with NS' },
    'd5w': { status: 'incompatible', notes: 'Precipitates in dextrose solutions' },
    'lr': { status: 'incompatible', notes: 'Precipitates in LR' },
  },
};

// Solution compatibility
const SOLUTION_COMPATIBILITY: Record<string, Record<string, { status: CompatibilityStatus; notes?: string }>> = {
  'phenytoin': {
    'ns': { status: 'compatible' },
    'd5w': { status: 'incompatible', notes: 'Only stable in NS' },
    'lr': { status: 'incompatible', notes: 'Precipitate forms' },
    'd5ns': { status: 'incompatible', notes: 'Dextrose causes precipitation' },
  },
  'amphotericin b': {
    'd5w': { status: 'compatible', notes: 'Reconstitute and dilute only in D5W' },
    'ns': { status: 'incompatible', notes: 'Precipitates immediately in saline' },
    'lr': { status: 'incompatible', notes: 'Not compatible' },
  },
  'diazepam': {
    'd5w': { status: 'conditional', notes: 'Adsorbs to PVC tubing' },
    'ns': { status: 'conditional', notes: 'Adsorbs to PVC tubing' },
  },
  'nitroglycerin': {
    'd5w': { status: 'compatible', notes: 'Use non-PVC tubing' },
    'ns': { status: 'compatible', notes: 'Use non-PVC tubing' },
    'glass': { status: 'compatible', notes: 'Preferred - use glass bottles' },
  },
};

const getStatusConfig = (status: CompatibilityStatus) => {
  switch (status) {
    case 'compatible':
      return {
        color: 'emerald',
        bgClass: 'bg-emerald-500',
        lightBgClass: 'bg-emerald-500/10',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-500/30',
        icon: CheckCircleIcon,
        label: 'Compatible',
      };
    case 'incompatible':
      return {
        color: 'red',
        bgClass: 'bg-red-500',
        lightBgClass: 'bg-red-500/10',
        textClass: 'text-red-700',
        borderClass: 'border-red-500/30',
        icon: ExclamationTriangleIcon,
        label: 'Incompatible',
      };
    case 'conditional':
      return {
        color: 'amber',
        bgClass: 'bg-amber-500',
        lightBgClass: 'bg-amber-500/10',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-500/30',
        icon: ExclamationTriangleIcon,
        label: 'Conditional',
      };
    case 'unknown':
      return {
        color: 'gray',
        bgClass: 'bg-gray-500',
        lightBgClass: 'bg-gray-500/10',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-500/30',
        icon: QuestionMarkCircleIcon,
        label: 'Unknown',
      };
  }
};

export default function IVCompatibility() {
  const [medications, setMedications] = useState<IVMedication[]>([
    { id: '1', name: '' },
    { id: '2', name: '' },
  ]);
  const [selectedSolution, setSelectedSolution] = useState<string>('ns');
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<CompatibilityResult[]>([]);
  const [solutionWarnings, setSolutionWarnings] = useState<string[]>([]);

  const handleAddMedication = () => {
    const newId = String(Date.now());
    setMedications([...medications, { id: newId, name: '' }]);
  };

  const handleRemoveMedication = (id: string) => {
    if (medications.length > 2) {
      setMedications(medications.filter((m) => m.id !== id));
      setResults([]);
    }
  };

  const handleMedicationChange = (id: string, name: string) => {
    setMedications(medications.map((m) => (m.id === id ? { ...m, name } : m)));
    setResults([]);
  };

  const checkCompatibility = async () => {
    const validMeds = medications.filter((m) => m.name.trim());
    if (validMeds.length < 2) {
      toast.error('Please enter at least 2 medications');
      return;
    }

    setChecking(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const compatibilityResults: CompatibilityResult[] = [];
    const warnings: string[] = [];

    // Check drug-drug compatibility
    for (let i = 0; i < validMeds.length; i++) {
      for (let j = i + 1; j < validMeds.length; j++) {
        const drug1 = validMeds[i].name.toLowerCase();
        const drug2 = validMeds[j].name.toLowerCase();

        // Look up in database
        const drug1Data = COMPATIBILITY_DATABASE[drug1];
        const drug2Data = COMPATIBILITY_DATABASE[drug2];

        let result: CompatibilityResult = {
          drug1: validMeds[i].name,
          drug2: validMeds[j].name,
          status: 'unknown',
        };

        if (drug1Data && drug1Data[drug2]) {
          result = {
            ...result,
            status: drug1Data[drug2].status,
            notes: drug1Data[drug2].notes,
            timeLimit: drug1Data[drug2].timeLimit,
          };
        } else if (drug2Data && drug2Data[drug1]) {
          result = {
            ...result,
            status: drug2Data[drug1].status,
            notes: drug2Data[drug1].notes,
            timeLimit: drug2Data[drug1].timeLimit,
          };
        }

        compatibilityResults.push(result);
      }
    }

    // Check solution compatibility for each drug
    for (const med of validMeds) {
      const drugName = med.name.toLowerCase();
      const solutionData = SOLUTION_COMPATIBILITY[drugName];

      if (solutionData && solutionData[selectedSolution]) {
        const solCompat = solutionData[selectedSolution];
        if (solCompat.status === 'incompatible') {
          warnings.push(`${med.name}: ${solCompat.notes || 'Not compatible with selected solution'}`);
        } else if (solCompat.status === 'conditional') {
          warnings.push(`${med.name}: ${solCompat.notes || 'Use with caution'}`);
        }
      }
    }

    // Special check for ceftriaxone and LR
    if (selectedSolution === 'lr' || selectedSolution === 'd5lr') {
      const hasCeftriaxone = validMeds.some((m) => m.name.toLowerCase().includes('ceftriaxone'));
      if (hasCeftriaxone) {
        warnings.push('CRITICAL: Ceftriaxone is incompatible with calcium-containing solutions (LR) - risk of fatal precipitation');
      }
    }

    setResults(compatibilityResults);
    setSolutionWarnings(warnings);
    setChecking(false);
    toast.success('Compatibility check complete');
  };

  // Generate compatibility matrix
  const compatibilityMatrix = useMemo(() => {
    const validMeds = medications.filter((m) => m.name.trim());
    if (validMeds.length < 2 || results.length === 0) return null;

    return validMeds.map((med1) => ({
      drug: med1.name,
      compatibilities: validMeds.map((med2) => {
        if (med1.id === med2.id) return { status: 'self' as const, drug: med2.name };

        const result = results.find(
          (r) =>
            (r.drug1.toLowerCase() === med1.name.toLowerCase() && r.drug2.toLowerCase() === med2.name.toLowerCase()) ||
            (r.drug2.toLowerCase() === med1.name.toLowerCase() && r.drug1.toLowerCase() === med2.name.toLowerCase())
        );

        return {
          status: result?.status || 'unknown',
          drug: med2.name,
          notes: result?.notes,
          timeLimit: result?.timeLimit,
        };
      }),
    }));
  }, [medications, results]);

  const incompatibleCount = results.filter((r) => r.status === 'incompatible').length;
  const unknownCount = results.filter((r) => r.status === 'unknown').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <BeakerIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900">IV Compatibility</h3>
              <p className="text-sm text-gray-500">Check IV medication compatibility</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Solution Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IV Solution
              </label>
              <select
                value={selectedSolution}
                onChange={(e) => {
                  setSelectedSolution(e.target.value);
                  setResults([]);
                  setSolutionWarnings([]);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-gray-900"
              >
                {IV_SOLUTIONS.map((sol) => (
                  <option key={sol.id} value={sol.id}>
                    {sol.name} ({sol.abbreviation})
                  </option>
                ))}
              </select>
            </div>

            {/* Medications */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IV Medications
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {medications.map((med, index) => (
                  <div key={med.id} className="flex gap-2 animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                    <input
                      type="text"
                      list="iv-medications-list"
                      placeholder={`Medication ${index + 1}`}
                      value={med.name}
                      onChange={(e) => handleMedicationChange(med.id, e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-gray-900 placeholder-gray-400"
                    />
                    {medications.length > 2 && (
                      <button
                        onClick={() => handleRemoveMedication(med.id)}
                        className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <datalist id="iv-medications-list">
                {COMMON_IV_MEDICATIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <button
              onClick={handleAddMedication}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 font-medium transition-all duration-300 flex items-center justify-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Medication
            </button>

            <button
              onClick={checkCompatibility}
              disabled={checking}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checking ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <BeakerIcon className="h-5 w-5" />
                  Check Compatibility
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          <h3 className="font-semibold text-lg text-gray-900 mb-6">Compatibility Matrix</h3>

          {results.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                <BeakerIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500">
                Add IV medications and check compatibility
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
                  <span className="text-2xl font-bold text-emerald-700">
                    {results.filter((r) => r.status === 'compatible').length}
                  </span>
                  <p className="text-xs text-emerald-600">Compatible</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mx-auto mb-1" />
                  <span className="text-2xl font-bold text-red-700">{incompatibleCount}</span>
                  <p className="text-xs text-red-600">Incompatible</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-500/10 border border-gray-500/30 text-center">
                  <QuestionMarkCircleIcon className="h-6 w-6 text-gray-600 mx-auto mb-1" />
                  <span className="text-2xl font-bold text-gray-700">{unknownCount}</span>
                  <p className="text-xs text-gray-600">Unknown</p>
                </div>
              </div>

              {/* Solution Warnings */}
              {solutionWarnings.length > 0 && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-700">Solution Compatibility Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {solutionWarnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-red-600 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Compatibility Matrix Table */}
              {compatibilityMatrix && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 text-left text-sm font-medium text-gray-700 bg-gray-50 rounded-tl-lg"></th>
                        {compatibilityMatrix.map((row, idx) => (
                          <th key={idx} className="p-2 text-xs font-medium text-gray-700 bg-gray-50 text-center max-w-[100px] truncate" title={row.drug}>
                            {row.drug.length > 12 ? row.drug.substring(0, 10) + '...' : row.drug}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compatibilityMatrix.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td className="p-2 text-xs font-medium text-gray-700 bg-gray-50 max-w-[120px] truncate" title={row.drug}>
                            {row.drug.length > 15 ? row.drug.substring(0, 13) + '...' : row.drug}
                          </td>
                          {row.compatibilities.map((compat, colIdx) => {
                            if (compat.status === 'self') {
                              return (
                                <td key={colIdx} className="p-2 text-center">
                                  <div className="w-8 h-8 mx-auto bg-gray-200 rounded-lg" />
                                </td>
                              );
                            }
                            const config = getStatusConfig(compat.status);
                            const Icon = config.icon;
                            return (
                              <td key={colIdx} className="p-2 text-center">
                                <div
                                  className={clsx('w-8 h-8 mx-auto rounded-lg flex items-center justify-center cursor-help', config.lightBgClass)}
                                  title={compat.notes || config.label}
                                >
                                  <Icon className={clsx('h-5 w-5', config.textClass)} />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Detailed Results */}
              {results.some((r) => r.status !== 'compatible') && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Compatibility Details</h4>
                  {results
                    .filter((r) => r.status !== 'compatible')
                    .map((result, idx) => {
                      const config = getStatusConfig(result.status);
                      const Icon = config.icon;
                      return (
                        <div
                          key={idx}
                          className={clsx('p-3 rounded-xl border', config.lightBgClass, config.borderClass)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={clsx('h-5 w-5', config.textClass)} />
                            <span className={clsx('font-medium', config.textClass)}>
                              {result.drug1} + {result.drug2}
                            </span>
                            <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full text-white', config.bgClass)}>
                              {config.label}
                            </span>
                          </div>
                          {result.notes && (
                            <p className="text-sm text-gray-600 ml-7">{result.notes}</p>
                          )}
                          {result.timeLimit && (
                            <p className="text-xs text-amber-600 ml-7 mt-1">
                              Time limit: {result.timeLimit}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Legend */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Legend</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {(['compatible', 'incompatible', 'conditional', 'unknown'] as CompatibilityStatus[]).map((status) => {
                    const config = getStatusConfig(status);
                    const Icon = config.icon;
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <div className={clsx('w-6 h-6 rounded flex items-center justify-center', config.lightBgClass)}>
                          <Icon className={clsx('h-4 w-4', config.textClass)} />
                        </div>
                        <span className="text-gray-600">{config.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-2">
                <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Always verify compatibility with current pharmacy references. This tool provides guidance
                  based on common compatibility data. When in doubt, consult your pharmacist or use dedicated
                  Y-site administration.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
