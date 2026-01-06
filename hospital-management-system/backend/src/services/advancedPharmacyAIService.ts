import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface PatientData {
  age?: number;
  weight?: number; // kg
  gender?: 'male' | 'female';
  creatinine?: number; // mg/dL
  renalFunction?: 'normal' | 'mild' | 'moderate' | 'severe' | 'dialysis';
  hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
  allergies?: string[];
  conditions?: string[];
  geneticProfile?: {
    cyp2d6?: 'poor' | 'intermediate' | 'normal' | 'ultra-rapid';
    cyp2c19?: 'poor' | 'intermediate' | 'normal' | 'ultra-rapid';
    cyp2c9?: 'poor' | 'intermediate' | 'normal';
    cyp3a4?: 'reduced' | 'normal' | 'increased';
  };
}

interface TDMGuidance {
  drugName: string;
  requiresTDM: boolean;
  therapeuticRange: {
    min: number;
    max: number;
    unit: string;
  };
  toxicLevel?: {
    value: number;
    unit: string;
  };
  sampleTiming: {
    type: 'trough' | 'peak' | 'random' | 'both';
    description: string;
    timing: string;
  };
  frequency: string;
  adjustmentFactors: string[];
  toxicitySigns: string[];
  monitoringParameters: string[];
  clinicalPearls: string[];
}

interface CYP450Result {
  interactions: {
    enzyme: string;
    drug1: string;
    drug1Role: 'inhibitor' | 'inducer' | 'substrate';
    drug2: string;
    drug2Role: 'inhibitor' | 'inducer' | 'substrate';
    clinicalSignificance: 'major' | 'moderate' | 'minor';
    effect: string;
    recommendation: string;
  }[];
  prodrugsAffected: {
    prodrug: string;
    activeMetabolite: string;
    enzyme: string;
    impact: string;
    recommendation: string;
  }[];
  summary: {
    majorInteractions: number;
    moderateInteractions: number;
    minorInteractions: number;
    totalRisk: 'high' | 'moderate' | 'low';
  };
  recommendations: string[];
}

interface DrugAlternative {
  drugName: string;
  genericName: string;
  brandNames: string[];
  relativeCoast: '$' | '$$' | '$$$' | '$$$$' | '$$$$$';
  therapeuticEquivalence: 'A' | 'B' | 'C'; // A = bioequivalent, B = therapeutic alternative, C = different class
  formularyStatus: 'preferred' | 'non-preferred' | 'not-listed';
  considerations: string[];
  contraindications: string[];
}

interface RenalDoseResult {
  creatinineClearance: number;
  creatinineClearanceUnit: string;
  calculationMethod: string;
  renalStage: string;
  originalDose: string;
  adjustedDose: string;
  frequencyAdjustment: string;
  monitoringRecommendations: string[];
  warnings: string[];
  dialysisConsiderations?: string;
}

interface IVCompatibilityResult {
  drug1: string;
  drug2: string;
  solution?: string;
  ysite: {
    compatible: boolean;
    stability: string;
    concentration?: string;
    notes: string;
  };
  admixture: {
    compatible: boolean;
    stability: string;
    notes: string;
  };
  physicalChanges: string[];
  recommendations: string[];
  references: string[];
}

interface LabInteraction {
  medication: string;
  labTest: string;
  effect: 'increase' | 'decrease' | 'interference' | 'false-positive' | 'false-negative';
  magnitude: 'significant' | 'moderate' | 'minor';
  mechanism: string;
  clinicalRecommendation: string;
  timing?: string;
}

interface PolypharmacyRisk {
  overallRiskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very-high';
  anticholinergicBurden: {
    score: number;
    highRiskDrugs: string[];
    symptoms: string[];
  };
  fallRisk: {
    score: number;
    contributingMedications: string[];
    recommendations: string[];
  };
  beersCriteriaViolations: {
    medication: string;
    reason: string;
    alternative?: string;
    recommendation: string;
  }[];
  stoppCriteria: {
    medication: string;
    criterion: string;
    recommendation: string;
  }[];
  startCriteria: {
    indication: string;
    recommendedMedication: string;
    reason: string;
  }[];
  duplicateTherapy: {
    class: string;
    medications: string[];
    recommendation: string;
  }[];
  recommendations: string[];
}

// ============================================================================
// KNOWLEDGE BASES
// ============================================================================

