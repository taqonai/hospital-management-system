"""
Comprehensive Drug Interaction Knowledge Base
Based on FDA drug interaction guidelines, clinical pharmacology references, and medical literature
"""

from typing import Dict, List, Any

# Severity levels for drug interactions
SEVERITY_LEVELS = {
    "CONTRAINDICATED": {
        "level": 5,
        "description": "Do not use together - potentially life-threatening",
        "color": "red",
        "action": "Avoid combination"
    },
    "SEVERE": {
        "level": 4,
        "description": "Potentially serious interaction - consider alternatives",
        "color": "red",
        "action": "Consider therapy modification"
    },
    "MODERATE": {
        "level": 3,
        "description": "Monitor closely - may require dose adjustment",
        "color": "orange",
        "action": "Monitor therapy"
    },
    "MINOR": {
        "level": 2,
        "description": "Minimal clinical significance",
        "color": "yellow",
        "action": "Monitor if symptomatic"
    },
    "UNKNOWN": {
        "level": 1,
        "description": "Interaction possible but not well documented",
        "color": "gray",
        "action": "Be aware"
    }
}

# Comprehensive drug database with classifications
DRUG_DATABASE: Dict[str, Dict[str, Any]] = {
    # Anticoagulants
    "warfarin": {
        "class": "Anticoagulant",
        "subclass": "Vitamin K Antagonist",
        "brand_names": ["Coumadin", "Jantoven"],
        "mechanism": "Inhibits vitamin K-dependent clotting factors",
        "common_uses": ["Atrial fibrillation", "DVT/PE", "Mechanical heart valves"],
        "monitoring": ["INR", "PT"],
        "therapeutic_range": "INR 2.0-3.0 (most indications)"
    },
    "rivaroxaban": {
        "class": "Anticoagulant",
        "subclass": "Direct Factor Xa Inhibitor",
        "brand_names": ["Xarelto"],
        "mechanism": "Direct factor Xa inhibition",
        "common_uses": ["AF", "DVT/PE", "VTE prophylaxis"],
        "monitoring": ["Anti-Xa levels (if needed)"],
    },
    "apixaban": {
        "class": "Anticoagulant",
        "subclass": "Direct Factor Xa Inhibitor",
        "brand_names": ["Eliquis"],
        "mechanism": "Direct factor Xa inhibition",
        "common_uses": ["AF", "DVT/PE", "VTE prophylaxis"],
    },
    "dabigatran": {
        "class": "Anticoagulant",
        "subclass": "Direct Thrombin Inhibitor",
        "brand_names": ["Pradaxa"],
        "mechanism": "Direct thrombin inhibition",
        "common_uses": ["AF", "DVT/PE"],
    },
    "heparin": {
        "class": "Anticoagulant",
        "subclass": "Unfractionated Heparin",
        "brand_names": ["Heparin Sodium"],
        "mechanism": "Enhances antithrombin III activity",
        "monitoring": ["aPTT", "Anti-Xa"],
    },
    "enoxaparin": {
        "class": "Anticoagulant",
        "subclass": "Low Molecular Weight Heparin",
        "brand_names": ["Lovenox"],
        "mechanism": "Factor Xa inhibition via antithrombin",
        "common_uses": ["DVT prophylaxis", "ACS", "DVT treatment"],
    },

    # Antiplatelets
    "aspirin": {
        "class": "Antiplatelet",
        "subclass": "COX Inhibitor",
        "brand_names": ["Bayer", "Ecotrin"],
        "mechanism": "Irreversible COX-1 inhibition",
        "common_uses": ["MI prevention", "Stroke prevention", "Pain relief"],
    },
    "clopidogrel": {
        "class": "Antiplatelet",
        "subclass": "P2Y12 Inhibitor",
        "brand_names": ["Plavix"],
        "mechanism": "Irreversible P2Y12 receptor inhibition",
        "common_uses": ["ACS", "Stent placement", "Stroke prevention"],
    },
    "prasugrel": {
        "class": "Antiplatelet",
        "subclass": "P2Y12 Inhibitor",
        "brand_names": ["Effient"],
        "mechanism": "Irreversible P2Y12 receptor inhibition",
    },
    "ticagrelor": {
        "class": "Antiplatelet",
        "subclass": "P2Y12 Inhibitor",
        "brand_names": ["Brilinta"],
        "mechanism": "Reversible P2Y12 receptor inhibition",
    },

    # NSAIDs
    "ibuprofen": {
        "class": "NSAID",
        "subclass": "Propionic Acid Derivative",
        "brand_names": ["Advil", "Motrin"],
        "mechanism": "COX-1 and COX-2 inhibition",
        "common_uses": ["Pain", "Inflammation", "Fever"],
    },
    "naproxen": {
        "class": "NSAID",
        "subclass": "Propionic Acid Derivative",
        "brand_names": ["Aleve", "Naprosyn"],
        "mechanism": "COX-1 and COX-2 inhibition",
    },
    "diclofenac": {
        "class": "NSAID",
        "subclass": "Acetic Acid Derivative",
        "brand_names": ["Voltaren", "Cataflam"],
        "mechanism": "COX-1 and COX-2 inhibition",
    },
    "celecoxib": {
        "class": "NSAID",
        "subclass": "Selective COX-2 Inhibitor",
        "brand_names": ["Celebrex"],
        "mechanism": "Selective COX-2 inhibition",
    },
    "indomethacin": {
        "class": "NSAID",
        "subclass": "Acetic Acid Derivative",
        "brand_names": ["Indocin"],
        "mechanism": "COX-1 and COX-2 inhibition",
    },

    # Cardiovascular - ACE Inhibitors
    "lisinopril": {
        "class": "Cardiovascular",
        "subclass": "ACE Inhibitor",
        "brand_names": ["Zestril", "Prinivil"],
        "mechanism": "Angiotensin-converting enzyme inhibition",
        "common_uses": ["Hypertension", "Heart failure", "Post-MI"],
    },
    "enalapril": {
        "class": "Cardiovascular",
        "subclass": "ACE Inhibitor",
        "brand_names": ["Vasotec"],
        "mechanism": "ACE inhibition",
    },
    "ramipril": {
        "class": "Cardiovascular",
        "subclass": "ACE Inhibitor",
        "brand_names": ["Altace"],
        "mechanism": "ACE inhibition",
    },

    # Cardiovascular - ARBs
    "losartan": {
        "class": "Cardiovascular",
        "subclass": "ARB",
        "brand_names": ["Cozaar"],
        "mechanism": "Angiotensin II receptor blockade",
        "common_uses": ["Hypertension", "Diabetic nephropathy"],
    },
    "valsartan": {
        "class": "Cardiovascular",
        "subclass": "ARB",
        "brand_names": ["Diovan"],
        "mechanism": "AT1 receptor blockade",
    },

    # Cardiovascular - Beta Blockers
    "metoprolol": {
        "class": "Cardiovascular",
        "subclass": "Beta Blocker",
        "brand_names": ["Lopressor", "Toprol-XL"],
        "mechanism": "Beta-1 selective blockade",
        "common_uses": ["Hypertension", "Heart failure", "AF rate control"],
    },
    "carvedilol": {
        "class": "Cardiovascular",
        "subclass": "Beta Blocker",
        "brand_names": ["Coreg"],
        "mechanism": "Non-selective beta + alpha-1 blockade",
    },
    "atenolol": {
        "class": "Cardiovascular",
        "subclass": "Beta Blocker",
        "brand_names": ["Tenormin"],
        "mechanism": "Beta-1 selective blockade",
    },
    "propranolol": {
        "class": "Cardiovascular",
        "subclass": "Beta Blocker",
        "brand_names": ["Inderal"],
        "mechanism": "Non-selective beta blockade",
    },

    # Cardiovascular - Calcium Channel Blockers
    "amlodipine": {
        "class": "Cardiovascular",
        "subclass": "Calcium Channel Blocker",
        "brand_names": ["Norvasc"],
        "mechanism": "Dihydropyridine CCB - vascular selectivity",
        "common_uses": ["Hypertension", "Angina"],
    },
    "diltiazem": {
        "class": "Cardiovascular",
        "subclass": "Calcium Channel Blocker",
        "brand_names": ["Cardizem", "Dilacor"],
        "mechanism": "Non-dihydropyridine CCB",
    },
    "verapamil": {
        "class": "Cardiovascular",
        "subclass": "Calcium Channel Blocker",
        "brand_names": ["Calan", "Verelan"],
        "mechanism": "Non-dihydropyridine CCB",
    },

    # Cardiovascular - Diuretics
    "furosemide": {
        "class": "Cardiovascular",
        "subclass": "Loop Diuretic",
        "brand_names": ["Lasix"],
        "mechanism": "Inhibits Na-K-2Cl cotransporter in loop of Henle",
        "monitoring": ["Electrolytes", "Renal function"],
    },
    "hydrochlorothiazide": {
        "class": "Cardiovascular",
        "subclass": "Thiazide Diuretic",
        "brand_names": ["Microzide", "HydroDIURIL"],
        "mechanism": "Inhibits Na-Cl cotransporter in DCT",
    },
    "spironolactone": {
        "class": "Cardiovascular",
        "subclass": "Potassium-Sparing Diuretic",
        "brand_names": ["Aldactone"],
        "mechanism": "Aldosterone receptor antagonist",
        "monitoring": ["Potassium levels"],
    },

    # Cardiovascular - Statins
    "atorvastatin": {
        "class": "Cardiovascular",
        "subclass": "HMG-CoA Reductase Inhibitor",
        "brand_names": ["Lipitor"],
        "mechanism": "Inhibits cholesterol synthesis",
        "monitoring": ["Lipid panel", "LFTs"],
    },
    "simvastatin": {
        "class": "Cardiovascular",
        "subclass": "HMG-CoA Reductase Inhibitor",
        "brand_names": ["Zocor"],
        "mechanism": "Inhibits HMG-CoA reductase",
    },
    "rosuvastatin": {
        "class": "Cardiovascular",
        "subclass": "HMG-CoA Reductase Inhibitor",
        "brand_names": ["Crestor"],
        "mechanism": "Inhibits HMG-CoA reductase",
    },
    "pravastatin": {
        "class": "Cardiovascular",
        "subclass": "HMG-CoA Reductase Inhibitor",
        "brand_names": ["Pravachol"],
        "mechanism": "Inhibits HMG-CoA reductase",
    },

    # Cardiovascular - Other
    "digoxin": {
        "class": "Cardiovascular",
        "subclass": "Cardiac Glycoside",
        "brand_names": ["Lanoxin"],
        "mechanism": "Na-K-ATPase inhibition",
        "monitoring": ["Digoxin levels", "Electrolytes"],
        "therapeutic_range": "0.5-2.0 ng/mL"
    },
    "amiodarone": {
        "class": "Cardiovascular",
        "subclass": "Antiarrhythmic (Class III)",
        "brand_names": ["Pacerone", "Cordarone"],
        "mechanism": "Multiple ion channel effects",
        "monitoring": ["TFTs", "LFTs", "Pulmonary function"],
    },

    # Diabetes Medications
    "metformin": {
        "class": "Antidiabetic",
        "subclass": "Biguanide",
        "brand_names": ["Glucophage"],
        "mechanism": "Decreases hepatic glucose production",
        "common_uses": ["Type 2 DM"],
        "contraindications": ["Severe renal impairment", "Contrast procedures"],
    },
    "glipizide": {
        "class": "Antidiabetic",
        "subclass": "Sulfonylurea",
        "brand_names": ["Glucotrol"],
        "mechanism": "Stimulates insulin release",
    },
    "glyburide": {
        "class": "Antidiabetic",
        "subclass": "Sulfonylurea",
        "brand_names": ["DiaBeta", "Micronase"],
        "mechanism": "Stimulates insulin release",
    },
    "sitagliptin": {
        "class": "Antidiabetic",
        "subclass": "DPP-4 Inhibitor",
        "brand_names": ["Januvia"],
        "mechanism": "Inhibits DPP-4 enzyme",
    },
    "empagliflozin": {
        "class": "Antidiabetic",
        "subclass": "SGLT2 Inhibitor",
        "brand_names": ["Jardiance"],
        "mechanism": "Inhibits renal glucose reabsorption",
    },
    "insulin": {
        "class": "Antidiabetic",
        "subclass": "Insulin",
        "brand_names": ["Various"],
        "mechanism": "Replaces endogenous insulin",
    },

    # Antibiotics
    "amoxicillin": {
        "class": "Antibiotic",
        "subclass": "Penicillin",
        "brand_names": ["Amoxil"],
        "mechanism": "Inhibits cell wall synthesis",
    },
    "azithromycin": {
        "class": "Antibiotic",
        "subclass": "Macrolide",
        "brand_names": ["Zithromax", "Z-Pack"],
        "mechanism": "Inhibits protein synthesis (50S ribosome)",
    },
    "ciprofloxacin": {
        "class": "Antibiotic",
        "subclass": "Fluoroquinolone",
        "brand_names": ["Cipro"],
        "mechanism": "Inhibits DNA gyrase",
    },
    "levofloxacin": {
        "class": "Antibiotic",
        "subclass": "Fluoroquinolone",
        "brand_names": ["Levaquin"],
        "mechanism": "Inhibits DNA gyrase",
    },
    "doxycycline": {
        "class": "Antibiotic",
        "subclass": "Tetracycline",
        "brand_names": ["Vibramycin"],
        "mechanism": "Inhibits protein synthesis (30S ribosome)",
    },
    "clarithromycin": {
        "class": "Antibiotic",
        "subclass": "Macrolide",
        "brand_names": ["Biaxin"],
        "mechanism": "Inhibits protein synthesis",
    },
    "erythromycin": {
        "class": "Antibiotic",
        "subclass": "Macrolide",
        "brand_names": ["E-Mycin", "Ery-Tab"],
        "mechanism": "Inhibits protein synthesis",
    },
    "metronidazole": {
        "class": "Antibiotic",
        "subclass": "Nitroimidazole",
        "brand_names": ["Flagyl"],
        "mechanism": "DNA damage in anaerobes",
    },
    "trimethoprim-sulfamethoxazole": {
        "class": "Antibiotic",
        "subclass": "Sulfonamide Combination",
        "brand_names": ["Bactrim", "Septra"],
        "mechanism": "Inhibits folate synthesis",
    },

    # Antidepressants - SSRIs
    "fluoxetine": {
        "class": "Antidepressant",
        "subclass": "SSRI",
        "brand_names": ["Prozac"],
        "mechanism": "Selective serotonin reuptake inhibition",
    },
    "sertraline": {
        "class": "Antidepressant",
        "subclass": "SSRI",
        "brand_names": ["Zoloft"],
        "mechanism": "Selective serotonin reuptake inhibition",
    },
    "escitalopram": {
        "class": "Antidepressant",
        "subclass": "SSRI",
        "brand_names": ["Lexapro"],
        "mechanism": "Selective serotonin reuptake inhibition",
    },
    "paroxetine": {
        "class": "Antidepressant",
        "subclass": "SSRI",
        "brand_names": ["Paxil"],
        "mechanism": "Selective serotonin reuptake inhibition",
    },
    "citalopram": {
        "class": "Antidepressant",
        "subclass": "SSRI",
        "brand_names": ["Celexa"],
        "mechanism": "Selective serotonin reuptake inhibition",
    },

    # Antidepressants - SNRIs
    "venlafaxine": {
        "class": "Antidepressant",
        "subclass": "SNRI",
        "brand_names": ["Effexor"],
        "mechanism": "Serotonin-norepinephrine reuptake inhibition",
    },
    "duloxetine": {
        "class": "Antidepressant",
        "subclass": "SNRI",
        "brand_names": ["Cymbalta"],
        "mechanism": "Serotonin-norepinephrine reuptake inhibition",
    },

    # Pain Medications
    "tramadol": {
        "class": "Analgesic",
        "subclass": "Opioid-like",
        "brand_names": ["Ultram"],
        "mechanism": "Mu-opioid agonist + SNRI activity",
    },
    "morphine": {
        "class": "Analgesic",
        "subclass": "Opioid",
        "brand_names": ["MS Contin", "Roxanol"],
        "mechanism": "Mu-opioid agonist",
    },
    "oxycodone": {
        "class": "Analgesic",
        "subclass": "Opioid",
        "brand_names": ["OxyContin", "Roxicodone"],
        "mechanism": "Mu-opioid agonist",
    },
    "hydrocodone": {
        "class": "Analgesic",
        "subclass": "Opioid",
        "brand_names": ["Vicodin", "Norco"],
        "mechanism": "Mu-opioid agonist",
    },
    "acetaminophen": {
        "class": "Analgesic",
        "subclass": "Non-opioid",
        "brand_names": ["Tylenol"],
        "mechanism": "COX inhibition in CNS",
        "max_daily_dose": "4g (3g in elderly/liver disease)"
    },

    # Anxiolytics/Sedatives
    "alprazolam": {
        "class": "Anxiolytic",
        "subclass": "Benzodiazepine",
        "brand_names": ["Xanax"],
        "mechanism": "GABA-A receptor modulation",
    },
    "lorazepam": {
        "class": "Anxiolytic",
        "subclass": "Benzodiazepine",
        "brand_names": ["Ativan"],
        "mechanism": "GABA-A receptor modulation",
    },
    "diazepam": {
        "class": "Anxiolytic",
        "subclass": "Benzodiazepine",
        "brand_names": ["Valium"],
        "mechanism": "GABA-A receptor modulation",
    },
    "zolpidem": {
        "class": "Sedative",
        "subclass": "Non-benzodiazepine Hypnotic",
        "brand_names": ["Ambien"],
        "mechanism": "GABA-A receptor modulation (selective)",
    },

    # Proton Pump Inhibitors
    "omeprazole": {
        "class": "GI",
        "subclass": "Proton Pump Inhibitor",
        "brand_names": ["Prilosec"],
        "mechanism": "Inhibits H+/K+-ATPase",
    },
    "pantoprazole": {
        "class": "GI",
        "subclass": "Proton Pump Inhibitor",
        "brand_names": ["Protonix"],
        "mechanism": "Inhibits H+/K+-ATPase",
    },
    "esomeprazole": {
        "class": "GI",
        "subclass": "Proton Pump Inhibitor",
        "brand_names": ["Nexium"],
        "mechanism": "Inhibits H+/K+-ATPase",
    },

    # Thyroid
    "levothyroxine": {
        "class": "Thyroid",
        "subclass": "Thyroid Hormone",
        "brand_names": ["Synthroid", "Levoxyl"],
        "mechanism": "T4 replacement",
        "monitoring": ["TSH", "Free T4"],
    },

    # Steroids
    "prednisone": {
        "class": "Corticosteroid",
        "subclass": "Glucocorticoid",
        "brand_names": ["Deltasone"],
        "mechanism": "Anti-inflammatory, immunosuppressive",
    },
    "methylprednisolone": {
        "class": "Corticosteroid",
        "subclass": "Glucocorticoid",
        "brand_names": ["Medrol"],
        "mechanism": "Anti-inflammatory, immunosuppressive",
    },

    # Antifungals
    "fluconazole": {
        "class": "Antifungal",
        "subclass": "Azole",
        "brand_names": ["Diflucan"],
        "mechanism": "Inhibits fungal CYP450 (lanosterol 14a-demethylase)",
    },
    "ketoconazole": {
        "class": "Antifungal",
        "subclass": "Azole",
        "brand_names": ["Nizoral"],
        "mechanism": "Inhibits fungal CYP450",
    },

    # Anticonvulsants
    "phenytoin": {
        "class": "Anticonvulsant",
        "subclass": "Hydantoin",
        "brand_names": ["Dilantin"],
        "mechanism": "Sodium channel blockade",
        "monitoring": ["Phenytoin levels"],
        "therapeutic_range": "10-20 mcg/mL"
    },
    "carbamazepine": {
        "class": "Anticonvulsant",
        "subclass": "Iminostilbene",
        "brand_names": ["Tegretol"],
        "mechanism": "Sodium channel blockade",
        "monitoring": ["Carbamazepine levels", "CBC"],
    },
    "valproic acid": {
        "class": "Anticonvulsant",
        "subclass": "Valproate",
        "brand_names": ["Depakote", "Depakene"],
        "mechanism": "Multiple mechanisms including GABA enhancement",
        "monitoring": ["Valproic acid levels", "LFTs"],
    },
    "gabapentin": {
        "class": "Anticonvulsant",
        "subclass": "GABA Analog",
        "brand_names": ["Neurontin"],
        "mechanism": "Calcium channel modulation",
    },
    "levetiracetam": {
        "class": "Anticonvulsant",
        "subclass": "Pyrrolidone",
        "brand_names": ["Keppra"],
        "mechanism": "SV2A modulation",
    },

    # Gout
    "allopurinol": {
        "class": "Antigout",
        "subclass": "Xanthine Oxidase Inhibitor",
        "brand_names": ["Zyloprim"],
        "mechanism": "Inhibits uric acid production",
    },
    "colchicine": {
        "class": "Antigout",
        "subclass": "Anti-inflammatory",
        "brand_names": ["Colcrys"],
        "mechanism": "Microtubule disruption, reduces inflammation",
    },

    # Potassium
    "potassium chloride": {
        "class": "Electrolyte",
        "subclass": "Potassium Supplement",
        "brand_names": ["K-Dur", "Klor-Con"],
        "mechanism": "Potassium replacement",
    },
}

