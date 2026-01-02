"""
Medical Knowledge Base for Diagnostic AI
Comprehensive disease-symptom mappings based on medical literature
"""

from typing import Dict, List, Any

# Comprehensive Disease Database with ICD-10 codes, symptoms, risk factors, and epidemiology
DISEASE_DATABASE: Dict[str, Dict[str, Any]] = {
    # Respiratory Conditions
    "J06.9": {
        "name": "Acute upper respiratory infection",
        "category": "respiratory",
        "symptoms": [
            "cough", "runny nose", "sore throat", "sneezing", "nasal congestion",
            "mild fever", "headache", "fatigue", "body aches", "watery eyes"
        ],
        "symptom_weights": {
            "cough": 0.9, "runny nose": 0.85, "sore throat": 0.85, "sneezing": 0.8,
            "nasal congestion": 0.85, "mild fever": 0.7, "headache": 0.5, "fatigue": 0.6
        },
        "risk_factors": ["immunocompromised", "elderly", "young children", "crowded environments"],
        "age_modifier": {"0-12": 1.3, "13-60": 1.0, "61+": 1.2},
        "severity": "mild",
        "typical_duration": "7-10 days"
    },
    "J18.9": {
        "name": "Pneumonia, unspecified organism",
        "category": "respiratory",
        "symptoms": [
            "productive cough", "high fever", "chills", "shortness of breath",
            "chest pain", "rapid breathing", "fatigue", "confusion", "sweating",
            "pleuritic pain", "cyanosis"
        ],
        "symptom_weights": {
            "productive cough": 0.9, "high fever": 0.85, "chills": 0.7, "shortness of breath": 0.85,
            "chest pain": 0.7, "rapid breathing": 0.8, "fatigue": 0.6, "confusion": 0.5
        },
        "risk_factors": ["smoking", "COPD", "diabetes", "heart disease", "immunocompromised", "elderly"],
        "age_modifier": {"0-12": 1.2, "13-60": 1.0, "61+": 1.5},
        "severity": "moderate-severe",
        "red_flags": ["confusion", "cyanosis", "respiratory rate > 30"]
    },
    "J45.9": {
        "name": "Asthma, unspecified",
        "category": "respiratory",
        "symptoms": [
            "wheezing", "shortness of breath", "chest tightness", "cough",
            "difficulty breathing at night", "triggered by exercise", "triggered by allergens"
        ],
        "symptom_weights": {
            "wheezing": 0.95, "shortness of breath": 0.85, "chest tightness": 0.8,
            "cough": 0.7, "difficulty breathing at night": 0.75
        },
        "risk_factors": ["allergies", "family history", "childhood respiratory infections", "smoking exposure"],
        "age_modifier": {"0-12": 1.4, "13-60": 1.0, "61+": 0.8},
        "severity": "variable"
    },
    "J44.9": {
        "name": "Chronic obstructive pulmonary disease (COPD)",
        "category": "respiratory",
        "symptoms": [
            "chronic cough", "sputum production", "shortness of breath", "wheezing",
            "frequent respiratory infections", "fatigue", "weight loss", "ankle swelling"
        ],
        "symptom_weights": {
            "chronic cough": 0.9, "sputum production": 0.85, "shortness of breath": 0.9,
            "wheezing": 0.7, "frequent respiratory infections": 0.6
        },
        "risk_factors": ["smoking", "occupational dust exposure", "air pollution", "alpha-1 antitrypsin deficiency"],
        "age_modifier": {"0-40": 0.3, "41-60": 1.0, "61+": 1.5},
        "severity": "chronic-progressive"
    },

    # Cardiovascular Conditions
    "I20.9": {
        "name": "Angina pectoris, unspecified",
        "category": "cardiovascular",
        "symptoms": [
            "chest pain", "chest pressure", "pain radiating to arm", "pain radiating to jaw",
            "shortness of breath", "sweating", "nausea", "dizziness", "fatigue with exertion"
        ],
        "symptom_weights": {
            "chest pain": 0.95, "chest pressure": 0.9, "pain radiating to arm": 0.85,
            "pain radiating to jaw": 0.8, "shortness of breath": 0.7, "sweating": 0.6
        },
        "risk_factors": ["hypertension", "diabetes", "smoking", "high cholesterol", "obesity", "family history", "sedentary lifestyle"],
        "age_modifier": {"0-40": 0.3, "41-60": 1.2, "61+": 1.5},
        "gender_modifier": {"male": 1.3, "female": 1.0},
        "severity": "moderate-severe",
        "red_flags": ["pain at rest", "increasing frequency", "new onset"]
    },
    "I21.9": {
        "name": "Acute myocardial infarction, unspecified",
        "category": "cardiovascular",
        "symptoms": [
            "severe chest pain", "crushing chest pressure", "pain radiating to left arm",
            "pain radiating to jaw", "pain radiating to back", "shortness of breath",
            "cold sweats", "nausea", "vomiting", "lightheadedness", "anxiety", "sense of doom"
        ],
        "symptom_weights": {
            "severe chest pain": 0.95, "crushing chest pressure": 0.95, "pain radiating to left arm": 0.9,
            "pain radiating to jaw": 0.85, "shortness of breath": 0.8, "cold sweats": 0.75, "sense of doom": 0.7
        },
        "risk_factors": ["hypertension", "diabetes", "smoking", "high cholesterol", "obesity", "family history", "previous MI"],
        "age_modifier": {"0-40": 0.2, "41-60": 1.3, "61+": 1.6},
        "gender_modifier": {"male": 1.4, "female": 1.0},
        "severity": "emergency",
        "red_flags": ["any symptom combination"]
    },
    "I50.9": {
        "name": "Heart failure, unspecified",
        "category": "cardiovascular",
        "symptoms": [
            "shortness of breath", "fatigue", "swollen ankles", "swollen legs",
            "rapid heartbeat", "persistent cough", "wheezing", "reduced exercise tolerance",
            "weight gain", "difficulty lying flat", "waking up breathless"
        ],
        "symptom_weights": {
            "shortness of breath": 0.9, "fatigue": 0.7, "swollen ankles": 0.85, "swollen legs": 0.85,
            "rapid heartbeat": 0.7, "difficulty lying flat": 0.8, "waking up breathless": 0.85
        },
        "risk_factors": ["coronary artery disease", "hypertension", "diabetes", "obesity", "previous MI"],
        "age_modifier": {"0-40": 0.3, "41-60": 1.0, "61+": 1.6},
        "severity": "moderate-severe"
    },
    "I10": {
        "name": "Essential hypertension",
        "category": "cardiovascular",
        "symptoms": [
            "headache", "dizziness", "blurred vision", "chest pain",
            "shortness of breath", "nosebleeds", "often asymptomatic"
        ],
        "symptom_weights": {
            "headache": 0.5, "dizziness": 0.5, "blurred vision": 0.6, "chest pain": 0.4, "nosebleeds": 0.3
        },
        "risk_factors": ["obesity", "high sodium diet", "sedentary lifestyle", "family history", "age", "stress"],
        "age_modifier": {"0-30": 0.3, "31-50": 1.0, "51+": 1.4},
        "severity": "chronic"
    },

    # Gastrointestinal Conditions
    "K29.7": {
        "name": "Gastritis, unspecified",
        "category": "gastrointestinal",
        "symptoms": [
            "upper abdominal pain", "nausea", "vomiting", "bloating", "indigestion",
            "loss of appetite", "burning sensation in stomach", "feeling full after eating little"
        ],
        "symptom_weights": {
            "upper abdominal pain": 0.9, "nausea": 0.8, "bloating": 0.7, "burning sensation in stomach": 0.85,
            "indigestion": 0.75, "loss of appetite": 0.6
        },
        "risk_factors": ["H. pylori infection", "NSAID use", "alcohol", "stress", "autoimmune disorders"],
        "age_modifier": {"0-30": 0.8, "31-60": 1.0, "61+": 1.2},
        "severity": "mild-moderate"
    },
    "K21.0": {
        "name": "Gastroesophageal reflux disease (GERD)",
        "category": "gastrointestinal",
        "symptoms": [
            "heartburn", "acid reflux", "regurgitation", "chest pain", "difficulty swallowing",
            "chronic cough", "sore throat", "hoarseness", "sensation of lump in throat"
        ],
        "symptom_weights": {
            "heartburn": 0.95, "acid reflux": 0.9, "regurgitation": 0.85, "difficulty swallowing": 0.7,
            "chronic cough": 0.5, "chest pain": 0.6
        },
        "risk_factors": ["obesity", "hiatal hernia", "pregnancy", "smoking", "certain foods"],
        "age_modifier": {"0-30": 0.7, "31-60": 1.0, "61+": 1.2},
        "severity": "mild-moderate"
    },
    "K35.9": {
        "name": "Acute appendicitis, unspecified",
        "category": "gastrointestinal",
        "symptoms": [
            "right lower abdominal pain", "pain starting near navel", "nausea", "vomiting",
            "loss of appetite", "fever", "abdominal tenderness", "rebound tenderness"
        ],
        "symptom_weights": {
            "right lower abdominal pain": 0.95, "pain starting near navel": 0.8, "nausea": 0.7,
            "fever": 0.7, "rebound tenderness": 0.9, "loss of appetite": 0.6
        },
        "risk_factors": ["young age", "family history"],
        "age_modifier": {"10-30": 1.5, "31-50": 1.0, "51+": 0.6},
        "severity": "emergency",
        "red_flags": ["rebound tenderness", "high fever", "rigid abdomen"]
    },
    "K80.20": {
        "name": "Cholelithiasis (Gallstones)",
        "category": "gastrointestinal",
        "symptoms": [
            "right upper abdominal pain", "pain after fatty meals", "nausea", "vomiting",
            "pain radiating to back", "pain radiating to right shoulder", "bloating"
        ],
        "symptom_weights": {
            "right upper abdominal pain": 0.9, "pain after fatty meals": 0.85, "nausea": 0.7,
            "pain radiating to back": 0.75, "pain radiating to right shoulder": 0.8
        },
        "risk_factors": ["female", "obesity", "rapid weight loss", "pregnancy", "family history", "age over 40"],
        "age_modifier": {"0-30": 0.5, "31-50": 1.0, "51+": 1.3},
        "gender_modifier": {"female": 1.5, "male": 1.0},
        "severity": "moderate"
    },

    # Neurological Conditions
    "G43.9": {
        "name": "Migraine, unspecified",
        "category": "neurological",
        "symptoms": [
            "severe headache", "throbbing headache", "one-sided headache", "nausea",
            "vomiting", "sensitivity to light", "sensitivity to sound", "visual aura",
            "dizziness", "fatigue"
        ],
        "symptom_weights": {
            "severe headache": 0.9, "throbbing headache": 0.85, "one-sided headache": 0.85,
            "nausea": 0.75, "sensitivity to light": 0.8, "sensitivity to sound": 0.75, "visual aura": 0.8
        },
        "risk_factors": ["family history", "female", "hormonal changes", "stress", "certain foods"],
        "age_modifier": {"10-50": 1.2, "51+": 0.8},
        "gender_modifier": {"female": 1.5, "male": 1.0},
        "severity": "moderate"
    },
    "G44.2": {
        "name": "Tension-type headache",
        "category": "neurological",
        "symptoms": [
            "dull headache", "pressure around head", "tight band sensation", "neck pain",
            "shoulder tension", "tenderness in scalp", "bilateral headache"
        ],
        "symptom_weights": {
            "dull headache": 0.9, "pressure around head": 0.85, "tight band sensation": 0.8,
            "neck pain": 0.7, "bilateral headache": 0.75
        },
        "risk_factors": ["stress", "poor posture", "computer use", "jaw clenching"],
        "age_modifier": {"0-60": 1.0, "61+": 0.8},
        "severity": "mild"
    },
    "G40.9": {
        "name": "Epilepsy, unspecified",
        "category": "neurological",
        "symptoms": [
            "seizures", "convulsions", "loss of consciousness", "confusion after episode",
            "staring spells", "temporary confusion", "uncontrollable jerking", "loss of awareness"
        ],
        "symptom_weights": {
            "seizures": 0.95, "convulsions": 0.9, "loss of consciousness": 0.85,
            "staring spells": 0.7, "uncontrollable jerking": 0.85
        },
        "risk_factors": ["brain injury", "stroke", "brain tumor", "family history", "dementia"],
        "age_modifier": {"0-20": 1.3, "21-60": 1.0, "61+": 1.2},
        "severity": "moderate-severe"
    },

    # Endocrine/Metabolic Conditions
    "E11.9": {
        "name": "Type 2 diabetes mellitus",
        "category": "endocrine",
        "symptoms": [
            "increased thirst", "frequent urination", "increased hunger", "fatigue",
            "blurred vision", "slow healing wounds", "frequent infections", "numbness in hands or feet",
            "weight loss", "dark skin patches"
        ],
        "symptom_weights": {
            "increased thirst": 0.85, "frequent urination": 0.85, "fatigue": 0.6,
            "blurred vision": 0.7, "slow healing wounds": 0.75, "numbness in hands or feet": 0.7
        },
        "risk_factors": ["obesity", "family history", "sedentary lifestyle", "age over 45", "prediabetes"],
        "age_modifier": {"0-30": 0.3, "31-50": 1.0, "51+": 1.5},
        "severity": "chronic"
    },
    "E03.9": {
        "name": "Hypothyroidism, unspecified",
        "category": "endocrine",
        "symptoms": [
            "fatigue", "weight gain", "cold intolerance", "constipation", "dry skin",
            "hair loss", "depression", "memory problems", "muscle weakness", "slow heart rate",
            "puffy face", "hoarse voice"
        ],
        "symptom_weights": {
            "fatigue": 0.8, "weight gain": 0.75, "cold intolerance": 0.8, "constipation": 0.6,
            "dry skin": 0.7, "hair loss": 0.65, "depression": 0.5
        },
        "risk_factors": ["female", "age over 60", "autoimmune disease", "thyroid surgery", "radiation therapy"],
        "age_modifier": {"0-40": 0.7, "41-60": 1.0, "61+": 1.4},
        "gender_modifier": {"female": 1.6, "male": 1.0},
        "severity": "chronic"
    },
    "E05.9": {
        "name": "Hyperthyroidism, unspecified",
        "category": "endocrine",
        "symptoms": [
            "weight loss", "rapid heartbeat", "anxiety", "tremor", "sweating",
            "heat intolerance", "increased appetite", "frequent bowel movements",
            "irritability", "muscle weakness", "difficulty sleeping", "bulging eyes"
        ],
        "symptom_weights": {
            "weight loss": 0.8, "rapid heartbeat": 0.85, "anxiety": 0.6, "tremor": 0.75,
            "sweating": 0.7, "heat intolerance": 0.8, "bulging eyes": 0.85
        },
        "risk_factors": ["female", "family history", "autoimmune disease"],
        "age_modifier": {"0-30": 0.8, "31-60": 1.0, "61+": 1.2},
        "gender_modifier": {"female": 1.5, "male": 1.0},
        "severity": "moderate"
    },

    # Musculoskeletal Conditions
    "M54.5": {
        "name": "Low back pain",
        "category": "musculoskeletal",
        "symptoms": [
            "lower back pain", "muscle stiffness", "pain with movement", "limited range of motion",
            "pain radiating to legs", "numbness in legs", "muscle spasms"
        ],
        "symptom_weights": {
            "lower back pain": 0.95, "muscle stiffness": 0.7, "pain with movement": 0.75,
            "pain radiating to legs": 0.8, "muscle spasms": 0.65
        },
        "risk_factors": ["poor posture", "heavy lifting", "obesity", "sedentary lifestyle", "age"],
        "age_modifier": {"0-30": 0.7, "31-60": 1.2, "61+": 1.3},
        "severity": "mild-moderate"
    },
    "M15.9": {
        "name": "Polyosteoarthritis, unspecified",
        "category": "musculoskeletal",
        "symptoms": [
            "joint pain", "joint stiffness", "reduced range of motion", "swelling",
            "bone spurs", "grating sensation", "worse with activity", "morning stiffness"
        ],
        "symptom_weights": {
            "joint pain": 0.9, "joint stiffness": 0.85, "reduced range of motion": 0.75,
            "swelling": 0.7, "grating sensation": 0.8, "morning stiffness": 0.7
        },
        "risk_factors": ["age", "obesity", "joint injury", "repetitive stress", "genetics"],
        "age_modifier": {"0-40": 0.3, "41-60": 1.0, "61+": 1.6},
        "severity": "chronic-progressive"
    },
    "M06.9": {
        "name": "Rheumatoid arthritis, unspecified",
        "category": "musculoskeletal",
        "symptoms": [
            "joint pain", "joint swelling", "morning stiffness lasting hours", "fatigue",
            "fever", "loss of appetite", "symmetric joint involvement", "joint warmth"
        ],
        "symptom_weights": {
            "joint pain": 0.85, "joint swelling": 0.85, "morning stiffness lasting hours": 0.9,
            "symmetric joint involvement": 0.85, "fatigue": 0.6, "joint warmth": 0.7
        },
        "risk_factors": ["female", "family history", "smoking", "obesity"],
        "age_modifier": {"0-30": 0.6, "31-60": 1.2, "61+": 1.0},
        "gender_modifier": {"female": 1.5, "male": 1.0},
        "severity": "chronic-progressive"
    },

    # Infectious Diseases
    "A09": {
        "name": "Infectious gastroenteritis",
        "category": "infectious",
        "symptoms": [
            "diarrhea", "nausea", "vomiting", "abdominal cramps", "fever",
            "body aches", "headache", "dehydration", "loss of appetite"
        ],
        "symptom_weights": {
            "diarrhea": 0.95, "nausea": 0.8, "vomiting": 0.8, "abdominal cramps": 0.85,
            "fever": 0.6, "dehydration": 0.7
        },
        "risk_factors": ["contaminated food", "contaminated water", "close contact with infected person"],
        "age_modifier": {"0-12": 1.3, "13-60": 1.0, "61+": 1.2},
        "severity": "mild-moderate"
    },
    "J11.1": {
        "name": "Influenza with other respiratory manifestations",
        "category": "infectious",
        "symptoms": [
            "fever", "chills", "body aches", "headache", "fatigue", "cough",
            "sore throat", "runny nose", "muscle pain", "weakness"
        ],
        "symptom_weights": {
            "fever": 0.9, "body aches": 0.85, "fatigue": 0.8, "cough": 0.75,
            "chills": 0.8, "headache": 0.7, "muscle pain": 0.8
        },
        "risk_factors": ["elderly", "young children", "immunocompromised", "chronic conditions"],
        "age_modifier": {"0-12": 1.2, "13-60": 1.0, "61+": 1.3},
        "severity": "moderate"
    },
    "B34.9": {
        "name": "Viral infection, unspecified",
        "category": "infectious",
        "symptoms": [
            "fever", "fatigue", "body aches", "headache", "chills",
            "loss of appetite", "general malaise"
        ],
        "symptom_weights": {
            "fever": 0.85, "fatigue": 0.8, "body aches": 0.75, "headache": 0.6,
            "chills": 0.7, "general malaise": 0.7
        },
        "risk_factors": ["immunocompromised", "recent exposure"],
        "age_modifier": {"0-12": 1.2, "13-60": 1.0, "61+": 1.1},
        "severity": "mild"
    },
    "N39.0": {
        "name": "Urinary tract infection",
        "category": "infectious",
        "symptoms": [
            "burning urination", "frequent urination", "urgency to urinate", "cloudy urine",
            "blood in urine", "pelvic pain", "lower abdominal pain", "strong-smelling urine"
        ],
        "symptom_weights": {
            "burning urination": 0.95, "frequent urination": 0.85, "urgency to urinate": 0.85,
            "cloudy urine": 0.8, "blood in urine": 0.75, "pelvic pain": 0.7
        },
        "risk_factors": ["female", "sexual activity", "diabetes", "urinary catheter", "menopause"],
        "age_modifier": {"0-30": 1.0, "31-60": 1.0, "61+": 1.3},
        "gender_modifier": {"female": 1.8, "male": 1.0},
        "severity": "mild-moderate"
    },

    # Mental Health Conditions
    "F32.9": {
        "name": "Major depressive disorder, single episode",
        "category": "mental_health",
        "symptoms": [
            "persistent sadness", "loss of interest", "fatigue", "sleep problems",
            "appetite changes", "difficulty concentrating", "feelings of worthlessness",
            "thoughts of death", "irritability", "physical aches"
        ],
        "symptom_weights": {
            "persistent sadness": 0.9, "loss of interest": 0.9, "fatigue": 0.7,
            "sleep problems": 0.75, "appetite changes": 0.7, "difficulty concentrating": 0.65,
            "feelings of worthlessness": 0.8
        },
        "risk_factors": ["family history", "trauma", "chronic illness", "certain medications"],
        "age_modifier": {"0-18": 0.8, "19-60": 1.0, "61+": 1.1},
        "gender_modifier": {"female": 1.4, "male": 1.0},
        "severity": "moderate-severe"
    },
    "F41.1": {
        "name": "Generalized anxiety disorder",
        "category": "mental_health",
        "symptoms": [
            "excessive worry", "restlessness", "fatigue", "difficulty concentrating",
            "irritability", "muscle tension", "sleep problems", "racing thoughts",
            "feeling on edge", "panic attacks"
        ],
        "symptom_weights": {
            "excessive worry": 0.9, "restlessness": 0.8, "muscle tension": 0.75,
            "sleep problems": 0.7, "difficulty concentrating": 0.7, "feeling on edge": 0.8
        },
        "risk_factors": ["family history", "trauma", "chronic stress", "other mental disorders"],
        "age_modifier": {"0-18": 0.8, "19-60": 1.0, "61+": 0.9},
        "gender_modifier": {"female": 1.4, "male": 1.0},
        "severity": "moderate"
    },

    # Hematological Conditions
    "D64.9": {
        "name": "Anemia, unspecified",
        "category": "hematological",
        "symptoms": [
            "fatigue", "weakness", "pale skin", "shortness of breath", "dizziness",
            "cold hands and feet", "headache", "brittle nails", "rapid heartbeat"
        ],
        "symptom_weights": {
            "fatigue": 0.9, "weakness": 0.85, "pale skin": 0.85, "shortness of breath": 0.7,
            "dizziness": 0.7, "cold hands and feet": 0.65, "rapid heartbeat": 0.6
        },
        "risk_factors": ["menstruating women", "pregnancy", "chronic disease", "poor diet", "GI disorders"],
        "age_modifier": {"0-30": 0.9, "31-60": 1.0, "61+": 1.2},
        "gender_modifier": {"female": 1.4, "male": 1.0},
        "severity": "mild-moderate"
    },

    # Dermatological Conditions
    "L30.9": {
        "name": "Dermatitis, unspecified",
        "category": "dermatological",
        "symptoms": [
            "skin rash", "itching", "redness", "dry skin", "skin inflammation",
            "blisters", "skin thickening", "cracked skin"
        ],
        "symptom_weights": {
            "skin rash": 0.9, "itching": 0.85, "redness": 0.8, "dry skin": 0.7,
            "skin inflammation": 0.8, "blisters": 0.6
        },
        "risk_factors": ["allergies", "family history", "irritant exposure", "stress"],
        "age_modifier": {"0-12": 1.3, "13-60": 1.0, "61+": 1.1},
        "severity": "mild-moderate"
    },
    "L40.9": {
        "name": "Psoriasis, unspecified",
        "category": "dermatological",
        "symptoms": [
            "red patches with silvery scales", "dry cracked skin", "itching", "burning",
            "thick pitted nails", "stiff swollen joints", "skin plaques"
        ],
        "symptom_weights": {
            "red patches with silvery scales": 0.95, "dry cracked skin": 0.7, "itching": 0.75,
            "thick pitted nails": 0.8, "skin plaques": 0.85
        },
        "risk_factors": ["family history", "stress", "obesity", "smoking"],
        "age_modifier": {"0-30": 1.0, "31-60": 1.0, "61+": 0.9},
        "severity": "chronic"
    },
}