// Therapeutic Drug Monitoring Database
const TDM_DATABASE: Record<string, Omit<TDMGuidance, 'drugName'>> = {
  'vancomycin': {
    requiresTDM: true,
    therapeuticRange: { min: 10, max: 20, unit: 'mcg/mL' },
    toxicLevel: { value: 25, unit: 'mcg/mL' },
    sampleTiming: {
      type: 'trough',
      description: 'Draw trough level 30 minutes before 4th or 5th dose',
      timing: '30 minutes before next dose, at steady state (after 4-5 half-lives)'
    },
    frequency: 'Weekly for stable patients; more frequently for changing renal function',
    adjustmentFactors: [
      'Renal function (adjust for CrCl)',
      'Obesity (use adjusted body weight)',
      'Age (elderly have longer half-life)',
      'Critical illness (increased volume of distribution)',
      'Burns (increased clearance)'
    ],
    toxicitySigns: [
      'Nephrotoxicity: Rising creatinine, decreased urine output',
      'Ototoxicity: Tinnitus, hearing loss (rare with modern dosing)',
      'Red man syndrome: Flushing, pruritus (infusion-related)',
      'Neutropenia: With prolonged use (>7 days)'
    ],
    monitoringParameters: [
      'Serum creatinine (baseline and every 2-3 days)',
      'BUN',
      'Urinalysis',
      'CBC with differential weekly',
      'Vancomycin trough level'
    ],
    clinicalPearls: [
      'Target AUC/MIC ratio of 400-600 for MRSA infections',
      'Consider loading dose of 25-30 mg/kg for serious infections',
      'Extend infusion time for doses >1g to prevent red man syndrome',
      'May need higher doses for CNS infections'
    ]
  },
  'digoxin': {
    requiresTDM: true,
    therapeuticRange: { min: 0.8, max: 2.0, unit: 'ng/mL' },
    toxicLevel: { value: 2.5, unit: 'ng/mL' },
    sampleTiming: {
      type: 'trough',
      description: 'Draw at least 6-8 hours post-dose (ideally 12-24 hours)',
      timing: '6-8 hours after last dose, preferably just before next dose'
    },
    frequency: 'Weekly initially, then monthly when stable; recheck with any change in renal function',
    adjustmentFactors: [
      'Renal function (main elimination route)',
      'Hypokalemia (increases toxicity risk)',
      'Hypomagnesemia (increases toxicity risk)',
      'Hypothyroidism (decreased clearance)',
      'Drug interactions (amiodarone, verapamil increase levels)'
    ],
    toxicitySigns: [
      'GI: Nausea, vomiting, anorexia (often first signs)',
      'Visual: Yellow-green halos, blurred vision',
      'Cardiac: Bradycardia, AV block, ventricular arrhythmias',
      'CNS: Fatigue, confusion, delirium (especially elderly)'
    ],
    monitoringParameters: [
      'Digoxin level',
      'Serum potassium',
      'Serum magnesium',
      'Serum creatinine',
      'Heart rate and rhythm'
    ],
    clinicalPearls: [
      'For heart failure, target lower range (0.5-1.0 ng/mL)',
      'Elderly patients often need lower doses',
      'Half-life prolonged in renal impairment (up to 4-6 days)',
      'Digibind available for severe toxicity'
    ]
  },
  'lithium': {
    requiresTDM: true,
    therapeuticRange: { min: 0.6, max: 1.2, unit: 'mEq/L' },
    toxicLevel: { value: 1.5, unit: 'mEq/L' },
    sampleTiming: {
      type: 'trough',
      description: 'Draw 12 hours post-dose (for standard release)',
      timing: '12 hours after evening dose, before morning dose'
    },
    frequency: 'Weekly during initiation; monthly when stable; more frequently during illness',
    adjustmentFactors: [
      'Renal function (sole elimination route)',
      'Sodium intake (dehydration increases levels)',
      'Drug interactions (NSAIDs, ACE inhibitors, diuretics)',
      'Age (elderly need lower doses)',
      'Thyroid function changes'
    ],
    toxicitySigns: [
      'Mild (1.5-2.0): Tremor, nausea, diarrhea, polyuria',
      'Moderate (2.0-2.5): Vomiting, ataxia, confusion, slurred speech',
      'Severe (>2.5): Seizures, coma, arrhythmias, permanent neurological damage'
    ],
    monitoringParameters: [
      'Lithium level',
      'Serum creatinine and BUN',
      'TSH (every 6-12 months)',
      'Calcium (hyperparathyroidism risk)',
      'ECG (T-wave flattening)',
      'Urinalysis (nephrogenic DI)'
    ],
    clinicalPearls: [
      'Acute mania may need higher levels (0.8-1.2 mEq/L)',
      'Maintenance often 0.6-0.8 mEq/L',
      'Never stop abruptly - taper slowly',
      'Hydration critical during illness/heat'
    ]
  },
  'phenytoin': {
    requiresTDM: true,
    therapeuticRange: { min: 10, max: 20, unit: 'mcg/mL' },
    toxicLevel: { value: 25, unit: 'mcg/mL' },
    sampleTiming: {
      type: 'trough',
      description: 'Draw trough level; check free phenytoin if albumin low',
      timing: 'Just before next dose, at steady state (5-7 days)'
    },
    frequency: 'Weekly during loading; monthly when stable; with any dose change',
    adjustmentFactors: [
      'Hypoalbuminemia (check free level)',
      'Renal failure (altered protein binding)',
      'Hepatic impairment (decreased metabolism)',
      'Pregnancy (decreased levels)',
      'Drug interactions (multiple CYP2C9/2C19)'
    ],
    toxicitySigns: [
      'Mild (15-20): Nystagmus',
      'Moderate (20-30): Ataxia, slurred speech, nausea',
      'Severe (30-40): Lethargy, confusion',
      'Very severe (>40): Coma, respiratory depression',
      'Chronic: Gingival hyperplasia, hirsutism, osteomalacia'
    ],
    monitoringParameters: [
      'Phenytoin level (total and free if indicated)',
      'Albumin',
      'LFTs',
      'CBC',
      'Vitamin D and calcium (chronic use)'
    ],
    clinicalPearls: [
      'Non-linear kinetics - small dose changes cause large level changes',
      'Free phenytoin = Total / (0.2 x Albumin + 0.1) for hypoalbuminemia',
      'Loading dose: 15-20 mg/kg IV (max 50 mg/min)',
      'Many drug interactions due to CYP induction'
    ]
  },
  'valproic acid': {
    requiresTDM: true,
    therapeuticRange: { min: 50, max: 100, unit: 'mcg/mL' },
    toxicLevel: { value: 120, unit: 'mcg/mL' },
    sampleTiming: {
      type: 'trough',
      description: 'Draw trough level before morning dose',
      timing: 'Just before next dose, at steady state (3-5 days)'
    },
    frequency: 'Weekly during initiation; monthly when stable',
    adjustmentFactors: [
      'Hepatic function (primary metabolism)',
      'Protein binding (free levels in elderly, uremia)',
      'Drug interactions (enzyme inhibitor)',
      'Urea cycle disorders (hyperammonemia risk)',
      'Pregnancy (teratogenic, avoid if possible)'
    ],
    toxicitySigns: [
      'GI: Nausea, vomiting (common at initiation)',
      'CNS: Sedation, tremor, ataxia',
      'Hepatotoxicity: Elevated LFTs, fatal in children <2 years',
      'Hyperammonemia: Confusion, lethargy (even with normal levels)',
      'Pancreatitis: Abdominal pain, elevated lipase'
    ],
    monitoringParameters: [
      'Valproic acid level',
      'LFTs (baseline and periodically)',
      'Ammonia (if symptoms of encephalopathy)',
      'Platelets and CBC',
      'Lipase (if abdominal symptoms)'
    ],
    clinicalPearls: [
      'Black box warning for hepatotoxicity and pancreatitis',
      'Teratogenic - contraindicated in pregnancy for migraine/bipolar',
      'May cause weight gain and hair loss',
      'Hyperammonemia can occur without elevated LFTs'
    ]
  },
  'carbamazepine': {
    requiresTDM: true,
    therapeuticRange: { min: 4, max: 12, unit: 'mcg/mL' },
    toxicLevel: { value: 15, unit: 'mcg/mL' },
    sampleTiming: {
      type: 'trough',
      description: 'Draw trough level; recheck after autoinduction',
      timing: 'Just before next dose, at steady state (1-2 weeks due to autoinduction)'
    },
    frequency: 'Weekly during initiation; monthly when stable; recheck 2-4 weeks after dose changes',
    adjustmentFactors: [
      'Autoinduction (levels decrease over 2-4 weeks)',
      'Hepatic function',
      'Drug interactions (CYP3A4 inducer)',
      'HLA-B*1502 (Asians - SJS/TEN risk)',
      'Concurrent valproate (increases epoxide metabolite)'
    ],
    toxicitySigns: [
      'CNS: Dizziness, ataxia, diplopia, nystagmus',
      'GI: Nausea, vomiting',
      'Cardiac: AV block, arrhythmias',
      'Hematologic: Aplastic anemia, agranulocytosis (rare)',
      'Dermatologic: SJS/TEN (especially HLA-B*1502 positive)'
    ],
    monitoringParameters: [
      'Carbamazepine level',
      'CBC with differential',
      'LFTs',
      'Sodium (SIADH risk)',
      'HLA-B*1502 screening (Asians)'
    ],
    clinicalPearls: [
      'Autoinduction: levels fall 30% over 2-4 weeks',
      'Strong CYP3A4 inducer - many drug interactions',
      'Screen for HLA-B*1502 in Asian patients',
      'Avoid in AV block or bone marrow suppression'
    ]
  },
  'gentamicin': {
    requiresTDM: true,
    therapeuticRange: { min: 0.5, max: 2, unit: 'mcg/mL' }, // trough
    toxicLevel: { value: 2, unit: 'mcg/mL' },
    sampleTiming: {
      type: 'both',
      description: 'Peak 30 min after infusion; Trough before next dose',
      timing: 'Peak: 30 minutes post-infusion. Trough: 30 minutes before next dose'
    },
    frequency: 'With 3rd dose then every 3-4 days; daily in renal impairment',
    adjustmentFactors: [
      'Renal function (adjust interval or dose)',
      'Burns (increased clearance)',
      'Obesity (use adjusted body weight)',
      'Ascites/edema (increased volume of distribution)',
      'Concurrent nephrotoxins'
    ],
    toxicitySigns: [
      'Nephrotoxicity: Rising creatinine, decreased urine output',
      'Ototoxicity: Vestibular - dizziness, vertigo; Cochlear - hearing loss',
      'Neuromuscular blockade: Weakness, respiratory depression (rare)'
    ],
    monitoringParameters: [
      'Peak level (target 5-10 mcg/mL for traditional dosing)',
      'Trough level (target <2 mcg/mL)',
      'Serum creatinine daily',
      'BUN',
      'Urine output'
    ],
    clinicalPearls: [
      'Extended-interval dosing (5-7 mg/kg q24h) preferred for normal renal function',
      'Hartford nomogram for dosing adjustments',
      'Synergy dosing for endocarditis: lower doses (1 mg/kg q8h)',
      'Risk of ototoxicity increases with cumulative dose and duration'
    ]
  },
  'tobramycin': {
    requiresTDM: true,
    therapeuticRange: { min: 0.5, max: 2, unit: 'mcg/mL' },
    toxicLevel: { value: 2, unit: 'mcg/mL' },
    sampleTiming: {
      type: 'both',
      description: 'Same as gentamicin - peak and trough levels',
      timing: 'Peak: 30 minutes post-infusion. Trough: 30 minutes before next dose'
    },
    frequency: 'With 3rd dose then every 3-4 days; daily in renal impairment',
    adjustmentFactors: [
      'Renal function',
      'Cystic fibrosis (increased clearance)',
      'Burns',
      'Obesity',
      'Concurrent nephrotoxins'
    ],
    toxicitySigns: [
      'Nephrotoxicity (less than gentamicin)',
      'Ototoxicity (similar to gentamicin)',
      'Neuromuscular blockade'
    ],
    monitoringParameters: [
      'Peak level (target 5-10 mcg/mL)',
      'Trough level (target <2 mcg/mL)',
      'Serum creatinine',
      'BUN'
    ],
    clinicalPearls: [
      'Preferred aminoglycoside for Pseudomonas',
      'CF patients need higher doses (10 mg/kg q24h)',
      'Inhaled form (TOBI) for CF bronchiectasis',
      'Extended-interval dosing similar to gentamicin'
    ]
  },
  'amikacin': {
    requiresTDM: true,
    therapeuticRange: { min: 1, max: 8, unit: 'mcg/mL' }, // trough
    toxicLevel: { value: 10, unit: 'mcg/mL' },
    sampleTiming: {
      type: 'both',
      description: 'Peak 30 min post-infusion; Trough before next dose',
      timing: 'Peak: 30 minutes post-infusion (target 20-30 mcg/mL). Trough: before next dose'
    },
    frequency: 'With 3rd dose then every 3-4 days',
    adjustmentFactors: [
      'Renal function',
      'Obesity',
      'Burns',
      'Critical illness'
    ],
    toxicitySigns: [
      'Nephrotoxicity',
      'Ototoxicity (primarily vestibular)',
      'Neuromuscular blockade'
    ],
    monitoringParameters: [
      'Peak level (target 20-30 mcg/mL)',
      'Trough level (target <8 mcg/mL)',
      'Serum creatinine',
      'BUN'
    ],
    clinicalPearls: [
      'Less susceptible to aminoglycoside-modifying enzymes',
      'Useful for resistant gram-negative infections',
      'Standard dose: 15-20 mg/kg q24h for extended-interval',
      'May be used for MAC infections in HIV/AIDS'
    ]
  },
  'theophylline': {
    requiresTDM: true,
    therapeuticRange: { min: 10, max: 20, unit: 'mcg/mL' },
    toxicLevel: { value: 20, unit: 'mcg/mL' },
    sampleTiming: {
      type: 'trough',
      description: 'Draw trough for sustained release; peak+trough for immediate release',
      timing: 'Sustained release: Just before next dose. Immediate release: 1-2h post-dose and trough'
    },
    frequency: 'Every 6-12 months when stable; with any dose change or interacting medication',
    adjustmentFactors: [
      'Smoking (increased clearance)',
      'Heart failure (decreased clearance)',
      'Liver disease (decreased clearance)',
      'Fever/infection (decreased clearance)',
      'Drug interactions (ciprofloxacin, erythromycin inhibit metabolism)'
    ],
    toxicitySigns: [
      'Mild (15-25): Nausea, tremor, insomnia, headache',
      'Moderate (25-35): Tachycardia, arrhythmias, vomiting',
      'Severe (>40): Seizures, hypotension, death',
      'Note: Arrhythmias and seizures can occur without warning'
    ],
    monitoringParameters: [
      'Theophylline level',
      'Heart rate and rhythm',
      'Blood pressure',
      'Potassium (hypokalemia in toxicity)'
    ],
    clinicalPearls: [
      'Narrow therapeutic index - monitor closely',
      'Seizures can occur without premonitory symptoms',
      'Smoking cessation increases levels by 50%',
      'Multiple drug interactions via CYP1A2'
    ]
  },
  'cyclosporine': {
    requiresTDM: true,
    therapeuticRange: { min: 100, max: 400, unit: 'ng/mL' }, // varies by indication
    sampleTiming: {
      type: 'trough',
      description: 'Draw trough level (C0) or 2-hour post-dose (C2) depending on protocol',
      timing: 'C0: Just before next dose. C2: Exactly 2 hours post-dose'
    },
    frequency: 'Twice weekly initially; weekly to monthly when stable',
    adjustmentFactors: [
      'Renal function',
      'Hepatic function (metabolism)',
      'Drug interactions (CYP3A4 substrate)',
      'Formulation (Neoral vs generic)',
      'Food (absorption varies)'
    ],
    toxicitySigns: [
      'Nephrotoxicity (dose-dependent and chronic)',
      'Hypertension',
      'Hyperkalemia',
      'Hypomagnesemia',
      'Tremor, paresthesias',
      'Gingival hyperplasia, hirsutism'
    ],
    monitoringParameters: [
      'Cyclosporine level',
      'Serum creatinine',
      'BUN',
      'Potassium',
      'Magnesium',
      'Blood pressure',
      'LFTs',
      'Lipids'
    ],
    clinicalPearls: [
      'Target levels vary by indication and time post-transplant',
      'C2 monitoring may better predict outcomes',
      'Neoral and Sandimmune are NOT interchangeable',
      'Grapefruit juice increases levels significantly'
    ]
  },
  'tacrolimus': {
    requiresTDM: true,
    therapeuticRange: { min: 5, max: 20, unit: 'ng/mL' }, // varies by indication and time
    sampleTiming: {
      type: 'trough',
      description: 'Draw trough level 12 hours post-dose',
      timing: 'Just before next dose, 12 hours post previous dose'
    },
    frequency: 'Daily initially; weekly to monthly when stable',
    adjustmentFactors: [
      'Hepatic function (primary metabolism)',
      'Drug interactions (CYP3A4 substrate)',
      'Diarrhea (increased absorption)',
      'African American patients (often need higher doses)',
      'Food (take consistently with or without food)'
    ],
    toxicitySigns: [
      'Nephrotoxicity',
      'Neurotoxicity: Tremor, headache, seizures, PRES',
      'Diabetes mellitus (new-onset)',
      'Hyperkalemia',
      'Hypomagnesemia',
      'GI: Nausea, diarrhea'
    ],
    monitoringParameters: [
      'Tacrolimus level',
      'Serum creatinine',
      'Potassium',
      'Magnesium',
      'Fasting glucose',
      'Blood pressure',
      'Neurological status'
    ],
    clinicalPearls: [
      'Target levels vary by organ and time post-transplant',
      'More diabetogenic than cyclosporine',
      'Lower incidence of hypertension and hyperlipidemia vs cyclosporine',
      'Extended-release formulations available (once daily)'
    ]
  }
};