# Comprehensive drug interactions database
DRUG_INTERACTIONS: Dict[str, Dict[str, Dict[str, Any]]] = {
    # Warfarin interactions
    "warfarin": {
        "aspirin": {
            "severity": "SEVERE",
            "effect": "Increased bleeding risk",
            "mechanism": "Additive anticoagulant/antiplatelet effects",
            "management": "Avoid if possible. If necessary, use low-dose aspirin and monitor closely.",
            "clinical_evidence": "Well-documented"
        },
        "ibuprofen": {
            "severity": "SEVERE",
            "effect": "Increased bleeding risk and INR elevation",
            "mechanism": "NSAIDs inhibit platelet function and may displace warfarin from protein binding",
            "management": "Avoid NSAIDs. Use acetaminophen for pain when possible.",
            "clinical_evidence": "Well-documented"
        },
        "naproxen": {
            "severity": "SEVERE",
            "effect": "Increased bleeding risk",
            "mechanism": "Antiplatelet effect and protein binding displacement",
            "management": "Avoid combination. Monitor INR closely if unavoidable.",
            "clinical_evidence": "Well-documented"
        },
        "fluconazole": {
            "severity": "SEVERE",
            "effect": "Significant INR increase",
            "mechanism": "CYP2C9 inhibition reduces warfarin metabolism",
            "management": "Reduce warfarin dose by 25-50%. Monitor INR frequently.",
            "clinical_evidence": "Well-documented"
        },
        "metronidazole": {
            "severity": "SEVERE",
            "effect": "INR elevation",
            "mechanism": "Inhibits warfarin metabolism",
            "management": "Reduce warfarin dose. Monitor INR every 2-3 days.",
            "clinical_evidence": "Well-documented"
        },
        "amiodarone": {
            "severity": "SEVERE",
            "effect": "Significant INR increase",
            "mechanism": "CYP2C9 and CYP3A4 inhibition",
            "management": "Reduce warfarin dose by 30-50%. Effect persists weeks after stopping amiodarone.",
            "clinical_evidence": "Well-documented"
        },
        "ciprofloxacin": {
            "severity": "MODERATE",
            "effect": "INR elevation",
            "mechanism": "Inhibits CYP1A2, alters gut flora",
            "management": "Monitor INR closely. Consider warfarin dose reduction.",
            "clinical_evidence": "Moderate"
        },
        "acetaminophen": {
            "severity": "MODERATE",
            "effect": "May increase INR with doses >2g/day",
            "mechanism": "Inhibits vitamin K-dependent clotting factor synthesis",
            "management": "Limit to <2g/day. Monitor INR if high doses needed.",
            "clinical_evidence": "Moderate"
        },
        "vitamin k": {
            "severity": "MODERATE",
            "effect": "Decreased warfarin effectiveness",
            "mechanism": "Vitamin K reverses warfarin's mechanism",
            "management": "Maintain consistent vitamin K intake. Avoid large fluctuations.",
            "clinical_evidence": "Well-documented"
        },
        "phenytoin": {
            "severity": "MODERATE",
            "effect": "Unpredictable - may increase or decrease effect",
            "mechanism": "Complex bidirectional interaction via CYP enzymes",
            "management": "Monitor both INR and phenytoin levels closely.",
            "clinical_evidence": "Well-documented"
        },
        "carbamazepine": {
            "severity": "MODERATE",
            "effect": "Decreased warfarin effect",
            "mechanism": "CYP induction increases warfarin metabolism",
            "management": "May need higher warfarin doses. Monitor INR.",
            "clinical_evidence": "Well-documented"
        },
    },

    # Clopidogrel interactions
    "clopidogrel": {
        "omeprazole": {
            "severity": "MODERATE",
            "effect": "Reduced antiplatelet effect",
            "mechanism": "CYP2C19 inhibition reduces clopidogrel activation",
            "management": "Use pantoprazole or famotidine instead. Avoid omeprazole/esomeprazole.",
            "clinical_evidence": "Moderate - some controversy"
        },
        "esomeprazole": {
            "severity": "MODERATE",
            "effect": "Reduced antiplatelet effect",
            "mechanism": "CYP2C19 inhibition",
            "management": "Use alternative PPI like pantoprazole.",
            "clinical_evidence": "Moderate"
        },
        "aspirin": {
            "severity": "MODERATE",
            "effect": "Increased bleeding risk (but often used together therapeutically)",
            "mechanism": "Additive antiplatelet effects",
            "management": "Common dual antiplatelet therapy (DAPT). Monitor for bleeding.",
            "clinical_evidence": "Well-documented"
        },
        "fluoxetine": {
            "severity": "MODERATE",
            "effect": "Reduced clopidogrel activation",
            "mechanism": "CYP2C19 inhibition",
            "management": "Consider alternative antidepressant if possible.",
            "clinical_evidence": "Moderate"
        },
    },

    # Metformin interactions
    "metformin": {
        "contrast dye": {
            "severity": "SEVERE",
            "effect": "Risk of lactic acidosis",
            "mechanism": "Contrast-induced nephropathy can cause metformin accumulation",
            "management": "Hold metformin before/after contrast. Resume 48h after if renal function stable.",
            "clinical_evidence": "Well-documented"
        },
        "alcohol": {
            "severity": "MODERATE",
            "effect": "Increased risk of lactic acidosis and hypoglycemia",
            "mechanism": "Both can cause lactic acidosis; alcohol increases hypoglycemia risk",
            "management": "Limit alcohol intake. Avoid binge drinking.",
            "clinical_evidence": "Moderate"
        },
        "ciprofloxacin": {
            "severity": "MODERATE",
            "effect": "Altered glucose control",
            "mechanism": "Fluoroquinolones can affect glucose metabolism",
            "management": "Monitor blood glucose more frequently.",
            "clinical_evidence": "Moderate"
        },
    },

    # ACE inhibitor interactions
    "lisinopril": {
        "potassium chloride": {
            "severity": "SEVERE",
            "effect": "Risk of hyperkalemia",
            "mechanism": "ACE inhibitors reduce aldosterone, decreasing potassium excretion",
            "management": "Monitor potassium levels. Avoid unless hypokalemia documented.",
            "clinical_evidence": "Well-documented"
        },
        "spironolactone": {
            "severity": "SEVERE",
            "effect": "Significant hyperkalemia risk",
            "mechanism": "Additive potassium retention",
            "management": "If used together, monitor potassium closely. Start low doses.",
            "clinical_evidence": "Well-documented"
        },
        "ibuprofen": {
            "severity": "MODERATE",
            "effect": "Reduced antihypertensive effect, increased renal risk",
            "mechanism": "NSAIDs inhibit prostaglandins that mediate ACE inhibitor effects",
            "management": "Avoid prolonged NSAID use. Monitor BP and renal function.",
            "clinical_evidence": "Well-documented"
        },
        "naproxen": {
            "severity": "MODERATE",
            "effect": "Reduced antihypertensive effect",
            "mechanism": "Prostaglandin inhibition",
            "management": "Monitor blood pressure. Use shortest duration possible.",
            "clinical_evidence": "Well-documented"
        },
        "trimethoprim-sulfamethoxazole": {
            "severity": "MODERATE",
            "effect": "Hyperkalemia risk",
            "mechanism": "Trimethoprim blocks potassium secretion in kidney",
            "management": "Monitor potassium, especially in elderly or renal impairment.",
            "clinical_evidence": "Moderate"
        },
    },

    # Statin interactions
    "simvastatin": {
        "clarithromycin": {
            "severity": "CONTRAINDICATED",
            "effect": "Greatly increased myopathy/rhabdomyolysis risk",
            "mechanism": "Strong CYP3A4 inhibition increases simvastatin levels 10-fold",
            "management": "Avoid combination. Use azithromycin instead if antibiotic needed.",
            "clinical_evidence": "Well-documented"
        },
        "erythromycin": {
            "severity": "CONTRAINDICATED",
            "effect": "Greatly increased myopathy risk",
            "mechanism": "CYP3A4 inhibition",
            "management": "Avoid combination. Consider alternative statin or antibiotic.",
            "clinical_evidence": "Well-documented"
        },
        "amiodarone": {
            "severity": "SEVERE",
            "effect": "Increased myopathy risk",
            "mechanism": "CYP3A4 inhibition",
            "management": "Limit simvastatin to 20mg daily maximum.",
            "clinical_evidence": "Well-documented"
        },
        "diltiazem": {
            "severity": "MODERATE",
            "effect": "Increased myopathy risk",
            "mechanism": "CYP3A4 inhibition",
            "management": "Limit simvastatin to 10mg daily. Consider pravastatin.",
            "clinical_evidence": "Well-documented"
        },
        "verapamil": {
            "severity": "MODERATE",
            "effect": "Increased myopathy risk",
            "mechanism": "CYP3A4 inhibition",
            "management": "Limit simvastatin to 10mg daily.",
            "clinical_evidence": "Well-documented"
        },
        "grapefruit": {
            "severity": "MODERATE",
            "effect": "Increased statin levels",
            "mechanism": "CYP3A4 inhibition in gut",
            "management": "Avoid grapefruit juice or limit to occasional small amounts.",
            "clinical_evidence": "Well-documented"
        },
        "fluconazole": {
            "severity": "SEVERE",
            "effect": "Increased myopathy risk",
            "mechanism": "CYP3A4 inhibition",
            "management": "Consider rosuvastatin or pravastatin (not CYP3A4 metabolized).",
            "clinical_evidence": "Moderate"
        },
    },

    # Apply similar interactions to atorvastatin
    "atorvastatin": {
        "clarithromycin": {
            "severity": "SEVERE",
            "effect": "Increased myopathy risk",
            "mechanism": "CYP3A4 inhibition",
            "management": "Limit atorvastatin to 20mg or use azithromycin.",
            "clinical_evidence": "Well-documented"
        },
        "erythromycin": {
            "severity": "SEVERE",
            "effect": "Increased myopathy risk",
            "mechanism": "CYP3A4 inhibition",
            "management": "Consider atorvastatin dose reduction or alternative antibiotic.",
            "clinical_evidence": "Well-documented"
        },
    },

    # Digoxin interactions
    "digoxin": {
        "amiodarone": {
            "severity": "SEVERE",
            "effect": "Increased digoxin levels 70-100%",
            "mechanism": "Reduced renal clearance and P-glycoprotein inhibition",
            "management": "Reduce digoxin dose by 50% when starting amiodarone.",
            "clinical_evidence": "Well-documented"
        },
        "verapamil": {
            "severity": "SEVERE",
            "effect": "Increased digoxin levels 50-75%",
            "mechanism": "P-glycoprotein inhibition",
            "management": "Reduce digoxin dose and monitor levels.",
            "clinical_evidence": "Well-documented"
        },
        "diltiazem": {
            "severity": "MODERATE",
            "effect": "Increased digoxin levels ~20%",
            "mechanism": "P-glycoprotein inhibition",
            "management": "Monitor digoxin levels. May need dose adjustment.",
            "clinical_evidence": "Well-documented"
        },
        "clarithromycin": {
            "severity": "SEVERE",
            "effect": "Increased digoxin levels",
            "mechanism": "P-glycoprotein inhibition + altered gut flora",
            "management": "Monitor digoxin levels. Consider azithromycin instead.",
            "clinical_evidence": "Well-documented"
        },
        "furosemide": {
            "severity": "MODERATE",
            "effect": "Increased digoxin toxicity risk",
            "mechanism": "Diuretic-induced hypokalemia increases digoxin sensitivity",
            "management": "Monitor potassium levels. Supplement if needed.",
            "clinical_evidence": "Well-documented"
        },
    },

    # SSRI interactions
    "fluoxetine": {
        "tramadol": {
            "severity": "SEVERE",
            "effect": "Risk of serotonin syndrome and seizures",
            "mechanism": "Additive serotonergic effects; tramadol lowers seizure threshold",
            "management": "Avoid combination if possible. Monitor for serotonin syndrome symptoms.",
            "clinical_evidence": "Well-documented"
        },
        "warfarin": {
            "severity": "MODERATE",
            "effect": "Increased bleeding risk",
            "mechanism": "SSRIs affect platelet function; some inhibit CYP2C9",
            "management": "Monitor INR. Use caution with any anticoagulant.",
            "clinical_evidence": "Moderate"
        },
        "ibuprofen": {
            "severity": "MODERATE",
            "effect": "Increased GI bleeding risk",
            "mechanism": "Both affect platelet function",
            "management": "Consider PPI if NSAID needed. Monitor for bleeding.",
            "clinical_evidence": "Well-documented"
        },
    },
    "sertraline": {
        "tramadol": {
            "severity": "SEVERE",
            "effect": "Risk of serotonin syndrome",
            "mechanism": "Additive serotonergic effects",
            "management": "Avoid combination if possible. Monitor closely.",
            "clinical_evidence": "Well-documented"
        },
        "warfarin": {
            "severity": "MODERATE",
            "effect": "Increased bleeding risk",
            "mechanism": "SSRIs affect platelet function",
            "management": "Monitor INR and for bleeding.",
            "clinical_evidence": "Moderate"
        },
    },

    # Benzodiazepine interactions
    "alprazolam": {
        "oxycodone": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe respiratory depression, overdose, death",
            "mechanism": "Additive CNS depression",
            "management": "Avoid combination. Black box warning from FDA.",
            "clinical_evidence": "Well-documented - FDA Black Box Warning"
        },
        "morphine": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe respiratory depression",
            "mechanism": "Additive CNS depression",
            "management": "Avoid combination if possible. Use lowest effective doses if necessary.",
            "clinical_evidence": "Well-documented - FDA Black Box Warning"
        },
        "hydrocodone": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe respiratory depression",
            "mechanism": "Additive CNS depression",
            "management": "Avoid combination. High risk of fatal overdose.",
            "clinical_evidence": "Well-documented - FDA Black Box Warning"
        },
        "alcohol": {
            "severity": "SEVERE",
            "effect": "Increased sedation, respiratory depression",
            "mechanism": "Additive CNS depression",
            "management": "Counsel patient to avoid alcohol.",
            "clinical_evidence": "Well-documented"
        },
        "ketoconazole": {
            "severity": "SEVERE",
            "effect": "Increased alprazolam levels and effects",
            "mechanism": "CYP3A4 inhibition",
            "management": "Reduce alprazolam dose significantly or avoid.",
            "clinical_evidence": "Well-documented"
        },
    },
    "lorazepam": {
        "oxycodone": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe respiratory depression",
            "mechanism": "Additive CNS depression",
            "management": "Avoid combination. FDA Black Box Warning.",
            "clinical_evidence": "Well-documented"
        },
        "morphine": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe respiratory depression",
            "mechanism": "Additive CNS depression",
            "management": "Avoid combination.",
            "clinical_evidence": "Well-documented"
        },
    },

    # Fluoroquinolone interactions
    "ciprofloxacin": {
        "tizanidine": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe hypotension and sedation",
            "mechanism": "CYP1A2 inhibition increases tizanidine levels 10-fold",
            "management": "Absolutely avoid combination.",
            "clinical_evidence": "Well-documented"
        },
        "theophylline": {
            "severity": "SEVERE",
            "effect": "Increased theophylline toxicity",
            "mechanism": "CYP1A2 inhibition",
            "management": "Monitor theophylline levels. Reduce dose by 30-40%.",
            "clinical_evidence": "Well-documented"
        },
        "warfarin": {
            "severity": "MODERATE",
            "effect": "Increased INR",
            "mechanism": "CYP1A2 inhibition + altered gut flora",
            "management": "Monitor INR closely during antibiotic course.",
            "clinical_evidence": "Moderate"
        },
    },

    # Thyroid hormone interactions
    "levothyroxine": {
        "calcium": {
            "severity": "MODERATE",
            "effect": "Reduced levothyroxine absorption",
            "mechanism": "Calcium binds levothyroxine in gut",
            "management": "Separate doses by 4 hours.",
            "clinical_evidence": "Well-documented"
        },
        "iron": {
            "severity": "MODERATE",
            "effect": "Reduced levothyroxine absorption",
            "mechanism": "Iron binds levothyroxine",
            "management": "Separate doses by 4 hours.",
            "clinical_evidence": "Well-documented"
        },
        "omeprazole": {
            "severity": "MINOR",
            "effect": "May reduce levothyroxine absorption",
            "mechanism": "Reduced gastric acid affects tablet dissolution",
            "management": "Monitor TSH. May need to increase levothyroxine dose.",
            "clinical_evidence": "Moderate"
        },
        "warfarin": {
            "severity": "MODERATE",
            "effect": "Increased warfarin effect as thyroid state corrects",
            "mechanism": "Thyroid hormone increases catabolism of clotting factors",
            "management": "Monitor INR when starting or adjusting levothyroxine.",
            "clinical_evidence": "Well-documented"
        },
    },

    # Colchicine interactions
    "colchicine": {
        "clarithromycin": {
            "severity": "CONTRAINDICATED",
            "effect": "Life-threatening colchicine toxicity",
            "mechanism": "CYP3A4 and P-glycoprotein inhibition",
            "management": "Avoid combination in patients with renal/hepatic impairment.",
            "clinical_evidence": "Well-documented - deaths reported"
        },
        "erythromycin": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe colchicine toxicity",
            "mechanism": "CYP3A4 inhibition",
            "management": "Avoid combination.",
            "clinical_evidence": "Well-documented"
        },
        "cyclosporine": {
            "severity": "CONTRAINDICATED",
            "effect": "Increased colchicine toxicity",
            "mechanism": "P-glycoprotein inhibition",
            "management": "Reduce colchicine dose significantly or avoid.",
            "clinical_evidence": "Well-documented"
        },
    },

    # Allopurinol interactions
    "allopurinol": {
        "azathioprine": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe bone marrow suppression",
            "mechanism": "Allopurinol inhibits xanthine oxidase, preventing azathioprine metabolism",
            "management": "Reduce azathioprine dose by 75% if must use together.",
            "clinical_evidence": "Well-documented"
        },
        "mercaptopurine": {
            "severity": "CONTRAINDICATED",
            "effect": "Severe bone marrow suppression",
            "mechanism": "Xanthine oxidase inhibition",
            "management": "Reduce mercaptopurine dose by 75%.",
            "clinical_evidence": "Well-documented"
        },
        "warfarin": {
            "severity": "MODERATE",
            "effect": "Increased INR",
            "mechanism": "Uncertain - may inhibit warfarin metabolism",
            "management": "Monitor INR when starting allopurinol.",
            "clinical_evidence": "Moderate"
        },
    },
}