# Symptom to test mappings
SYMPTOM_TEST_RECOMMENDATIONS: Dict[str, List[str]] = {
    "fever": ["Complete Blood Count (CBC)", "Blood Culture", "C-Reactive Protein (CRP)", "Procalcitonin"],
    "cough": ["Chest X-ray", "Sputum Culture", "Pulmonary Function Test", "CT Chest"],
    "headache": ["CT Head", "MRI Brain", "Lumbar Puncture", "Eye Examination"],
    "chest pain": ["ECG", "Troponin I/T", "Chest X-ray", "Echocardiogram", "D-Dimer", "Stress Test"],
    "abdominal pain": ["Abdominal Ultrasound", "CT Abdomen", "Liver Function Test", "Lipase", "Amylase", "CBC"],
    "fatigue": ["CBC", "Thyroid Panel (TSH, T3, T4)", "Vitamin B12", "Iron Studies", "Basic Metabolic Panel"],
    "shortness of breath": ["Chest X-ray", "Pulmonary Function Test", "D-Dimer", "BNP/NT-proBNP", "ABG", "CT Angiography"],
    "nausea": ["Liver Function Test", "Lipase", "Abdominal Ultrasound", "Basic Metabolic Panel"],
    "dizziness": ["CBC", "Blood Glucose", "ECG", "Head CT", "Electrolytes", "Orthostatic Vitals"],
    "joint pain": ["X-ray", "Rheumatoid Factor", "Uric Acid", "ESR", "CRP", "ANA"],
    "weight loss": ["CBC", "Thyroid Panel", "Blood Glucose", "Liver Function Test", "CT Scan", "Cancer Markers"],
    "palpitations": ["ECG", "Holter Monitor", "Thyroid Panel", "Echocardiogram", "Electrolytes"],
    "swelling": ["CBC", "BMP", "Liver Function Test", "BNP", "Urinalysis", "Ultrasound"],
    "rash": ["Skin Biopsy", "Allergy Testing", "ANA", "CBC"],
    "numbness": ["EMG/NCS", "MRI Spine", "Blood Glucose", "Vitamin B12", "Thyroid Panel"],
    "seizure": ["EEG", "MRI Brain", "CT Head", "Basic Metabolic Panel", "Glucose", "Toxicology Screen"],
    "confusion": ["Basic Metabolic Panel", "Ammonia", "CT Head", "Urinalysis", "Thyroid Panel", "Toxicology"],
    "blood in urine": ["Urinalysis", "Urine Culture", "CT Urogram", "Cystoscopy", "CBC"],
    "blood in stool": ["CBC", "Stool Occult Blood", "Colonoscopy", "CT Abdomen", "Liver Function Test"],
}