// CYP450 Enzyme Interaction Database
const CYP450_DATABASE: Record<string, {
  substrates: string[];
  inhibitors: { drug: string; strength: 'strong' | 'moderate' | 'weak' }[];
  inducers: { drug: string; strength: 'strong' | 'moderate' | 'weak' }[];
}> = {
  'CYP2D6': {
    substrates: [
      'codeine', 'tramadol', 'hydrocodone', 'oxycodone',
      'metoprolol', 'carvedilol', 'propranolol', 'timolol',
      'fluoxetine', 'paroxetine', 'venlafaxine', 'duloxetine',
      'amitriptyline', 'nortriptyline', 'desipramine', 'imipramine',
      'haloperidol', 'risperidone', 'aripiprazole', 'thioridazine',
      'tamoxifen', 'ondansetron', 'dextromethorphan'
    ],
    inhibitors: [
      { drug: 'fluoxetine', strength: 'strong' },
      { drug: 'paroxetine', strength: 'strong' },
      { drug: 'bupropion', strength: 'strong' },
      { drug: 'quinidine', strength: 'strong' },
      { drug: 'duloxetine', strength: 'moderate' },
      { drug: 'sertraline', strength: 'moderate' },
      { drug: 'amiodarone', strength: 'moderate' },
      { drug: 'diphenhydramine', strength: 'weak' }
    ],
    inducers: [
      { drug: 'dexamethasone', strength: 'weak' }
    ]
  },
  'CYP3A4': {
    substrates: [
      'simvastatin', 'atorvastatin', 'lovastatin',
      'amlodipine', 'felodipine', 'nifedipine', 'diltiazem',
      'cyclosporine', 'tacrolimus', 'sirolimus',
      'fentanyl', 'methadone', 'alfentanil',
      'midazolam', 'triazolam', 'alprazolam',
      'apixaban', 'rivaroxaban',
      'sildenafil', 'tadalafil',
      'clarithromycin', 'erythromycin',
      'itraconazole', 'ketoconazole',
      'carbamazepine', 'quetiapine', 'buspirone'
    ],
    inhibitors: [
      { drug: 'ketoconazole', strength: 'strong' },
      { drug: 'itraconazole', strength: 'strong' },
      { drug: 'clarithromycin', strength: 'strong' },
      { drug: 'ritonavir', strength: 'strong' },
      { drug: 'nefazodone', strength: 'strong' },
      { drug: 'grapefruit juice', strength: 'strong' },
      { drug: 'erythromycin', strength: 'moderate' },
      { drug: 'diltiazem', strength: 'moderate' },
      { drug: 'verapamil', strength: 'moderate' },
      { drug: 'fluconazole', strength: 'moderate' },
      { drug: 'amiodarone', strength: 'moderate' },
      { drug: 'cimetidine', strength: 'weak' }
    ],
    inducers: [
      { drug: 'rifampin', strength: 'strong' },
      { drug: 'carbamazepine', strength: 'strong' },
      { drug: 'phenytoin', strength: 'strong' },
      { drug: 'phenobarbital', strength: 'strong' },
      { drug: 'st johns wort', strength: 'strong' },
      { drug: 'efavirenz', strength: 'moderate' },
      { drug: 'modafinil', strength: 'moderate' }
    ]
  },
  'CYP2C19': {
    substrates: [
      'omeprazole', 'esomeprazole', 'lansoprazole', 'pantoprazole',
      'clopidogrel',
      'citalopram', 'escitalopram', 'sertraline',
      'diazepam', 'phenytoin', 'phenobarbital',
      'voriconazole', 'proguanil'
    ],
    inhibitors: [
      { drug: 'fluoxetine', strength: 'strong' },
      { drug: 'fluvoxamine', strength: 'strong' },
      { drug: 'fluconazole', strength: 'moderate' },
      { drug: 'omeprazole', strength: 'moderate' },
      { drug: 'esomeprazole', strength: 'moderate' },
      { drug: 'voriconazole', strength: 'moderate' }
    ],
    inducers: [
      { drug: 'rifampin', strength: 'strong' },
      { drug: 'carbamazepine', strength: 'moderate' }
    ]
  },
  'CYP2C9': {
    substrates: [
      'warfarin',
      'phenytoin',
      'losartan', 'irbesartan',
      'glipizide', 'glyburide', 'tolbutamide',
      'celecoxib', 'ibuprofen', 'naproxen', 'meloxicam',
      'fluvastatin'
    ],
    inhibitors: [
      { drug: 'fluconazole', strength: 'strong' },
      { drug: 'amiodarone', strength: 'moderate' },
      { drug: 'fluoxetine', strength: 'moderate' },
      { drug: 'metronidazole', strength: 'moderate' },
      { drug: 'sulfamethoxazole', strength: 'moderate' },
      { drug: 'voriconazole', strength: 'moderate' }
    ],
    inducers: [
      { drug: 'rifampin', strength: 'strong' },
      { drug: 'carbamazepine', strength: 'moderate' },
      { drug: 'phenobarbital', strength: 'moderate' }
    ]
  },
  'CYP1A2': {
    substrates: [
      'theophylline', 'caffeine',
      'clozapine', 'olanzapine',
      'duloxetine', 'mirtazapine',
      'warfarin',
      'melatonin', 'ramelteon'
    ],
    inhibitors: [
      { drug: 'ciprofloxacin', strength: 'strong' },
      { drug: 'fluvoxamine', strength: 'strong' },
      { drug: 'enoxacin', strength: 'strong' },
      { drug: 'cimetidine', strength: 'moderate' },
      { drug: 'oral contraceptives', strength: 'moderate' }
    ],
    inducers: [
      { drug: 'smoking', strength: 'strong' },
      { drug: 'chargrilled meat', strength: 'moderate' },
      { drug: 'rifampin', strength: 'moderate' },
      { drug: 'carbamazepine', strength: 'weak' }
    ]
  }
};

// Prodrugs requiring CYP activation
const PRODRUG_DATABASE: Record<string, {
  activeMetabolite: string;
  activatingEnzyme: string;
  clinicalImplication: string;
}> = {
  'codeine': {
    activeMetabolite: 'morphine',
    activatingEnzyme: 'CYP2D6',
    clinicalImplication: 'Poor metabolizers get no analgesic effect; ultra-rapid metabolizers at risk for toxicity'
  },
  'tramadol': {
    activeMetabolite: 'O-desmethyltramadol',
    activatingEnzyme: 'CYP2D6',
    clinicalImplication: 'Poor metabolizers have reduced analgesia'
  },
  'clopidogrel': {
    activeMetabolite: 'active thiol metabolite',
    activatingEnzyme: 'CYP2C19',
    clinicalImplication: 'Poor metabolizers have reduced platelet inhibition; consider alternative antiplatelet'
  },
  'tamoxifen': {
    activeMetabolite: 'endoxifen',
    activatingEnzyme: 'CYP2D6',
    clinicalImplication: 'Poor metabolizers have reduced efficacy; avoid CYP2D6 inhibitors'
  },
  'losartan': {
    activeMetabolite: 'E-3174 (active carboxylic acid)',
    activatingEnzyme: 'CYP2C9',
    clinicalImplication: 'Poor metabolizers may have reduced antihypertensive effect'
  }
};

// Drug Alternatives Database
const ALTERNATIVES_DATABASE: Record<string, DrugAlternative[]> = {
  'atorvastatin': [
    {
      drugName: 'Simvastatin',
      genericName: 'simvastatin',
      brandNames: ['Zocor'],
      relativeCoast: '$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'preferred',
      considerations: ['Higher interaction potential', 'Evening dosing required'],
      contraindications: ['Strong CYP3A4 inhibitors']
    },
    {
      drugName: 'Pravastatin',
      genericName: 'pravastatin',
      brandNames: ['Pravachol'],
      relativeCoast: '$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'preferred',
      considerations: ['Fewer drug interactions', 'Less potent'],
      contraindications: []
    },
    {
      drugName: 'Rosuvastatin',
      genericName: 'rosuvastatin',
      brandNames: ['Crestor'],
      relativeCoast: '$$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'preferred',
      considerations: ['Most potent statin', 'Fewer interactions'],
      contraindications: ['Asian patients may need lower doses']
    }
  ],
  'omeprazole': [
    {
      drugName: 'Pantoprazole',
      genericName: 'pantoprazole',
      brandNames: ['Protonix'],
      relativeCoast: '$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'preferred',
      considerations: ['Fewer drug interactions', 'IV form available'],
      contraindications: []
    },
    {
      drugName: 'Famotidine',
      genericName: 'famotidine',
      brandNames: ['Pepcid'],
      relativeCoast: '$',
      therapeuticEquivalence: 'C',
      formularyStatus: 'preferred',
      considerations: ['H2 blocker - different mechanism', 'Less acid suppression', 'Fewer long-term risks'],
      contraindications: []
    }
  ],
  'lisinopril': [
    {
      drugName: 'Enalapril',
      genericName: 'enalapril',
      brandNames: ['Vasotec'],
      relativeCoast: '$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'preferred',
      considerations: ['Twice daily dosing', 'Prodrug'],
      contraindications: ['Pregnancy', 'History of angioedema with ACE inhibitors']
    },
    {
      drugName: 'Losartan',
      genericName: 'losartan',
      brandNames: ['Cozaar'],
      relativeCoast: '$$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'preferred',
      considerations: ['ARB - no cough side effect', 'May have uricosuric effect'],
      contraindications: ['Pregnancy']
    }
  ],
  'metformin': [
    {
      drugName: 'Metformin Extended Release',
      genericName: 'metformin ER',
      brandNames: ['Glucophage XR', 'Glumetza'],
      relativeCoast: '$',
      therapeuticEquivalence: 'A',
      formularyStatus: 'preferred',
      considerations: ['Once daily dosing', 'Better GI tolerance'],
      contraindications: ['Same as immediate release']
    }
  ],
  'amlodipine': [
    {
      drugName: 'Nifedipine ER',
      genericName: 'nifedipine extended release',
      brandNames: ['Procardia XL', 'Adalat CC'],
      relativeCoast: '$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'preferred',
      considerations: ['May be less ankle edema'],
      contraindications: ['Severe aortic stenosis']
    },
    {
      drugName: 'Felodipine',
      genericName: 'felodipine',
      brandNames: ['Plendil'],
      relativeCoast: '$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'preferred',
      considerations: ['Once daily', 'Similar efficacy'],
      contraindications: []
    }
  ],
  'gabapentin': [
    {
      drugName: 'Pregabalin',
      genericName: 'pregabalin',
      brandNames: ['Lyrica'],
      relativeCoast: '$$$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'non-preferred',
      considerations: ['Better bioavailability', 'Twice daily dosing', 'Controlled substance (CV)'],
      contraindications: []
    }
  ],
  'clopidogrel': [
    {
      drugName: 'Prasugrel',
      genericName: 'prasugrel',
      brandNames: ['Effient'],
      relativeCoast: '$$$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'non-preferred',
      considerations: ['More potent', 'Not affected by CYP2C19 polymorphisms', 'Higher bleeding risk'],
      contraindications: ['Prior stroke/TIA', 'Age >75', 'Weight <60kg']
    },
    {
      drugName: 'Ticagrelor',
      genericName: 'ticagrelor',
      brandNames: ['Brilinta'],
      relativeCoast: '$$$',
      therapeuticEquivalence: 'B',
      formularyStatus: 'non-preferred',
      considerations: ['Reversible inhibition', 'Twice daily', 'Not a prodrug'],
      contraindications: ['History of intracranial hemorrhage', 'Active bleeding']
    }
  ]
};

