"""
Clinical Risk Models Knowledge Base
Validated scoring systems and risk factors for predictive analytics
"""

from typing import Dict, List, Any
from dataclasses import dataclass
from enum import Enum


class RiskLevel(Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# LACE Index for 30-day readmission risk
# L = Length of stay, A = Acuity of admission, C = Comorbidities, E = ED visits
LACE_SCORING = {
    "length_of_stay": {
        # Days: Points
        1: 1, 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 5, 9: 5, 10: 5, 11: 5, 12: 5, 13: 5, 14: 7
    },
    "acuity": {
        "emergency": 3,
        "urgent": 2,
        "elective": 0
    },
    "comorbidity_max": 5,  # Maximum points for Charlson index
    "ed_visits": {
        # ED visits in past 6 months: Points
        0: 0, 1: 1, 2: 2, 3: 3, 4: 4
    }
}

# HOSPITAL Score for 30-day readmission
HOSPITAL_SCORING = {
    "hemoglobin_low": 1,  # <12 g/dL at discharge
    "discharge_from_oncology": 2,
    "sodium_low": 1,  # <135 mEq/L at discharge
    "procedure_during_stay": 1,
    "index_admission_type_urgent": 1,  # Non-elective
    "admissions_past_year": {0: 0, 1: 2, 2: 2, 3: 2, 4: 2, 5: 5},  # 5+ = 5 points
    "length_of_stay_5plus": 2
}

# Charlson Comorbidity Index
CHARLSON_WEIGHTS = {
    "myocardial_infarction": 1,
    "heart_failure": 1,
    "congestive_heart_failure": 1,
    "peripheral_vascular_disease": 1,
    "cerebrovascular_disease": 1,
    "stroke": 1,
    "dementia": 1,
    "chronic_pulmonary_disease": 1,
    "copd": 1,
    "asthma": 1,
    "connective_tissue_disease": 1,
    "rheumatoid_arthritis": 1,
    "lupus": 1,
    "peptic_ulcer_disease": 1,
    "mild_liver_disease": 1,
    "diabetes": 1,
    "diabetes_without_complications": 1,
    "diabetes_with_complications": 2,
    "hemiplegia": 2,
    "paraplegia": 2,
    "renal_disease": 2,
    "kidney_disease": 2,
    "chronic_kidney_disease": 2,
    "malignancy": 2,
    "cancer": 2,
    "leukemia": 2,
    "lymphoma": 2,
    "moderate_severe_liver_disease": 3,
    "liver_cirrhosis": 3,
    "metastatic_solid_tumor": 6,
    "metastatic_cancer": 6,
    "aids": 6,
    "hiv": 6,
}

# Age adjustment for Charlson
CHARLSON_AGE_ADJUSTMENT = {
    "50-59": 1,
    "60-69": 2,
    "70-79": 3,
    "80+": 4
}

# NEWS2 (National Early Warning Score 2) - for clinical deterioration
NEWS2_PARAMETERS = {
    "respiration_rate": {
        "<=8": 3, "9-11": 1, "12-20": 0, "21-24": 2, ">=25": 3
    },
    "oxygen_saturation": {
        "<=91": 3, "92-93": 2, "94-95": 1, ">=96": 0
    },
    "supplemental_oxygen": {
        "yes": 2, "no": 0
    },
    "temperature": {
        "<=35.0": 3, "35.1-36.0": 1, "36.1-38.0": 0, "38.1-39.0": 1, ">=39.1": 2
    },
    "systolic_bp": {
        "<=90": 3, "91-100": 2, "101-110": 1, "111-219": 0, ">=220": 3
    },
    "heart_rate": {
        "<=40": 3, "41-50": 1, "51-90": 0, "91-110": 1, "111-130": 2, ">=131": 3
    },
    "consciousness": {
        "alert": 0, "confusion": 3, "voice": 3, "pain": 3, "unresponsive": 3
    }
}

NEWS2_RISK_THRESHOLDS = {
    0: {"level": "LOW", "response": "Minimum 12-hourly monitoring"},
    1: {"level": "LOW", "response": "Minimum 4-6 hourly monitoring"},
    2: {"level": "LOW", "response": "Minimum 4-6 hourly monitoring"},
    3: {"level": "LOW", "response": "Minimum 4-6 hourly monitoring"},
    4: {"level": "LOW", "response": "Minimum 4-6 hourly monitoring"},
    5: {"level": "MODERATE", "response": "Hourly monitoring, urgent clinical review"},
    6: {"level": "MODERATE", "response": "Hourly monitoring, urgent clinical review"},
    7: {"level": "HIGH", "response": "Continuous monitoring, emergency response"},
}

# APACHE II scoring elements (simplified)
APACHE_PARAMETERS = {
    "temperature": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "mean_arterial_pressure": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "heart_rate": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "respiratory_rate": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "oxygenation": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "arterial_ph": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "sodium": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "potassium": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "creatinine": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "hematocrit": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "wbc": {"normal": 0, "mild": 1, "moderate": 2, "severe": 4},
    "gcs": {"15": 0, "13-14": 1, "10-12": 2, "6-9": 3, "3-5": 4},
}

# Risk factors by prediction type
READMISSION_RISK_FACTORS = {
    "age_over_65": {"weight": 0.08, "description": "Age over 65 years"},
    "age_over_75": {"weight": 0.12, "description": "Age over 75 years"},
    "age_over_85": {"weight": 0.15, "description": "Age over 85 years"},
    "multiple_comorbidities": {"weight": 0.15, "description": "Multiple chronic conditions"},
    "recent_hospitalization": {"weight": 0.20, "description": "Hospitalization in past 6 months"},
    "polypharmacy": {"weight": 0.10, "description": "Taking 5+ medications"},
    "poor_social_support": {"weight": 0.12, "description": "Limited social support"},
    "mental_health_condition": {"weight": 0.10, "description": "Mental health diagnosis"},
    "substance_use": {"weight": 0.12, "description": "Substance use history"},
    "medication_non_adherence": {"weight": 0.15, "description": "History of non-adherence"},
    "frequent_ed_visits": {"weight": 0.18, "description": "Frequent ED visits (3+ in 6 months)"},
    "unplanned_admission": {"weight": 0.10, "description": "Unplanned/emergency admission"},
    "high_acuity": {"weight": 0.12, "description": "High acuity at admission"},
}

MORTALITY_RISK_FACTORS = {
    "age_over_70": {"weight": 0.10, "description": "Age over 70 years"},
    "age_over_80": {"weight": 0.15, "description": "Age over 80 years"},
    "metastatic_cancer": {"weight": 0.25, "description": "Metastatic malignancy"},
    "sepsis": {"weight": 0.20, "description": "Sepsis or severe infection"},
    "respiratory_failure": {"weight": 0.18, "description": "Respiratory failure"},
    "acute_kidney_injury": {"weight": 0.15, "description": "Acute kidney injury"},
    "cardiac_arrest": {"weight": 0.30, "description": "History of cardiac arrest"},
    "icu_admission": {"weight": 0.12, "description": "ICU admission"},
    "mechanical_ventilation": {"weight": 0.20, "description": "Mechanical ventilation"},
    "multi_organ_failure": {"weight": 0.35, "description": "Multi-organ failure"},
    "shock": {"weight": 0.22, "description": "Shock (any type)"},
    "altered_mental_status": {"weight": 0.12, "description": "Altered mental status"},
}

LENGTH_OF_STAY_FACTORS = {
    "age_over_65": {"days": 1, "description": "Age over 65 years"},
    "age_over_75": {"days": 2, "description": "Age over 75 years"},
    "surgical_procedure": {"days": 2, "description": "Surgical procedure required"},
    "infection": {"days": 3, "description": "Active infection"},
    "multiple_comorbidities": {"days": 2, "description": "Multiple comorbidities"},
    "icu_required": {"days": 3, "description": "ICU stay required"},
    "rehabilitation_needed": {"days": 4, "description": "Rehabilitation needed"},
    "complex_discharge": {"days": 2, "description": "Complex discharge planning"},
    "social_issues": {"days": 2, "description": "Social placement issues"},
}

NO_SHOW_RISK_FACTORS = {
    "previous_no_shows": {"weight": 0.25, "description": "History of missed appointments"},
    "new_patient": {"weight": 0.08, "description": "New patient"},
    "long_wait_time": {"weight": 0.10, "description": "Long time since scheduling"},
    "transportation_issues": {"weight": 0.15, "description": "Transportation challenges"},
    "mental_health": {"weight": 0.12, "description": "Mental health diagnosis"},
    "substance_use": {"weight": 0.15, "description": "Substance use history"},
    "no_insurance": {"weight": 0.10, "description": "Uninsured or underinsured"},
    "young_age": {"weight": 0.08, "description": "Age under 30"},
    "monday_friday": {"weight": 0.05, "description": "Monday or Friday appointment"},
    "afternoon_slot": {"weight": 0.03, "description": "Afternoon appointment time"},
}

DETERIORATION_RISK_FACTORS = {
    "tachycardia": {"weight": 0.12, "threshold": "HR > 100", "description": "Elevated heart rate"},
    "bradycardia": {"weight": 0.10, "threshold": "HR < 50", "description": "Low heart rate"},
    "hypotension": {"weight": 0.18, "threshold": "SBP < 90", "description": "Low blood pressure"},
    "hypertension_severe": {"weight": 0.12, "threshold": "SBP > 180", "description": "Severe hypertension"},
    "tachypnea": {"weight": 0.15, "threshold": "RR > 24", "description": "Elevated respiratory rate"},
    "hypoxia": {"weight": 0.20, "threshold": "SpO2 < 92%", "description": "Low oxygen saturation"},
    "fever_high": {"weight": 0.10, "threshold": "Temp > 39°C", "description": "High fever"},
    "hypothermia": {"weight": 0.12, "threshold": "Temp < 35°C", "description": "Hypothermia"},
    "altered_consciousness": {"weight": 0.25, "description": "Altered level of consciousness"},
    "worsening_labs": {"weight": 0.15, "description": "Worsening laboratory values"},
    "increasing_oxygen_need": {"weight": 0.18, "description": "Increasing oxygen requirements"},
}

# Lab value reference ranges and risk thresholds
LAB_REFERENCE_RANGES = {
    "hemoglobin": {
        "unit": "g/dL",
        "normal_male": (13.5, 17.5),
        "normal_female": (12.0, 16.0),
        "critical_low": 7.0,
        "critical_high": 20.0
    },
    "white_blood_cell": {
        "unit": "K/uL",
        "normal": (4.5, 11.0),
        "critical_low": 2.0,
        "critical_high": 30.0
    },
    "platelet": {
        "unit": "K/uL",
        "normal": (150, 400),
        "critical_low": 50,
        "critical_high": 1000
    },
    "creatinine": {
        "unit": "mg/dL",
        "normal_male": (0.7, 1.3),
        "normal_female": (0.6, 1.1),
        "critical_high": 4.0
    },
    "bun": {
        "unit": "mg/dL",
        "normal": (7, 20),
        "critical_high": 100
    },
    "sodium": {
        "unit": "mEq/L",
        "normal": (136, 145),
        "critical_low": 120,
        "critical_high": 160
    },
    "potassium": {
        "unit": "mEq/L",
        "normal": (3.5, 5.0),
        "critical_low": 2.5,
        "critical_high": 6.5
    },
    "glucose": {
        "unit": "mg/dL",
        "normal_fasting": (70, 100),
        "critical_low": 40,
        "critical_high": 500
    },
    "troponin": {
        "unit": "ng/mL",
        "normal": (0, 0.04),
        "elevated": 0.04
    },
    "bnp": {
        "unit": "pg/mL",
        "normal": (0, 100),
        "elevated_heart_failure": 400
    },
    "lactate": {
        "unit": "mmol/L",
        "normal": (0.5, 2.0),
        "critical_high": 4.0
    },
    "procalcitonin": {
        "unit": "ng/mL",
        "normal": (0, 0.5),
        "sepsis_likely": 2.0
    }
}

# Disease-specific progression models
DISEASE_PROGRESSION_MODELS = {
    "diabetes": {
        "factors": ["hba1c_control", "medication_adherence", "comorbidities", "duration"],
        "stages": ["prediabetes", "controlled", "uncontrolled", "complications"],
        "complications": ["retinopathy", "nephropathy", "neuropathy", "cardiovascular"]
    },
    "heart_failure": {
        "factors": ["ejection_fraction", "bnp_levels", "functional_class", "hospitalizations"],
        "stages": ["stage_a", "stage_b", "stage_c", "stage_d"],
        "nyha_classes": ["I", "II", "III", "IV"]
    },
    "copd": {
        "factors": ["fev1", "exacerbations", "symptoms", "smoking_status"],
        "stages": ["mild", "moderate", "severe", "very_severe"],
        "gold_stages": [1, 2, 3, 4]
    },
    "ckd": {
        "factors": ["egfr", "albuminuria", "blood_pressure", "comorbidities"],
        "stages": ["stage_1", "stage_2", "stage_3a", "stage_3b", "stage_4", "stage_5"],
        "egfr_thresholds": [90, 60, 45, 30, 15]
    }
}

# Intervention recommendations by risk level
INTERVENTION_RECOMMENDATIONS = {
    "readmission": {
        "LOW": [
            "Standard discharge planning",
            "Routine follow-up within 2 weeks",
            "Medication reconciliation at discharge"
        ],
        "MODERATE": [
            "Enhanced discharge planning",
            "Follow-up within 7 days",
            "Phone call within 48 hours post-discharge",
            "Medication management review",
            "Ensure understanding of warning signs"
        ],
        "HIGH": [
            "Intensive discharge planning",
            "Follow-up within 48-72 hours",
            "Home health referral",
            "Care coordinator assignment",
            "Daily phone monitoring first week",
            "Medication therapy management"
        ],
        "CRITICAL": [
            "Consider extended hospitalization",
            "Multidisciplinary care conference",
            "Home health with skilled nursing",
            "Same-day post-discharge follow-up",
            "Daily care coordination calls",
            "Pharmacy medication management",
            "Social work intervention"
        ]
    },
    "deterioration": {
        "LOW": [
            "Continue current monitoring frequency",
            "Reassess in 4-6 hours"
        ],
        "MODERATE": [
            "Increase monitoring to hourly",
            "Notify charge nurse",
            "Prepare for possible intervention",
            "Review current treatment plan"
        ],
        "HIGH": [
            "Continuous monitoring",
            "Immediate physician notification",
            "Activate rapid response team",
            "Consider ICU transfer"
        ],
        "CRITICAL": [
            "Activate code team if appropriate",
            "Immediate ICU transfer",
            "Aggressive intervention",
            "Family notification"
        ]
    },
    "mortality": {
        "LOW": [
            "Standard care pathway",
            "Routine monitoring"
        ],
        "MODERATE": [
            "Enhanced monitoring",
            "Review treatment plan",
            "Advance care planning discussion"
        ],
        "HIGH": [
            "Intensive care consideration",
            "Palliative care consultation",
            "Family meeting recommended",
            "Goals of care discussion"
        ],
        "CRITICAL": [
            "ICU level care",
            "Palliative care involvement",
            "Ethics consultation if appropriate",
            "Family support services",
            "Hospice consideration if appropriate"
        ]
    }
}