# Drug interaction database
DRUG_INTERACTIONS_DATABASE: Dict[str, Dict[str, str]] = {
    "warfarin": {
        "aspirin": "Increased bleeding risk - avoid combination",
        "ibuprofen": "Increased bleeding risk and INR elevation",
        "naproxen": "Increased bleeding risk",
        "vitamin k": "Decreased warfarin effectiveness",
        "acetaminophen": "May increase INR with high doses",
    },
    "metformin": {
        "contrast dye": "Risk of lactic acidosis - hold metformin",
        "alcohol": "Increased risk of lactic acidosis",
    },
    "lisinopril": {
        "potassium supplements": "Risk of hyperkalemia",
        "spironolactone": "Risk of hyperkalemia",
        "nsaids": "Reduced antihypertensive effect",
    },
    "simvastatin": {
        "erythromycin": "Increased risk of myopathy",
        "clarithromycin": "Increased risk of myopathy",
        "grapefruit": "Increased statin levels",
        "amiodarone": "Limit simvastatin to 20mg",
    },
    "digoxin": {
        "amiodarone": "Increased digoxin levels",
        "verapamil": "Increased digoxin levels",
        "quinidine": "Increased digoxin levels",
    },
    "clopidogrel": {
        "omeprazole": "Reduced clopidogrel effectiveness",
        "esomeprazole": "Reduced clopidogrel effectiveness",
    },
    "ssri": {
        "tramadol": "Risk of serotonin syndrome",
        "maoi": "Risk of serotonin syndrome - contraindicated",
        "triptans": "Risk of serotonin syndrome",
    },
    "fluoxetine": {
        "tramadol": "Risk of serotonin syndrome",
        "maoi": "Risk of serotonin syndrome - contraindicated",
    },
    "sertraline": {
        "tramadol": "Risk of serotonin syndrome",
        "maoi": "Risk of serotonin syndrome - contraindicated",
    },
}