// IV Compatibility Database
const IV_COMPATIBILITY_DATABASE: Record<string, Record<string, {
  compatible: boolean;
  notes: string;
  stability?: string;
}>> = {
  'phenytoin': {
    'dextrose': { compatible: false, notes: 'Precipitates in dextrose; use NS only' },
    'normal saline': { compatible: true, notes: 'Only compatible solution; infuse within 1 hour', stability: '1 hour' },
    'heparin': { compatible: false, notes: 'Precipitation occurs' },
    'insulin': { compatible: false, notes: 'Incompatible' }
  },
  'ampicillin': {
    'gentamicin': { compatible: false, notes: 'Inactivates aminoglycosides; give separately' },
    'tobramycin': { compatible: false, notes: 'Inactivates aminoglycosides; give separately' },
    'amikacin': { compatible: false, notes: 'Inactivates aminoglycosides; give separately' },
    'normal saline': { compatible: true, notes: 'Stable for 8 hours at room temperature', stability: '8 hours' },
    'dextrose': { compatible: true, notes: 'Less stable; use within 2 hours', stability: '2 hours' }
  },
  'vancomycin': {
    'heparin': { compatible: true, notes: 'Y-site compatible', stability: '4 hours' },
    'ceftriaxone': { compatible: false, notes: 'Physical incompatibility reported' },
    'cefepime': { compatible: true, notes: 'Y-site compatible' },
    'dextrose': { compatible: true, notes: 'Stable for 24 hours refrigerated', stability: '24 hours' },
    'normal saline': { compatible: true, notes: 'Stable for 24 hours refrigerated', stability: '24 hours' }
  },
  'furosemide': {
    'midazolam': { compatible: false, notes: 'Precipitates' },
    'dobutamine': { compatible: false, notes: 'Incompatible' },
    'normal saline': { compatible: true, notes: 'Protect from light', stability: '24 hours' },
    'dextrose': { compatible: true, notes: 'Use within 24 hours', stability: '24 hours' }
  },
  'potassium chloride': {
    'normal saline': { compatible: true, notes: 'Stable', stability: '24 hours' },
    'dextrose': { compatible: true, notes: 'Stable', stability: '24 hours' },
    'mannitol': { compatible: false, notes: 'Precipitation may occur at high concentrations' }
  },
  'sodium bicarbonate': {
    'calcium': { compatible: false, notes: 'Precipitates as calcium carbonate' },
    'magnesium': { compatible: false, notes: 'Precipitates' },
    'dopamine': { compatible: false, notes: 'Inactivates catecholamines' },
    'epinephrine': { compatible: false, notes: 'Inactivates catecholamines' },
    'norepinephrine': { compatible: false, notes: 'Inactivates catecholamines' }
  },
  'insulin': {
    'normal saline': { compatible: true, notes: 'Adsorption to tubing may occur', stability: '24 hours' },
    'dextrose': { compatible: true, notes: 'Common combination for hyperkalemia', stability: '24 hours' },
    'tpn': { compatible: true, notes: 'Add just before infusion; monitor for degradation' }
  },
  'heparin': {
    'amiodarone': { compatible: false, notes: 'Precipitates' },
    'vancomycin': { compatible: true, notes: 'Y-site compatible', stability: '4 hours' },
    'normal saline': { compatible: true, notes: 'Standard diluent', stability: '24 hours' },
    'dextrose': { compatible: true, notes: 'Stable', stability: '24 hours' }
  },
  'dopamine': {
    'sodium bicarbonate': { compatible: false, notes: 'Inactivation occurs' },
    'furosemide': { compatible: false, notes: 'Incompatible' },
    'dextrose': { compatible: true, notes: 'Preferred diluent', stability: '24 hours' },
    'normal saline': { compatible: true, notes: 'Stable', stability: '24 hours' }
  }
};

// Drug-Lab Interactions Database
const DRUG_LAB_INTERACTIONS: {
  drug: string;
  labTest: string;
  effect: LabInteraction['effect'];
  magnitude: LabInteraction['magnitude'];
  mechanism: string;
  recommendation: string;
  timing?: string;
}[] = [
  {
    drug: 'biotin',
    labTest: 'Thyroid function tests (TSH, T4, T3)',
    effect: 'interference',
    magnitude: 'significant',
    mechanism: 'Biotin interferes with streptavidin-biotin immunoassays causing falsely low TSH and falsely high T4/T3',
    recommendation: 'Hold biotin for 48-72 hours before thyroid testing',
    timing: '48-72 hours'
  },
  {
    drug: 'biotin',
    labTest: 'Troponin',
    effect: 'false-negative',
    magnitude: 'significant',
    mechanism: 'Biotin interferes with streptavidin-biotin immunoassays',
    recommendation: 'Hold biotin for 48-72 hours; can miss acute MI diagnosis',
    timing: '48-72 hours'
  },
  {
    drug: 'ace inhibitors',
    labTest: 'Potassium',
    effect: 'increase',
    magnitude: 'significant',
    mechanism: 'Decreased aldosterone leads to potassium retention',
    recommendation: 'Monitor potassium regularly; more frequent in renal impairment'
  },
  {
    drug: 'statins',
    labTest: 'LFTs (ALT, AST)',
    effect: 'increase',
    magnitude: 'moderate',
    mechanism: 'Hepatocyte stress from HMG-CoA reductase inhibition',
    recommendation: 'Check LFTs at baseline; discontinue if ALT/AST >3x ULN persistently'
  },
  {
    drug: 'statins',
    labTest: 'CK (Creatine Kinase)',
    effect: 'increase',
    magnitude: 'moderate',
    mechanism: 'Myopathy/rhabdomyolysis',
    recommendation: 'Check CK if muscle symptoms; discontinue if CK >10x ULN'
  },
  {
    drug: 'metformin',
    labTest: 'Vitamin B12',
    effect: 'decrease',
    magnitude: 'moderate',
    mechanism: 'Decreased absorption in terminal ileum',
    recommendation: 'Monitor B12 levels annually; supplement if deficient'
  },
  {
    drug: 'thiazide diuretics',
    labTest: 'Potassium',
    effect: 'decrease',
    magnitude: 'significant',
    mechanism: 'Increased urinary potassium excretion',
    recommendation: 'Monitor potassium; supplement or use potassium-sparing diuretic'
  },
  {
    drug: 'thiazide diuretics',
    labTest: 'Sodium',
    effect: 'decrease',
    magnitude: 'significant',
    mechanism: 'Impaired diluting ability of kidney',
    recommendation: 'Monitor sodium especially in elderly; hyponatremia risk'
  },
  {
    drug: 'thiazide diuretics',
    labTest: 'Uric acid',
    effect: 'increase',
    magnitude: 'moderate',
    mechanism: 'Decreased uric acid excretion',
    recommendation: 'May precipitate gout; consider alternative in gout history'
  },
  {
    drug: 'thiazide diuretics',
    labTest: 'Glucose',
    effect: 'increase',
    magnitude: 'moderate',
    mechanism: 'Hypokalemia impairs insulin secretion',
    recommendation: 'Monitor glucose; may worsen diabetes control'
  },
  {
    drug: 'loop diuretics',
    labTest: 'Potassium',
    effect: 'decrease',
    magnitude: 'significant',
    mechanism: 'Increased urinary potassium excretion',
    recommendation: 'Monitor potassium; supplement as needed'
  },
  {
    drug: 'loop diuretics',
    labTest: 'Magnesium',
    effect: 'decrease',
    magnitude: 'significant',
    mechanism: 'Increased urinary magnesium excretion',
    recommendation: 'Monitor magnesium; supplement if deficient'
  },
  {
    drug: 'corticosteroids',
    labTest: 'Glucose',
    effect: 'increase',
    magnitude: 'significant',
    mechanism: 'Increased gluconeogenesis, insulin resistance',
    recommendation: 'Monitor glucose; may need diabetes medication adjustment'
  },
  {
    drug: 'corticosteroids',
    labTest: 'WBC',
    effect: 'increase',
    magnitude: 'significant',
    mechanism: 'Demargination of neutrophils',
    recommendation: 'WBC elevation (15,000-20,000) expected; does not indicate infection'
  },
  {
    drug: 'heparin',
    labTest: 'Platelets',
    effect: 'decrease',
    magnitude: 'significant',
    mechanism: 'Heparin-induced thrombocytopenia (HIT)',
    recommendation: 'Monitor platelets days 4-14; stop if >50% drop or <100,000'
  },
  {
    drug: 'nsaids',
    labTest: 'Creatinine',
    effect: 'increase',
    magnitude: 'moderate',
    mechanism: 'Decreased renal prostaglandins cause afferent arteriole constriction',
    recommendation: 'Monitor renal function; avoid in CKD'
  },
  {
    drug: 'nsaids',
    labTest: 'Potassium',
    effect: 'increase',
    magnitude: 'moderate',
    mechanism: 'Decreased aldosterone secretion',
    recommendation: 'Monitor potassium especially with ACE-I/ARB'
  },
  {
    drug: 'allopurinol',
    labTest: 'Uric acid',
    effect: 'decrease',
    magnitude: 'significant',
    mechanism: 'Xanthine oxidase inhibition',
    recommendation: 'Target uric acid <6 mg/dL for gout management'
  },
  {
    drug: 'proton pump inhibitors',
    labTest: 'Magnesium',
    effect: 'decrease',
    magnitude: 'moderate',
    mechanism: 'Decreased intestinal magnesium absorption',
    recommendation: 'Monitor magnesium with long-term use (>1 year)'
  },
  {
    drug: 'proton pump inhibitors',
    labTest: 'Vitamin B12',
    effect: 'decrease',
    magnitude: 'moderate',
    mechanism: 'Decreased acid-dependent B12 absorption',
    recommendation: 'Monitor B12 with long-term use'
  },
  {
    drug: 'rifampin',
    labTest: 'Bilirubin',
    effect: 'interference',
    magnitude: 'minor',
    mechanism: 'Competes for bilirubin excretion; may falsely increase direct bilirubin',
    recommendation: 'Be aware of this interference when interpreting LFTs'
  },
  {
    drug: 'amiodarone',
    labTest: 'Thyroid function tests',
    effect: 'interference',
    magnitude: 'significant',
    mechanism: 'Contains iodine; inhibits T4 to T3 conversion; can cause hyper or hypothyroidism',
    recommendation: 'Check TFTs at baseline and every 6 months'
  },
  {
    drug: 'phenytoin',
    labTest: 'Vitamin D/Calcium',
    effect: 'decrease',
    magnitude: 'moderate',
    mechanism: 'Induces vitamin D metabolism',
    recommendation: 'Monitor vitamin D and calcium; supplement as needed'
  },
  {
    drug: 'valproic acid',
    labTest: 'Ammonia',
    effect: 'increase',
    magnitude: 'significant',
    mechanism: 'Inhibits urea cycle enzymes',
    recommendation: 'Check ammonia if encephalopathy symptoms (can occur with normal LFTs)'
  },
  {
    drug: 'spironolactone',
    labTest: 'Potassium',
    effect: 'increase',
    magnitude: 'significant',
    mechanism: 'Aldosterone antagonist causes potassium retention',
    recommendation: 'Monitor potassium especially with ACE-I/ARB or renal impairment'
  },
  {
    drug: 'spironolactone',
    labTest: 'Digoxin level',
    effect: 'interference',
    magnitude: 'moderate',
    mechanism: 'Cross-reactivity with some digoxin immunoassays',
    recommendation: 'Use assay-specific reference range'
  }
];