# Common drug-food interactions
DRUG_FOOD_INTERACTIONS: Dict[str, Dict[str, Any]] = {
    "warfarin": {
        "vitamin_k_rich_foods": {
            "foods": ["Leafy greens (kale, spinach)", "Broccoli", "Brussels sprouts", "Green tea"],
            "effect": "Decreased warfarin effectiveness",
            "management": "Maintain consistent vitamin K intake, don't eliminate completely"
        },
        "alcohol": {
            "foods": ["Alcohol/ethanol"],
            "effect": "Unpredictable INR changes",
            "management": "Limit alcohol to moderate, consistent amounts"
        },
        "cranberry": {
            "foods": ["Cranberry juice", "Cranberry supplements"],
            "effect": "May increase INR",
            "management": "Limit intake. Monitor INR if consumed regularly"
        }
    },
    "simvastatin": {
        "grapefruit": {
            "foods": ["Grapefruit", "Grapefruit juice"],
            "effect": "Increased statin levels and myopathy risk",
            "management": "Avoid grapefruit entirely with simvastatin"
        }
    },
    "atorvastatin": {
        "grapefruit": {
            "foods": ["Grapefruit", "Grapefruit juice"],
            "effect": "Increased statin levels (less effect than simvastatin)",
            "management": "Limit grapefruit to small amounts occasionally"
        }
    },
    "levothyroxine": {
        "soy": {
            "foods": ["Soy milk", "Tofu", "Edamame"],
            "effect": "May reduce absorption",
            "management": "Take levothyroxine 4 hours before/after soy"
        },
        "coffee": {
            "foods": ["Coffee"],
            "effect": "Reduced absorption",
            "management": "Wait 60 minutes after taking levothyroxine before coffee"
        }
    },
    "ciprofloxacin": {
        "dairy": {
            "foods": ["Milk", "Cheese", "Yogurt"],
            "effect": "Significantly reduced absorption",
            "management": "Take ciprofloxacin 2 hours before or 6 hours after dairy"
        }
    },
    "doxycycline": {
        "dairy": {
            "foods": ["Milk", "Cheese", "Yogurt", "Calcium supplements"],
            "effect": "Reduced absorption",
            "management": "Separate from dairy products by 2-3 hours"
        }
    },
    "metronidazole": {
        "alcohol": {
            "foods": ["Alcohol"],
            "effect": "Severe nausea, vomiting, flushing (disulfiram-like reaction)",
            "management": "Avoid alcohol during treatment and 48 hours after"
        }
    },
    "maoi": {
        "tyramine": {
            "foods": ["Aged cheese", "Cured meats", "Fermented foods", "Tap beer", "Soy sauce"],
            "effect": "Hypertensive crisis",
            "management": "Strict avoidance of tyramine-containing foods"
        }
    }
}