# Symptom synonyms for NLP matching
SYMPTOM_SYNONYMS: Dict[str, List[str]] = {
    "fever": ["high temperature", "pyrexia", "febrile", "elevated temperature", "burning up", "hot"],
    "headache": ["head pain", "cephalalgia", "migraine", "head hurts", "pounding head"],
    "cough": ["coughing", "hacking", "tussis", "dry cough", "wet cough", "productive cough"],
    "fatigue": ["tired", "tiredness", "exhaustion", "lethargy", "weakness", "worn out", "no energy"],
    "nausea": ["feeling sick", "queasy", "nauseated", "stomach upset", "want to vomit"],
    "vomiting": ["throwing up", "emesis", "puking", "being sick"],
    "diarrhea": ["loose stools", "watery stools", "frequent bowel movements", "runs"],
    "chest pain": ["chest discomfort", "chest tightness", "chest pressure", "angina"],
    "shortness of breath": ["dyspnea", "breathlessness", "difficulty breathing", "can't breathe", "winded"],
    "dizziness": ["lightheaded", "vertigo", "unsteady", "spinning", "woozy"],
    "abdominal pain": ["stomach pain", "belly pain", "tummy ache", "gut pain", "stomach cramps"],
    "joint pain": ["arthralgia", "joint ache", "painful joints", "joint stiffness"],
    "rash": ["skin eruption", "hives", "skin irritation", "spots"],
    "swelling": ["edema", "swollen", "puffiness", "inflammation"],
    "numbness": ["tingling", "paresthesia", "pins and needles", "loss of sensation"],
    "anxiety": ["anxious", "worried", "nervous", "panic", "stressed"],
    "depression": ["sad", "depressed", "down", "hopeless", "low mood"],
}