// Anticholinergic Burden Scale Database
const ANTICHOLINERGIC_BURDEN: Record<string, { score: 1 | 2 | 3; category: string }> = {
  // Score 3 - High anticholinergic activity
  'amitriptyline': { score: 3, category: 'Tricyclic antidepressant' },
  'nortriptyline': { score: 3, category: 'Tricyclic antidepressant' },
  'imipramine': { score: 3, category: 'Tricyclic antidepressant' },
  'doxepin': { score: 3, category: 'Tricyclic antidepressant' },
  'clomipramine': { score: 3, category: 'Tricyclic antidepressant' },
  'hydroxyzine': { score: 3, category: 'Antihistamine' },
  'diphenhydramine': { score: 3, category: 'Antihistamine' },
  'chlorpheniramine': { score: 3, category: 'Antihistamine' },
  'promethazine': { score: 3, category: 'Antihistamine' },
  'oxybutynin': { score: 3, category: 'Bladder antispasmodic' },
  'tolterodine': { score: 3, category: 'Bladder antispasmodic' },
  'benztropine': { score: 3, category: 'Antiparkinson' },
  'trihexyphenidyl': { score: 3, category: 'Antiparkinson' },
  'clozapine': { score: 3, category: 'Antipsychotic' },
  'olanzapine': { score: 3, category: 'Antipsychotic' },
  'thioridazine': { score: 3, category: 'Antipsychotic' },
  'chlorpromazine': { score: 3, category: 'Antipsychotic' },

  // Score 2 - Moderate anticholinergic activity
  'cyclobenzaprine': { score: 2, category: 'Muscle relaxant' },
  'loperamide': { score: 2, category: 'Antidiarrheal' },
  'cetirizine': { score: 2, category: 'Antihistamine' },
  'loratadine': { score: 2, category: 'Antihistamine' },
  'nefazodone': { score: 2, category: 'Antidepressant' },
  'meperidine': { score: 2, category: 'Opioid' },
  'quetiapine': { score: 2, category: 'Antipsychotic' },
  'paroxetine': { score: 2, category: 'SSRI' },

  // Score 1 - Low anticholinergic activity
  'alprazolam': { score: 1, category: 'Benzodiazepine' },
  'codeine': { score: 1, category: 'Opioid' },
  'colchicine': { score: 1, category: 'Gout' },
  'furosemide': { score: 1, category: 'Diuretic' },
  'digoxin': { score: 1, category: 'Cardiac glycoside' },
  'haloperidol': { score: 1, category: 'Antipsychotic' },
  'hydralazine': { score: 1, category: 'Antihypertensive' },
  'isosorbide': { score: 1, category: 'Nitrate' },
  'prednisone': { score: 1, category: 'Corticosteroid' },
  'ranitidine': { score: 1, category: 'H2 blocker' },
  'risperidone': { score: 1, category: 'Antipsychotic' },
  'theophylline': { score: 1, category: 'Bronchodilator' },
  'trazodone': { score: 1, category: 'Antidepressant' },
  'warfarin': { score: 1, category: 'Anticoagulant' }
};

// Beers Criteria Database (2023 Update)
const BEERS_CRITERIA: {
  medication: string;
  concern: string;
  recommendation: string;
  qualityOfEvidence: 'High' | 'Moderate' | 'Low';
  strengthOfRecommendation: 'Strong' | 'Weak';
  alternatives?: string[];
}[] = [
  {
    medication: 'diphenhydramine',
    concern: 'Highly anticholinergic; causes sedation, confusion, falls, constipation, urinary retention',
    recommendation: 'Avoid as sleep aid. Avoid in delirium or dementia.',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['melatonin', 'trazodone']
  },
  {
    medication: 'hydroxyzine',
    concern: 'Highly anticholinergic; causes sedation and confusion',
    recommendation: 'Avoid',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['cetirizine', 'loratadine']
  },
  {
    medication: 'amitriptyline',
    concern: 'Highly anticholinergic, sedating, orthostatic hypotension',
    recommendation: 'Avoid',
    qualityOfEvidence: 'High',
    strengthOfRecommendation: 'Strong',
    alternatives: ['nortriptyline (if TCA needed)', 'duloxetine', 'gabapentin']
  },
  {
    medication: 'benzodiazepines',
    concern: 'Increased sensitivity; increased risk of falls, fractures, cognitive impairment, delirium',
    recommendation: 'Avoid for insomnia, agitation, delirium. May be appropriate for seizures, severe anxiety.',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['melatonin', 'trazodone', 'mirtazapine']
  },
  {
    medication: 'non-benzodiazepine hypnotics',
    concern: 'Z-drugs (zolpidem, zaleplon, eszopiclone) have similar risks to benzodiazepines',
    recommendation: 'Avoid',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['CBT for insomnia', 'melatonin']
  },
  {
    medication: 'opioids',
    concern: 'Increased risk of falls, fractures, respiratory depression, constipation',
    recommendation: 'Avoid chronic use. Use caution with any use.',
    qualityOfEvidence: 'High',
    strengthOfRecommendation: 'Strong',
    alternatives: ['acetaminophen', 'topical NSAIDs', 'duloxetine for neuropathic pain']
  },
  {
    medication: 'muscle relaxants',
    concern: 'Most are poorly tolerated (sedation, anticholinergic) and minimally effective',
    recommendation: 'Avoid',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['physical therapy', 'topical treatments']
  },
  {
    medication: 'nsaids',
    concern: 'GI bleeding, AKI, fluid retention, hypertension; risk increases with age',
    recommendation: 'Avoid chronic use. Use caution in CKD, heart failure, on anticoagulants.',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['acetaminophen', 'topical NSAIDs']
  },
  {
    medication: 'metoclopramide',
    concern: 'Extrapyramidal effects including tardive dyskinesia',
    recommendation: 'Avoid unless for gastroparesis. Max 12 weeks.',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['ondansetron', 'domperidone (if available)']
  },
  {
    medication: 'proton pump inhibitors',
    concern: 'C. difficile, bone loss, vitamin B12 deficiency, hypomagnesemia',
    recommendation: 'Avoid >8 weeks unless high risk. Use lowest effective dose.',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['H2 blockers', 'lifestyle modifications']
  },
  {
    medication: 'sulfonylureas (long-acting)',
    concern: 'Glimepiride, glyburide: higher risk of prolonged hypoglycemia',
    recommendation: 'Avoid glyburide. Use short-acting if sulfonylurea needed.',
    qualityOfEvidence: 'High',
    strengthOfRecommendation: 'Strong',
    alternatives: ['metformin', 'glipizide', 'SGLT2 inhibitors', 'GLP-1 agonists']
  },
  {
    medication: 'nitrofurantoin',
    concern: 'Pulmonary toxicity, hepatotoxicity; reduced efficacy in CKD',
    recommendation: 'Avoid if CrCl <30 mL/min. Avoid long-term suppression.',
    qualityOfEvidence: 'Low',
    strengthOfRecommendation: 'Strong',
    alternatives: ['trimethoprim-sulfamethoxazole', 'fosfomycin']
  },
  {
    medication: 'digoxin',
    concern: 'Decreased renal clearance; toxicity risk',
    recommendation: 'Avoid doses >0.125 mg/day. Monitor levels.',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong'
  },
  {
    medication: 'peripheral alpha-1 blockers',
    concern: 'Doxazosin, prazosin, terazosin: orthostatic hypotension, falls',
    recommendation: 'Avoid as antihypertensive',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['tamsulosin for BPH', 'other antihypertensives']
  },
  {
    medication: 'clonidine',
    concern: 'CNS adverse effects; orthostatic hypotension, bradycardia',
    recommendation: 'Avoid as first-line antihypertensive',
    qualityOfEvidence: 'Low',
    strengthOfRecommendation: 'Strong',
    alternatives: ['other antihypertensives']
  },
  {
    medication: 'antipsychotics',
    concern: 'Increased mortality in dementia; increased stroke risk',
    recommendation: 'Avoid for behavioral problems of dementia unless non-pharmacologic failed',
    qualityOfEvidence: 'Moderate',
    strengthOfRecommendation: 'Strong',
    alternatives: ['non-pharmacologic interventions first']
  }
];

// STOPP/START Criteria (Simplified)
const STOPP_CRITERIA: {
  criterion: string;
  medications: string[];
  condition?: string;
  recommendation: string;
}[] = [
  {
    criterion: 'STOPP A1',
    medications: ['digoxin'],
    condition: 'Heart failure with preserved ejection fraction',
    recommendation: 'No evidence of benefit in HFpEF; risk of toxicity'
  },
  {
    criterion: 'STOPP A3',
    medications: ['diltiazem', 'verapamil'],
    condition: 'Heart failure (NYHA III-IV)',
    recommendation: 'May worsen heart failure due to negative inotropic effect'
  },
  {
    criterion: 'STOPP B1',
    medications: ['aspirin'],
    condition: 'No history of CVD',
    recommendation: 'Primary prevention with aspirin has limited benefit vs bleeding risk in elderly'
  },
  {
    criterion: 'STOPP B5',
    medications: ['aspirin', 'clopidogrel', 'warfarin', 'rivaroxaban', 'apixaban', 'dabigatran'],
    condition: 'Dual/triple antithrombotic without clear indication',
    recommendation: 'High bleeding risk; assess if all agents are necessary'
  },
  {
    criterion: 'STOPP C1',
    medications: ['aspirin', 'nsaids'],
    condition: 'History of peptic ulcer without PPI',
    recommendation: 'Risk of recurrent ulcer bleeding'
  },
  {
    criterion: 'STOPP D1',
    medications: ['tricyclic antidepressants'],
    condition: 'Dementia or delirium',
    recommendation: 'Worsens cognitive impairment'
  },
  {
    criterion: 'STOPP D5',
    medications: ['benzodiazepines'],
    condition: 'Any elderly patient >4 weeks',
    recommendation: 'Risk of prolonged sedation, confusion, falls, amnesia'
  },
  {
    criterion: 'STOPP F1',
    medications: ['nsaids'],
    condition: 'CKD stage 3-5',
    recommendation: 'Risk of acute kidney injury'
  },
  {
    criterion: 'STOPP G1',
    medications: ['bladder antimuscarinics'],
    condition: 'Dementia or cognitive impairment',
    recommendation: 'Increased risk of confusion and agitation'
  },
  {
    criterion: 'STOPP H2',
    medications: ['corticosteroids'],
    condition: 'Long-term without osteoporosis prevention',
    recommendation: 'High risk of fractures; needs calcium, vitamin D, and bisphosphonate'
  }
];