# Drug-condition contraindications
DRUG_CONDITION_CONTRAINDICATIONS: Dict[str, Dict[str, Dict[str, str]]] = {
    "metformin": {
        "severe_renal_impairment": {
            "condition": "eGFR < 30 mL/min",
            "risk": "Lactic acidosis",
            "action": "Contraindicated. Stop metformin."
        },
        "acute_kidney_injury": {
            "condition": "AKI or unstable renal function",
            "risk": "Lactic acidosis",
            "action": "Hold metformin until renal function stabilizes"
        }
    },
    "ibuprofen": {
        "gi_bleeding": {
            "condition": "History of GI bleeding or active ulcer",
            "risk": "Recurrent GI bleeding",
            "action": "Avoid or use with PPI if necessary"
        },
        "ckd": {
            "condition": "Chronic kidney disease",
            "risk": "Worsening renal function",
            "action": "Avoid or use with extreme caution"
        },
        "heart_failure": {
            "condition": "Heart failure",
            "risk": "Fluid retention, worsening heart failure",
            "action": "Avoid NSAIDs in heart failure"
        }
    },
    "lisinopril": {
        "pregnancy": {
            "condition": "Pregnancy",
            "risk": "Fetal harm, oligohydramnios",
            "action": "Contraindicated in pregnancy"
        },
        "angioedema_history": {
            "condition": "History of ACE inhibitor angioedema",
            "risk": "Recurrent angioedema",
            "action": "Contraindicated. Use ARB with caution."
        },
        "bilateral_renal_artery_stenosis": {
            "condition": "Bilateral renal artery stenosis",
            "risk": "Acute kidney injury",
            "action": "Contraindicated"
        }
    },
    "warfarin": {
        "active_bleeding": {
            "condition": "Active bleeding",
            "risk": "Worsening hemorrhage",
            "action": "Contraindicated until bleeding controlled"
        },
        "recent_cns_surgery": {
            "condition": "Recent CNS/eye surgery",
            "risk": "Intracranial/intraocular bleeding",
            "action": "Generally contraindicated"
        }
    }
}