const START_CRITERIA: {
  indication: string;
  recommendedMedication: string;
  reason: string;
}[] = [
  {
    indication: 'Atrial fibrillation',
    recommendedMedication: 'Anticoagulant (warfarin or DOAC)',
    reason: 'Reduces stroke risk by 60-70%'
  },
  {
    indication: 'Coronary artery disease',
    recommendedMedication: 'Statin',
    reason: 'Secondary prevention reduces cardiovascular events'
  },
  {
    indication: 'Heart failure with reduced EF',
    recommendedMedication: 'ACE inhibitor or ARB',
    reason: 'Reduces mortality and hospitalizations'
  },
  {
    indication: 'Heart failure with reduced EF',
    recommendedMedication: 'Beta-blocker (bisoprolol, carvedilol, metoprolol succinate)',
    reason: 'Reduces mortality in stable HFrEF'
  },
  {
    indication: 'Osteoporosis or fragility fracture',
    recommendedMedication: 'Bisphosphonate, vitamin D, calcium',
    reason: 'Reduces fracture risk'
  },
  {
    indication: 'Chronic systolic heart failure',
    recommendedMedication: 'Mineralocorticoid receptor antagonist',
    reason: 'Mortality benefit when added to ACE-I and beta-blocker'
  },
  {
    indication: 'Type 2 diabetes with nephropathy',
    recommendedMedication: 'ACE inhibitor or ARB',
    reason: 'Reduces progression of nephropathy'
  },
  {
    indication: 'Diabetes with CV disease',
    recommendedMedication: 'SGLT2 inhibitor',
    reason: 'Reduces cardiovascular and heart failure events'
  },
  {
    indication: 'COPD with moderate-severe symptoms',
    recommendedMedication: 'LABA/LAMA',
    reason: 'Improves symptoms and reduces exacerbations'
  },
  {
    indication: 'Depression lasting >2 weeks',
    recommendedMedication: 'Antidepressant',
    reason: 'Effective treatment for moderate-severe depression'
  }
];

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class AdvancedPharmacyAIService {
  /**
   * Get Therapeutic Drug Monitoring guidance for a specific drug
   */
  getTDMGuidance(drugName: string, patientData?: PatientData): TDMGuidance {
    const drugKey = drugName.toLowerCase().trim();
    const tdmInfo = TDM_DATABASE[drugKey];

    if (!tdmInfo) {
      return {
        drugName,
        requiresTDM: false,
        therapeuticRange: { min: 0, max: 0, unit: 'N/A' },
        sampleTiming: {
          type: 'random',
          description: 'No specific TDM protocol for this medication',
          timing: 'N/A'
        },
        frequency: 'N/A',
        adjustmentFactors: [],
        toxicitySigns: [],
        monitoringParameters: ['Consult pharmacy for specific monitoring recommendations'],
        clinicalPearls: ['This drug is not typically monitored with serum levels']
      };
    }

    const guidance: TDMGuidance = {
      drugName,
      ...tdmInfo
    };

    // Add patient-specific adjustments
    if (patientData) {
      const additionalFactors: string[] = [];

      if (patientData.age && patientData.age >= 65) {
        additionalFactors.push('Elderly patient: Consider lower target range and more frequent monitoring');
      }

      if (patientData.renalFunction && patientData.renalFunction !== 'normal') {
        additionalFactors.push(`Renal impairment (${patientData.renalFunction}): May require extended interval or dose reduction`);
      }

      if (patientData.hepaticFunction && patientData.hepaticFunction !== 'normal') {
        additionalFactors.push(`Hepatic impairment (${patientData.hepaticFunction}): May affect drug metabolism`);
      }

      if (patientData.weight && patientData.weight > 100) {
        additionalFactors.push('Obesity: May require weight-based dosing adjustments');
      }

      if (additionalFactors.length > 0) {
        guidance.adjustmentFactors = [...guidance.adjustmentFactors, ...additionalFactors];
      }
    }

    return guidance;
  }

  /**
   * Check for CYP450 enzyme interactions between medications
   */
  getCYP450Interactions(medications: string[]): CYP450Result {
    const normalizedMeds = medications.map(m => m.toLowerCase().trim());
    const interactions: CYP450Result['interactions'] = [];
    const prodrugsAffected: CYP450Result['prodrugsAffected'] = [];
    const recommendations: string[] = [];

    // Check each enzyme system
    for (const [enzyme, data] of Object.entries(CYP450_DATABASE)) {
      const enzymeSubstrates = normalizedMeds.filter(m =>
        data.substrates.some(s => m.includes(s) || s.includes(m))
      );
      const enzymeInhibitors = normalizedMeds.flatMap(m => {
        const match = data.inhibitors.find(i => m.includes(i.drug) || i.drug.includes(m));
        return match ? [{ drug: m, ...match }] : [];
      });
      const enzymeInducers = normalizedMeds.flatMap(m => {
        const match = data.inducers.find(i => m.includes(i.drug) || i.drug.includes(m));
        return match ? [{ drug: m, ...match }] : [];
      });

      // Check substrate-inhibitor interactions
      for (const substrate of enzymeSubstrates) {
        for (const inhibitor of enzymeInhibitors) {
          if (substrate !== inhibitor.drug) {
            const significance = inhibitor.strength === 'strong' ? 'major' :
              inhibitor.strength === 'moderate' ? 'moderate' : 'minor';

            interactions.push({
              enzyme,
              drug1: inhibitor.drug,
              drug1Role: 'inhibitor',
              drug2: substrate,
              drug2Role: 'substrate',
              clinicalSignificance: significance,
              effect: `${inhibitor.drug} (${inhibitor.strength} ${enzyme} inhibitor) may increase levels of ${substrate}`,
              recommendation: significance === 'major'
                ? `Consider alternative to ${substrate} or reduce dose by 50-75%`
                : `Monitor for increased ${substrate} effects`
            });
          }
        }

        // Check substrate-inducer interactions
        for (const inducer of enzymeInducers) {
          if (substrate !== inducer.drug) {
            const significance = inducer.strength === 'strong' ? 'major' :
              inducer.strength === 'moderate' ? 'moderate' : 'minor';

            interactions.push({
              enzyme,
              drug1: inducer.drug,
              drug1Role: 'inducer',
              drug2: substrate,
              drug2Role: 'substrate',
              clinicalSignificance: significance,
              effect: `${inducer.drug} (${inducer.strength} ${enzyme} inducer) may decrease levels of ${substrate}`,
              recommendation: significance === 'major'
                ? `Consider alternative to ${substrate} or increase dose`
                : `Monitor for reduced ${substrate} efficacy`
            });
          }
        }
      }
    }

    // Check prodrug effects
    for (const med of normalizedMeds) {
      for (const [prodrug, info] of Object.entries(PRODRUG_DATABASE)) {
        if (med.includes(prodrug) || prodrug.includes(med)) {
          // Check if any other medication inhibits the activating enzyme
          const enzymeData = CYP450_DATABASE[info.activatingEnzyme];
          if (enzymeData) {
            const inhibitors = normalizedMeds.filter(m =>
              m !== med && enzymeData.inhibitors.some(i => m.includes(i.drug) || i.drug.includes(m))
            );

            for (const inhibitor of inhibitors) {
              prodrugsAffected.push({
                prodrug: med,
                activeMetabolite: info.activeMetabolite,
                enzyme: info.activatingEnzyme,
                impact: `${inhibitor} may reduce conversion of ${prodrug} to active ${info.activeMetabolite}`,
                recommendation: info.clinicalImplication
              });
            }
          }
        }
      }
    }

    // Generate recommendations
    const majorCount = interactions.filter(i => i.clinicalSignificance === 'major').length;
    const moderateCount = interactions.filter(i => i.clinicalSignificance === 'moderate').length;

    if (majorCount > 0) {
      recommendations.push('ALERT: Major CYP450 interactions detected - clinical review required');
    }
    if (prodrugsAffected.length > 0) {
      recommendations.push('Prodrug activation may be affected - consider alternative medications');
    }
    if (moderateCount > 2) {
      recommendations.push('Multiple moderate interactions - consider simplifying regimen');
    }

    return {
      interactions,
      prodrugsAffected,
      summary: {
        majorInteractions: majorCount,
        moderateInteractions: moderateCount,
        minorInteractions: interactions.filter(i => i.clinicalSignificance === 'minor').length,
        totalRisk: majorCount > 0 ? 'high' : moderateCount > 2 ? 'moderate' : 'low'
      },
      recommendations
    };
  }

  /**
   * Suggest cost-effective alternatives for a medication
   */
  suggestAlternatives(drugName: string, indication?: string): {
    originalDrug: string;
    alternatives: DrugAlternative[];
    formularyRecommendation: string;
    costSavingsEstimate: string;
  } {
    const drugKey = drugName.toLowerCase().trim();
    let alternatives: DrugAlternative[] = [];

    // Search for alternatives
    for (const [key, alts] of Object.entries(ALTERNATIVES_DATABASE)) {
      if (drugKey.includes(key) || key.includes(drugKey)) {
        alternatives = alts;
        break;
      }
    }

    if (alternatives.length === 0) {
      return {
        originalDrug: drugName,
        alternatives: [],
        formularyRecommendation: 'No alternatives found in database. Consult pharmacy for therapeutic alternatives.',
        costSavingsEstimate: 'Unable to estimate'
      };
    }

    // Sort by cost (cheapest first) and formulary status
    alternatives.sort((a, b) => {
      const costOrder = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4, '$$$$$': 5 };
      const statusOrder = { 'preferred': 1, 'non-preferred': 2, 'not-listed': 3 };
      return (statusOrder[a.formularyStatus] - statusOrder[b.formularyStatus]) ||
        (costOrder[a.relativeCoast] - costOrder[b.relativeCoast]);
    });

    const preferredOption = alternatives.find(a => a.formularyStatus === 'preferred');

    return {
      originalDrug: drugName,
      alternatives,
      formularyRecommendation: preferredOption
        ? `Consider ${preferredOption.drugName} as preferred formulary alternative`
        : 'No preferred formulary option available - prior authorization may be required',
      costSavingsEstimate: preferredOption && preferredOption.relativeCoast === '$'
        ? 'Significant cost savings (>50%) expected with generic alternative'
        : 'Moderate cost savings possible with therapeutic substitution'
    };
  }

  /**
   * Calculate renal dose adjustment using Cockcroft-Gault equation
   */
  calculateRenalDose(
    drugName: string,
    creatinine: number, // mg/dL
    age: number,
    weight: number, // kg
    gender: 'male' | 'female'
  ): RenalDoseResult {
    // Cockcroft-Gault equation
    let crcl = ((140 - age) * weight) / (72 * creatinine);
    if (gender === 'female') {
      crcl *= 0.85;
    }
    crcl = Math.round(crcl * 10) / 10;

    // Determine renal stage
    let renalStage: string;
    if (crcl >= 90) renalStage = 'Normal (Stage 1)';
    else if (crcl >= 60) renalStage = 'Mild impairment (Stage 2)';
    else if (crcl >= 30) renalStage = 'Moderate impairment (Stage 3)';
    else if (crcl >= 15) renalStage = 'Severe impairment (Stage 4)';
    else renalStage = 'End-stage (Stage 5/Dialysis)';

    // Drug-specific dose adjustments
    const drugLower = drugName.toLowerCase().trim();
    const doseAdjustments = this.getDrugRenalAdjustment(drugLower, crcl);

    return {
      creatinineClearance: crcl,
      creatinineClearanceUnit: 'mL/min',
      calculationMethod: 'Cockcroft-Gault equation',
      renalStage,
      originalDose: doseAdjustments.originalDose,
      adjustedDose: doseAdjustments.adjustedDose,
      frequencyAdjustment: doseAdjustments.frequencyAdjustment,
      monitoringRecommendations: doseAdjustments.monitoring,
      warnings: doseAdjustments.warnings,
      dialysisConsiderations: crcl < 15 ? doseAdjustments.dialysis : undefined
    };
  }

  private getDrugRenalAdjustment(drug: string, crcl: number): {
    originalDose: string;
    adjustedDose: string;
    frequencyAdjustment: string;
    monitoring: string[];
    warnings: string[];
    dialysis?: string;
  } {
    // Drug-specific renal dosing database
    const renalDosing: Record<string, (crcl: number) => {
      originalDose: string;
      adjustedDose: string;
      frequencyAdjustment: string;
      monitoring: string[];
      warnings: string[];
      dialysis?: string;
    }> = {
      'metformin': (crcl) => ({
        originalDose: '500-1000mg twice daily',
        adjustedDose: crcl >= 45 ? '500-1000mg twice daily (no adjustment)'
          : crcl >= 30 ? '500mg twice daily (max 1000mg/day)'
          : 'CONTRAINDICATED',
        frequencyAdjustment: crcl >= 45 ? 'No change' : crcl >= 30 ? 'Reduce max dose' : 'Do not use',
        monitoring: ['Serum creatinine every 3-6 months', 'Signs of lactic acidosis'],
        warnings: crcl < 30 ? ['CONTRAINDICATED in severe renal impairment'] : [],
        dialysis: 'Contraindicated; dialyzable but risk too high'
      }),
      'gabapentin': (crcl) => ({
        originalDose: '300-600mg three times daily',
        adjustedDose: crcl >= 60 ? '300-600mg TID'
          : crcl >= 30 ? '200-300mg TID or 300-400mg BID'
          : crcl >= 15 ? '200-300mg daily or BID'
          : '100-300mg after each dialysis',
        frequencyAdjustment: crcl >= 60 ? 'No change'
          : crcl >= 30 ? 'Reduce dose or frequency'
          : 'Once daily or less frequent',
        monitoring: ['CNS side effects (drowsiness)', 'Dose-related toxicity'],
        warnings: [],
        dialysis: 'Hemodialyzable; give supplemental dose post-dialysis'
      }),
      'vancomycin': (crcl) => ({
        originalDose: '15-20mg/kg every 8-12 hours',
        adjustedDose: crcl >= 50 ? '15-20mg/kg q8-12h'
          : crcl >= 20 ? '15-20mg/kg q24h'
          : crcl >= 10 ? '15-20mg/kg q24-48h'
          : '15-20mg/kg q48-72h (level-guided)',
        frequencyAdjustment: crcl >= 50 ? 'Standard interval'
          : crcl >= 20 ? 'Every 24 hours'
          : 'Extended interval based on levels',
        monitoring: ['Trough levels before 4th dose', 'Serum creatinine daily', 'BUN'],
        warnings: ['Nephrotoxic - monitor renal function closely'],
        dialysis: 'Give loading dose; redose based on levels post-dialysis'
      }),
      'enoxaparin': (crcl) => ({
        originalDose: '1mg/kg twice daily or 1.5mg/kg once daily',
        adjustedDose: crcl >= 30 ? 'No adjustment needed'
          : '1mg/kg ONCE daily',
        frequencyAdjustment: crcl >= 30 ? 'No change' : 'Once daily only',
        monitoring: ['Anti-Xa levels if prolonged use', 'Bleeding signs'],
        warnings: crcl < 30 ? ['Increased bleeding risk', 'Consider UFH as alternative'] : [],
        dialysis: 'Not recommended; use UFH instead'
      }),
      'ciprofloxacin': (crcl) => ({
        originalDose: '500-750mg twice daily',
        adjustedDose: crcl >= 30 ? 'No adjustment needed'
          : crcl >= 5 ? '250-500mg every 12-18 hours'
          : '250-500mg every 24 hours',
        frequencyAdjustment: crcl >= 30 ? 'No change' : 'Extended interval',
        monitoring: ['CNS effects', 'QT prolongation'],
        warnings: [],
        dialysis: 'Moderately dialyzable; give dose after dialysis'
      }),
      'digoxin': (crcl) => ({
        originalDose: '0.125-0.25mg once daily',
        adjustedDose: crcl >= 50 ? '0.125-0.25mg daily'
          : crcl >= 20 ? '0.0625-0.125mg daily'
          : '0.0625mg every other day or 0.125mg twice weekly',
        frequencyAdjustment: crcl >= 50 ? 'Daily' : crcl >= 20 ? 'Daily with reduced dose' : 'Every other day',
        monitoring: ['Digoxin levels', 'Potassium', 'Magnesium', 'Heart rate'],
        warnings: ['Very narrow therapeutic index', 'Increased toxicity risk in renal impairment'],
        dialysis: 'Not dialyzable; levels not affected by HD'
      }),
      'allopurinol': (crcl) => ({
        originalDose: '100-300mg daily',
        adjustedDose: crcl >= 60 ? 'No adjustment'
          : crcl >= 40 ? 'Max 200mg daily'
          : crcl >= 20 ? 'Max 100mg daily'
          : '100mg every 2-3 days',
        frequencyAdjustment: 'Reduce dose based on CrCl',
        monitoring: ['Uric acid levels', 'Rash (SJS risk)'],
        warnings: ['Start low and titrate slowly', 'Higher risk of hypersensitivity in renal impairment'],
        dialysis: 'Dialyzable; give dose post-dialysis'
      })
    };

    const adjustmentFn = renalDosing[drug];
    if (adjustmentFn) {
      return adjustmentFn(crcl);
    }

    // Generic response for unknown drugs
    return {
      originalDose: 'Refer to prescribing information',
      adjustedDose: crcl >= 60 ? 'Likely no adjustment needed'
        : crcl >= 30 ? 'May require dose reduction'
        : 'Significant dose reduction likely required',
      frequencyAdjustment: crcl >= 60 ? 'Likely no change' : 'May need extended interval',
      monitoring: [
        'Drug levels if available',
        'Serum creatinine',
        'Clinical response',
        'Signs of toxicity'
      ],
      warnings: ['Consult pharmacy for specific renal dosing recommendations'],
      dialysis: 'Consult pharmacy for dialysis-specific dosing'
    };
  }

  /**
   * Check IV compatibility between two drugs
   */
  checkIVCompatibility(drug1: string, drug2: string, solution?: string): IVCompatibilityResult {
    const d1 = drug1.toLowerCase().trim();
    const d2 = drug2.toLowerCase().trim();
    const sol = solution?.toLowerCase().trim();

    let ysiteCompatible = true;
    let ysiteNotes = 'No specific data found; check with pharmacy';
    let admixtureCompatible = true;
    let admixtureNotes = 'No specific data found; check with pharmacy';
    let stability = 'Unknown';
    const physicalChanges: string[] = [];
    const recommendations: string[] = [];

    // Check database
    const drug1Data = IV_COMPATIBILITY_DATABASE[d1];
    const drug2Data = IV_COMPATIBILITY_DATABASE[d2];

    if (drug1Data && drug1Data[d2]) {
      ysiteCompatible = drug1Data[d2].compatible;
      ysiteNotes = drug1Data[d2].notes;
      stability = drug1Data[d2].stability || 'Not specified';
      admixtureCompatible = drug1Data[d2].compatible;
      admixtureNotes = drug1Data[d2].notes;

      if (!ysiteCompatible) {
        physicalChanges.push('Precipitation or color change expected');
        recommendations.push(`Do not mix ${drug1} and ${drug2} - administer separately`);
      }
    } else if (drug2Data && drug2Data[d1]) {
      ysiteCompatible = drug2Data[d1].compatible;
      ysiteNotes = drug2Data[d1].notes;
      stability = drug2Data[d1].stability || 'Not specified';
      admixtureCompatible = drug2Data[d1].compatible;
      admixtureNotes = drug2Data[d1].notes;

      if (!ysiteCompatible) {
        physicalChanges.push('Precipitation or color change expected');
        recommendations.push(`Do not mix ${drug1} and ${drug2} - administer separately`);
      }
    }

    // Check solution compatibility
    if (sol) {
      if (drug1Data && drug1Data[sol]) {
        if (!drug1Data[sol].compatible) {
          admixtureCompatible = false;
          admixtureNotes = `${drug1}: ${drug1Data[sol].notes}`;
          recommendations.push(`${drug1} is not compatible with ${solution}`);
        }
      }
      if (drug2Data && drug2Data[sol]) {
        if (!drug2Data[sol].compatible) {
          admixtureCompatible = false;
          admixtureNotes += `; ${drug2}: ${drug2Data[sol].notes}`;
          recommendations.push(`${drug2} is not compatible with ${solution}`);
        }
      }
    }

    // General recommendations
    if (ysiteCompatible && admixtureCompatible) {
      recommendations.push('Compatible for Y-site administration');
      recommendations.push('Always verify with current references before mixing');
    }

    return {
      drug1,
      drug2,
      solution,
      ysite: {
        compatible: ysiteCompatible,
        stability,
        notes: ysiteNotes
      },
      admixture: {
        compatible: admixtureCompatible,
        stability,
        notes: admixtureNotes
      },
      physicalChanges,
      recommendations,
      references: [
        'Trissel\'s Handbook on Injectable Drugs',
        'Micromedex IV Compatibility',
        'King Guide to Parenteral Admixtures'
      ]
    };
  }

  /**
   * Check for drug-lab test interactions
   */
  checkLabInteractions(medications: string[], labTests: string[]): {
    interactions: LabInteraction[];
    summary: string;
    recommendations: string[];
  } {
    const normalizedMeds = medications.map(m => m.toLowerCase().trim());
    const normalizedTests = labTests.map(t => t.toLowerCase().trim());
    const interactions: LabInteraction[] = [];

    for (const entry of DRUG_LAB_INTERACTIONS) {
      const drugMatch = normalizedMeds.some(m =>
        m.includes(entry.drug) || entry.drug.includes(m)
      );
      const testMatch = normalizedTests.some(t =>
        entry.labTest.toLowerCase().includes(t) || t.includes(entry.labTest.toLowerCase())
      );

      if (drugMatch && testMatch) {
        interactions.push({
          medication: entry.drug,
          labTest: entry.labTest,
          effect: entry.effect,
          magnitude: entry.magnitude,
          mechanism: entry.mechanism,
          clinicalRecommendation: entry.recommendation,
          timing: entry.timing
        });
      }
    }

    // Also check for all interactions for each medication (regardless of test specified)
    for (const med of normalizedMeds) {
      const medInteractions = DRUG_LAB_INTERACTIONS.filter(entry =>
        med.includes(entry.drug) || entry.drug.includes(med)
      );

      for (const entry of medInteractions) {
        // Don't add duplicates
        if (!interactions.find(i => i.medication === entry.drug && i.labTest === entry.labTest)) {
          interactions.push({
            medication: entry.drug,
            labTest: entry.labTest,
            effect: entry.effect,
            magnitude: entry.magnitude,
            mechanism: entry.mechanism,
            clinicalRecommendation: entry.recommendation,
            timing: entry.timing
          });
        }
      }
    }

    const significantCount = interactions.filter(i => i.magnitude === 'significant').length;
    const recommendations: string[] = [];

    if (significantCount > 0) {
      recommendations.push(`${significantCount} significant drug-lab interaction(s) detected`);
    }

    // Timing recommendations
    const biotinInteraction = interactions.find(i => i.medication === 'biotin');
    if (biotinInteraction) {
      recommendations.push('IMPORTANT: Hold biotin supplements 48-72 hours before laboratory testing');
    }

    return {
      interactions,
      summary: interactions.length === 0
        ? 'No significant drug-lab interactions identified'
        : `Found ${interactions.length} potential drug-lab interaction(s)`,
      recommendations
    };
  }

  /**
   * Assess polypharmacy risk for a patient's medication list
   */
  assessPolypharmacyRisk(medications: string[], patientAge: number): PolypharmacyRisk {
    const normalizedMeds = medications.map(m => m.toLowerCase().trim());

    // Calculate anticholinergic burden
    let acbScore = 0;
    const highRiskAcbDrugs: string[] = [];
    const acbSymptoms: string[] = [];

    for (const med of normalizedMeds) {
      for (const [drug, data] of Object.entries(ANTICHOLINERGIC_BURDEN)) {
        if (med.includes(drug) || drug.includes(med)) {
          acbScore += data.score;
          if (data.score >= 2) {
            highRiskAcbDrugs.push(`${med} (score: ${data.score})`);
          }
        }
      }
    }

    if (acbScore >= 3) {
      acbSymptoms.push('Cognitive impairment', 'Confusion', 'Dry mouth', 'Constipation', 'Urinary retention', 'Blurred vision');
    } else if (acbScore >= 2) {
      acbSymptoms.push('Dry mouth', 'Constipation', 'Possible cognitive effects');
    }

    // Calculate fall risk
    const fallRiskMeds = [
      'benzodiazepine', 'opioid', 'antipsychotic', 'antidepressant', 'antihistamine',
      'antihypertensive', 'diuretic', 'sedative', 'hypnotic', 'muscle relaxant'
    ];
    let fallRiskScore = 0;
    const contributingMeds: string[] = [];

    for (const med of normalizedMeds) {
      for (const category of fallRiskMeds) {
        if (med.includes(category) || this.isDrugInCategory(med, category)) {
          fallRiskScore += 1;
          contributingMeds.push(med);
          break;
        }
      }
    }

    // Age-related fall risk
    if (patientAge >= 75) fallRiskScore += 2;
    else if (patientAge >= 65) fallRiskScore += 1;

    // Check Beers Criteria violations
    const beersViolations: PolypharmacyRisk['beersCriteriaViolations'] = [];
    if (patientAge >= 65) {
      for (const med of normalizedMeds) {
        for (const criterion of BEERS_CRITERIA) {
          if (med.includes(criterion.medication) || criterion.medication.includes(med)) {
            beersViolations.push({
              medication: med,
              reason: criterion.concern,
              alternative: criterion.alternatives?.join(', '),
              recommendation: criterion.recommendation
            });
          }
        }
      }
    }

    // Check STOPP criteria
    const stoppViolations: PolypharmacyRisk['stoppCriteria'] = [];
    for (const med of normalizedMeds) {
      for (const criterion of STOPP_CRITERIA) {
        if (criterion.medications.some(m => med.includes(m) || m.includes(med))) {
          stoppViolations.push({
            medication: med,
            criterion: criterion.criterion,
            recommendation: criterion.recommendation
          });
        }
      }
    }

    // Check START criteria (potential missing medications)
    const startRecommendations: PolypharmacyRisk['startCriteria'] = [];
    // This would require condition data to implement properly

    // Check for duplicate therapy
    const duplicateTherapy: PolypharmacyRisk['duplicateTherapy'] = [];
    const classGroups: Record<string, string[]> = {
      'ppi': ['omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'rabeprazole'],
      'statin': ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin'],
      'ace_inhibitor': ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'benazepril'],
      'arb': ['losartan', 'valsartan', 'irbesartan', 'olmesartan', 'candesartan'],
      'ssri': ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram'],
      'benzodiazepine': ['lorazepam', 'alprazolam', 'diazepam', 'clonazepam', 'temazepam'],
      'nsaid': ['ibuprofen', 'naproxen', 'meloxicam', 'celecoxib', 'indomethacin', 'ketorolac']
    };

    for (const [className, drugs] of Object.entries(classGroups)) {
      const found = normalizedMeds.filter(m => drugs.some(d => m.includes(d) || d.includes(m)));
      if (found.length > 1) {
        duplicateTherapy.push({
          class: className.replace('_', ' ').toUpperCase(),
          medications: found,
          recommendation: `Patient is on multiple ${className.replace('_', ' ')}s - consider consolidating`
        });
      }
    }

    // Calculate overall risk score
    let overallRiskScore = 0;
    overallRiskScore += Math.min(acbScore * 5, 25); // Max 25 points from ACB
    overallRiskScore += Math.min(fallRiskScore * 5, 25); // Max 25 points from fall risk
    overallRiskScore += beersViolations.length * 5; // 5 points per Beers violation
    overallRiskScore += stoppViolations.length * 3; // 3 points per STOPP violation
    overallRiskScore += duplicateTherapy.length * 5; // 5 points per duplicate class
    overallRiskScore += medications.length > 10 ? 10 : medications.length > 5 ? 5 : 0; // Polypharmacy penalty

    let riskLevel: PolypharmacyRisk['riskLevel'];
    if (overallRiskScore >= 50) riskLevel = 'very-high';
    else if (overallRiskScore >= 30) riskLevel = 'high';
    else if (overallRiskScore >= 15) riskLevel = 'moderate';
    else riskLevel = 'low';

    // Generate recommendations
    const recommendations: string[] = [];
    if (medications.length > 10) {
      recommendations.push('Consider comprehensive medication review - patient on >10 medications');
    }
    if (acbScore >= 3) {
      recommendations.push('High anticholinergic burden - consider deprescribing or switching to lower ACB alternatives');
    }
    if (beersViolations.length > 0) {
      recommendations.push(`${beersViolations.length} potentially inappropriate medication(s) per Beers Criteria`);
    }
    if (duplicateTherapy.length > 0) {
      recommendations.push('Duplicate therapy detected - review for consolidation opportunities');
    }
    if (fallRiskScore >= 3) {
      recommendations.push('Elevated fall risk from medications - implement fall prevention strategies');
    }

    return {
      overallRiskScore,
      riskLevel,
      anticholinergicBurden: {
        score: acbScore,
        highRiskDrugs: highRiskAcbDrugs,
        symptoms: acbSymptoms
      },
      fallRisk: {
        score: fallRiskScore,
        contributingMedications: contributingMeds,
        recommendations: fallRiskScore >= 3
          ? ['Implement fall precautions', 'Review necessity of CNS-active medications', 'Consider physical therapy evaluation']
          : []
      },
      beersCriteriaViolations: beersViolations,
      stoppCriteria: stoppViolations,
      startCriteria: startRecommendations,
      duplicateTherapy,
      recommendations
    };
  }

  private isDrugInCategory(drug: string, category: string): boolean {
    const categoryDrugs: Record<string, string[]> = {
      'benzodiazepine': ['lorazepam', 'alprazolam', 'diazepam', 'clonazepam', 'temazepam', 'midazolam'],
      'opioid': ['morphine', 'hydrocodone', 'oxycodone', 'fentanyl', 'hydromorphone', 'tramadol', 'codeine'],
      'antipsychotic': ['haloperidol', 'risperidone', 'quetiapine', 'olanzapine', 'aripiprazole', 'ziprasidone'],
      'antidepressant': ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram', 'venlafaxine', 'duloxetine', 'bupropion', 'mirtazapine', 'trazodone'],
      'antihistamine': ['diphenhydramine', 'hydroxyzine', 'promethazine', 'meclizine', 'chlorpheniramine'],
      'antihypertensive': ['lisinopril', 'amlodipine', 'losartan', 'metoprolol', 'atenolol', 'carvedilol', 'hydralazine', 'clonidine'],
      'diuretic': ['furosemide', 'hydrochlorothiazide', 'bumetanide', 'torsemide', 'spironolactone'],
      'sedative': ['zolpidem', 'eszopiclone', 'zaleplon', 'ramelteon'],
      'hypnotic': ['zolpidem', 'eszopiclone', 'zaleplon', 'triazolam'],
      'muscle relaxant': ['cyclobenzaprine', 'methocarbamol', 'carisoprodol', 'baclofen', 'tizanidine']
    };

    const drugs = categoryDrugs[category];
    if (!drugs) return false;
    return drugs.some(d => drug.includes(d) || d.includes(drug));
  }

  /**
   * Get all TDM drugs in the database
   */
  getTDMDrugList(): string[] {
    return Object.keys(TDM_DATABASE);
  }

  /**
   * Get all CYP450 information for a specific drug
   */
  getDrugCYP450Profile(drugName: string): {
    drug: string;
    isSubstrate: { enzyme: string; }[];
    isInhibitor: { enzyme: string; strength: string; }[];
    isInducer: { enzyme: string; strength: string; }[];
    isProdrug: boolean;
    prodrugInfo?: {
      activeMetabolite: string;
      activatingEnzyme: string;
      clinicalImplication: string;
    };
  } {
    const drugLower = drugName.toLowerCase().trim();
    const isSubstrate: { enzyme: string }[] = [];
    const isInhibitor: { enzyme: string; strength: string }[] = [];
    const isInducer: { enzyme: string; strength: string }[] = [];

    for (const [enzyme, data] of Object.entries(CYP450_DATABASE)) {
      if (data.substrates.some(s => drugLower.includes(s) || s.includes(drugLower))) {
        isSubstrate.push({ enzyme });
      }
      const inhibitorMatch = data.inhibitors.find(i => drugLower.includes(i.drug) || i.drug.includes(drugLower));
      if (inhibitorMatch) {
        isInhibitor.push({ enzyme, strength: inhibitorMatch.strength });
      }
      const inducerMatch = data.inducers.find(i => drugLower.includes(i.drug) || i.drug.includes(drugLower));
      if (inducerMatch) {
        isInducer.push({ enzyme, strength: inducerMatch.strength });
      }
    }

    const prodrugInfo = Object.entries(PRODRUG_DATABASE).find(([p]) =>
      drugLower.includes(p) || p.includes(drugLower)
    );

    return {
      drug: drugName,
      isSubstrate,
      isInhibitor,
      isInducer,
      isProdrug: !!prodrugInfo,
      prodrugInfo: prodrugInfo ? prodrugInfo[1] : undefined
    };
  }
}

export const advancedPharmacyAIService = new AdvancedPharmacyAIService();
