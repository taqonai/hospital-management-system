"""
Medication Administration Safety Service
Comprehensive medication safety verification for nursing staff
Implements 5 Rights verification, high-alert drug warnings, dose checking, and more
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import logging
import re
import math

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
    INFO = "INFO"


class VerificationStatus(Enum):
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    WARNING = "WARNING"
    PENDING = "PENDING"


# High-Alert Medications Database
HIGH_ALERT_MEDICATIONS = {
    # Anticoagulants
    "heparin": {"category": "Anticoagulant", "risk": "Bleeding", "special_checks": ["PTT monitoring", "Weight-based dosing"]},
    "warfarin": {"category": "Anticoagulant", "risk": "Bleeding", "special_checks": ["INR monitoring", "Drug interactions"]},
    "enoxaparin": {"category": "Anticoagulant", "risk": "Bleeding", "special_checks": ["Renal function", "Weight-based dosing"]},
    "rivaroxaban": {"category": "Anticoagulant", "risk": "Bleeding", "special_checks": ["Renal function"]},
    "apixaban": {"category": "Anticoagulant", "risk": "Bleeding", "special_checks": ["Renal function"]},
    "dabigatran": {"category": "Anticoagulant", "risk": "Bleeding", "special_checks": ["Renal function"]},

    # Insulins
    "insulin regular": {"category": "Insulin", "risk": "Hypoglycemia", "special_checks": ["Blood glucose", "Sliding scale protocol"]},
    "insulin lispro": {"category": "Insulin", "risk": "Hypoglycemia", "special_checks": ["Blood glucose", "Give with meals"]},
    "insulin aspart": {"category": "Insulin", "risk": "Hypoglycemia", "special_checks": ["Blood glucose", "Give with meals"]},
    "insulin glargine": {"category": "Insulin", "risk": "Hypoglycemia", "special_checks": ["Blood glucose", "Once daily dosing"]},
    "insulin detemir": {"category": "Insulin", "risk": "Hypoglycemia", "special_checks": ["Blood glucose"]},
    "insulin nph": {"category": "Insulin", "risk": "Hypoglycemia", "special_checks": ["Blood glucose", "Timing critical"]},

    # Opioids
    "morphine": {"category": "Opioid", "risk": "Respiratory depression", "special_checks": ["Respiratory rate", "Sedation level", "Naloxone available"]},
    "hydromorphone": {"category": "Opioid", "risk": "Respiratory depression", "special_checks": ["Respiratory rate", "Sedation level", "5x potency of morphine"]},
    "fentanyl": {"category": "Opioid", "risk": "Respiratory depression", "special_checks": ["Respiratory rate", "Sedation level", "Patch rotation"]},
    "oxycodone": {"category": "Opioid", "risk": "Respiratory depression", "special_checks": ["Respiratory rate", "Sedation level"]},
    "methadone": {"category": "Opioid", "risk": "Respiratory depression, QT prolongation", "special_checks": ["Respiratory rate", "ECG monitoring"]},
    "hydrocodone": {"category": "Opioid", "risk": "Respiratory depression", "special_checks": ["Respiratory rate", "Sedation level"]},

    # Sedatives
    "propofol": {"category": "Sedative", "risk": "Respiratory depression, Hypotension", "special_checks": ["Continuous monitoring", "Airway management"]},
    "ketamine": {"category": "Sedative/Anesthetic", "risk": "Respiratory depression, Emergence reactions", "special_checks": ["Continuous monitoring"]},
    "midazolam": {"category": "Benzodiazepine", "risk": "Respiratory depression", "special_checks": ["Respiratory rate", "Flumazenil available"]},
    "lorazepam": {"category": "Benzodiazepine", "risk": "Respiratory depression", "special_checks": ["Respiratory rate"]},

    # Chemotherapy agents
    "methotrexate": {"category": "Chemotherapy", "risk": "Bone marrow suppression", "special_checks": ["CBC monitoring", "Renal function", "Folic acid supplementation"]},
    "vincristine": {"category": "Chemotherapy", "risk": "Neurotoxicity", "special_checks": ["IV ONLY - fatal if intrathecal"]},
    "doxorubicin": {"category": "Chemotherapy", "risk": "Cardiotoxicity", "special_checks": ["Cumulative dose tracking", "Echo monitoring"]},

    # Electrolytes
    "potassium chloride": {"category": "Electrolyte", "risk": "Cardiac arrhythmia", "special_checks": ["Rate not >10 mEq/hr", "Cardiac monitoring", "Never IV push"]},
    "magnesium sulfate": {"category": "Electrolyte", "risk": "Respiratory depression", "special_checks": ["Deep tendon reflexes", "Respiratory rate"]},
    "calcium chloride": {"category": "Electrolyte", "risk": "Cardiac arrhythmia", "special_checks": ["Central line preferred", "Cardiac monitoring"]},
    "sodium chloride 3%": {"category": "Electrolyte", "risk": "Osmotic demyelination", "special_checks": ["Central line required", "Sodium monitoring q2h"]},

    # Cardiovascular
    "digoxin": {"category": "Cardiac Glycoside", "risk": "Toxicity, Arrhythmia", "special_checks": ["Serum level", "Potassium level", "Heart rate >60"]},
    "amiodarone": {"category": "Antiarrhythmic", "risk": "QT prolongation, Hypotension", "special_checks": ["ECG monitoring", "Thyroid function"]},
    "dopamine": {"category": "Vasopressor", "risk": "Arrhythmia, Extravasation", "special_checks": ["Central line preferred", "Continuous monitoring"]},
    "norepinephrine": {"category": "Vasopressor", "risk": "Arrhythmia, Extravasation", "special_checks": ["Central line required", "Continuous monitoring"]},
    "epinephrine": {"category": "Vasopressor", "risk": "Arrhythmia, Hypertension", "special_checks": ["Continuous monitoring", "Concentration verification"]},
    "dobutamine": {"category": "Inotrope", "risk": "Arrhythmia", "special_checks": ["Continuous monitoring"]},

    # Neuromuscular blockers
    "rocuronium": {"category": "Neuromuscular Blocker", "risk": "Respiratory paralysis", "special_checks": ["Intubation ready", "Never give to awake patient"]},
    "succinylcholine": {"category": "Neuromuscular Blocker", "risk": "Respiratory paralysis, Hyperkalemia", "special_checks": ["Intubation ready", "Malignant hyperthermia risk"]},
    "vecuronium": {"category": "Neuromuscular Blocker", "risk": "Respiratory paralysis", "special_checks": ["Intubation ready"]},
}

# Look-Alike Sound-Alike (LASA) Drug Pairs
LASA_DRUG_PAIRS = [
    ("hydroxyzine", "hydralazine"),
    ("prednisone", "prednisolone"),
    ("metformin", "metronidazole"),
    ("clonidine", "klonopin"),
    ("clonidine", "clonazepam"),
    ("tramadol", "trazodone"),
    ("celebrex", "celexa"),
    ("celebrex", "cerebyx"),
    ("zantac", "zyrtec"),
    ("zantac", "xanax"),
    ("losartan", "lisinopril"),
    ("amlodipine", "amiloride"),
    ("glipizide", "glyburide"),
    ("atenolol", "albuterol"),
    ("carbamazepine", "oxcarbazepine"),
    ("morphine", "hydromorphone"),
    ("fentanyl", "sufentanil"),
    ("vincristine", "vinblastine"),
    ("dopamine", "dobutamine"),
    ("epinephrine", "norepinephrine"),
    ("heparin", "hespan"),
    ("humalog", "humulin"),
    ("novolog", "novolin"),
    ("methadone", "methylphenidate"),
    ("oxycodone", "oxycontin"),
    ("oxycodone", "hydrocodone"),
    ("dextrose", "dextran"),
    ("amphotericin b", "amphotericin b lipid"),
    ("clomipramine", "clomiphene"),
    ("cyclosporine", "cyclophosphamide"),
    ("daunorubicin", "doxorubicin"),
]

# Standard dose ranges by drug (min, max per administration, max daily)
DOSE_RANGES = {
    # Opioids (in mg)
    "morphine": {"adult": {"min": 2, "max": 15, "daily_max": 100}, "pediatric": {"per_kg_min": 0.05, "per_kg_max": 0.1}, "geriatric_reduction": 0.5},
    "hydromorphone": {"adult": {"min": 0.5, "max": 4, "daily_max": 32}, "pediatric": {"per_kg_min": 0.01, "per_kg_max": 0.02}, "geriatric_reduction": 0.5},
    "fentanyl": {"adult": {"min": 25, "max": 100, "daily_max": 400}, "unit": "mcg"},  # IV mcg
    "oxycodone": {"adult": {"min": 5, "max": 30, "daily_max": 120}, "geriatric_reduction": 0.5},

    # Insulins (in units)
    "insulin regular": {"adult": {"min": 1, "max": 50, "daily_max": 200}, "unit": "units"},
    "insulin lispro": {"adult": {"min": 1, "max": 30, "daily_max": 150}, "unit": "units"},
    "insulin glargine": {"adult": {"min": 10, "max": 100, "daily_max": 100}, "unit": "units"},

    # Anticoagulants
    "heparin": {"adult": {"bolus_min": 2500, "bolus_max": 10000, "infusion_min": 500, "infusion_max": 2000}, "unit": "units", "weight_based": True},
    "enoxaparin": {"adult": {"min": 30, "max": 150, "daily_max": 300}, "weight_based": True, "per_kg": 1},
    "warfarin": {"adult": {"min": 1, "max": 10, "daily_max": 10}},

    # Common medications
    "acetaminophen": {"adult": {"min": 325, "max": 1000, "daily_max": 4000}, "pediatric": {"per_kg_min": 10, "per_kg_max": 15, "daily_max_per_kg": 75}},
    "ibuprofen": {"adult": {"min": 200, "max": 800, "daily_max": 3200}, "pediatric": {"per_kg_min": 5, "per_kg_max": 10}},
    "metformin": {"adult": {"min": 500, "max": 1000, "daily_max": 2550}},
    "lisinopril": {"adult": {"min": 2.5, "max": 40, "daily_max": 80}},
    "amlodipine": {"adult": {"min": 2.5, "max": 10, "daily_max": 10}},
    "metoprolol": {"adult": {"min": 25, "max": 200, "daily_max": 400}},
    "omeprazole": {"adult": {"min": 20, "max": 40, "daily_max": 80}},
    "furosemide": {"adult": {"min": 20, "max": 80, "daily_max": 600}, "pediatric": {"per_kg_min": 1, "per_kg_max": 2}},

    # Electrolytes
    "potassium chloride": {"adult": {"min": 10, "max": 40, "daily_max": 200, "max_rate": 10}, "unit": "mEq"},
    "magnesium sulfate": {"adult": {"min": 1, "max": 4, "daily_max": 16}, "unit": "grams"},

    # Antibiotics
    "vancomycin": {"adult": {"min": 500, "max": 2000, "daily_max": 4000}, "weight_based": True, "per_kg": 15},
    "gentamicin": {"adult": {"min": 80, "max": 400, "daily_max": 600}, "weight_based": True, "per_kg": 5},
    "amoxicillin": {"adult": {"min": 250, "max": 1000, "daily_max": 3000}, "pediatric": {"per_kg_min": 25, "per_kg_max": 50}},
}

# IV Compatibility Database
IV_COMPATIBILITY = {
    "compatible": [
        ("morphine", "ondansetron"),
        ("morphine", "metoclopramide"),
        ("furosemide", "potassium chloride"),
        ("insulin regular", "potassium chloride"),
        ("heparin", "morphine"),
        ("dopamine", "dobutamine"),
        ("norepinephrine", "epinephrine"),
        ("vancomycin", "metronidazole"),
        ("ceftriaxone", "metronidazole"),
    ],
    "incompatible": [
        ("phenytoin", "dextrose"),
        ("ampicillin", "gentamicin"),
        ("diazepam", "any"),
        ("pantoprazole", "midazolam"),
        ("furosemide", "amiodarone"),
        ("heparin", "alteplase"),
        ("calcium", "phosphate"),
        ("calcium", "ceftriaxone"),
        ("phenytoin", "any_other"),
        ("acyclovir", "any_other"),
        ("amphotericin b", "sodium chloride"),
        ("vancomycin", "heparin"),
        ("insulin", "dopamine"),
    ],
    "y_site_incompatible": [
        ("furosemide", "ciprofloxacin"),
        ("ceftriaxone", "calcium"),
        ("pantoprazole", "many"),
        ("phenytoin", "most"),
    ]
}

# Administration routes
VALID_ROUTES = {
    "PO": ["oral", "by mouth", "po"],
    "IV": ["intravenous", "iv", "ivp", "ivpb", "iv push", "iv piggyback"],
    "IM": ["intramuscular", "im"],
    "SC": ["subcutaneous", "sq", "subq", "sc"],
    "SL": ["sublingual", "sl"],
    "PR": ["rectal", "pr", "per rectum"],
    "TOP": ["topical", "top", "external"],
    "INH": ["inhaled", "inhalation", "inh", "nebulized"],
    "OPTH": ["ophthalmic", "eye drops"],
    "OTIC": ["otic", "ear drops"],
    "NASAL": ["nasal", "intranasal"],
    "TD": ["transdermal", "patch"],
    "IT": ["intrathecal"],
    "EPIDURAL": ["epidural"],
    "NG": ["nasogastric", "ng tube", "peg", "g-tube"],
}


class MedicationSafetyAI:
    """AI-powered Medication Administration Safety System"""

    def __init__(self):
        self.model_version = "1.0.0"

    def verify_five_rights(
        self,
        patient_id: str,
        patient_name: str,
        patient_dob: str,
        scanned_patient_id: str,
        medication_name: str,
        scanned_barcode: Optional[str],
        ordered_dose: float,
        ordered_unit: str,
        ordered_route: str,
        scheduled_time: str,
        current_time: Optional[str] = None,
        patient_weight: Optional[float] = None,
        patient_age: Optional[int] = None,
        allergies: Optional[List[str]] = None,
        current_medications: Optional[List[str]] = None,
        renal_function: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Verify the 5 Rights of medication administration:
        1. Right Patient
        2. Right Drug
        3. Right Dose
        4. Right Route
        5. Right Time
        """
        results = {
            "overallStatus": VerificationStatus.VERIFIED.value,
            "rights": {},
            "alerts": [],
            "warnings": [],
            "recommendations": [],
            "isHighAlertMedication": False,
            "highAlertInfo": None,
            "lasaAlert": None,
            "timestamp": datetime.now().isoformat(),
            "modelVersion": self.model_version,
        }

        alerts = []
        warnings = []

        # 1. Right Patient Verification
        patient_result = self._verify_right_patient(
            patient_id, patient_name, patient_dob, scanned_patient_id
        )
        results["rights"]["patient"] = patient_result
        if patient_result["status"] == VerificationStatus.FAILED.value:
            results["overallStatus"] = VerificationStatus.FAILED.value
            alerts.append({
                "severity": AlertSeverity.CRITICAL.value,
                "message": "PATIENT MISMATCH - DO NOT ADMINISTER",
                "details": patient_result["message"]
            })

        # 2. Right Drug Verification
        drug_result = self._verify_right_drug(
            medication_name, scanned_barcode, allergies, current_medications
        )
        results["rights"]["drug"] = drug_result
        if drug_result["status"] == VerificationStatus.FAILED.value:
            results["overallStatus"] = VerificationStatus.FAILED.value
            alerts.extend(drug_result.get("alerts", []))
        elif drug_result["status"] == VerificationStatus.WARNING.value:
            if results["overallStatus"] != VerificationStatus.FAILED.value:
                results["overallStatus"] = VerificationStatus.WARNING.value
            warnings.extend(drug_result.get("warnings", []))

        # 3. Right Dose Verification
        dose_result = self._verify_right_dose(
            medication_name, ordered_dose, ordered_unit, ordered_route,
            patient_weight, patient_age, renal_function
        )
        results["rights"]["dose"] = dose_result
        if dose_result["status"] == VerificationStatus.FAILED.value:
            results["overallStatus"] = VerificationStatus.FAILED.value
            alerts.extend(dose_result.get("alerts", []))
        elif dose_result["status"] == VerificationStatus.WARNING.value:
            if results["overallStatus"] != VerificationStatus.FAILED.value:
                results["overallStatus"] = VerificationStatus.WARNING.value
            warnings.extend(dose_result.get("warnings", []))

        # 4. Right Route Verification
        route_result = self._verify_right_route(medication_name, ordered_route)
        results["rights"]["route"] = route_result
        if route_result["status"] == VerificationStatus.FAILED.value:
            results["overallStatus"] = VerificationStatus.FAILED.value
            alerts.extend(route_result.get("alerts", []))
        elif route_result["status"] == VerificationStatus.WARNING.value:
            if results["overallStatus"] != VerificationStatus.FAILED.value:
                results["overallStatus"] = VerificationStatus.WARNING.value
            warnings.extend(route_result.get("warnings", []))

        # 5. Right Time Verification
        time_result = self._verify_right_time(scheduled_time, current_time)
        results["rights"]["time"] = time_result
        if time_result["status"] == VerificationStatus.WARNING.value:
            if results["overallStatus"] == VerificationStatus.VERIFIED.value:
                results["overallStatus"] = VerificationStatus.WARNING.value
            warnings.extend(time_result.get("warnings", []))

        # Check for high-alert medication
        high_alert = self._check_high_alert_medication(medication_name)
        if high_alert:
            results["isHighAlertMedication"] = True
            results["highAlertInfo"] = high_alert
            warnings.append({
                "severity": AlertSeverity.HIGH.value,
                "message": f"HIGH-ALERT MEDICATION: {medication_name.upper()}",
                "details": f"Category: {high_alert['category']}. Risk: {high_alert['risk']}",
                "specialChecks": high_alert["special_checks"]
            })

        # Check for LASA drugs
        lasa_alert = self._check_lasa_drugs(medication_name, current_medications)
        if lasa_alert:
            results["lasaAlert"] = lasa_alert
            warnings.append({
                "severity": AlertSeverity.MODERATE.value,
                "message": "LOOK-ALIKE/SOUND-ALIKE ALERT",
                "details": lasa_alert["message"],
                "confusableWith": lasa_alert["similar_drugs"]
            })

        results["alerts"] = alerts
        results["warnings"] = warnings

        # Generate recommendations
        results["recommendations"] = self._generate_recommendations(
            results, medication_name, ordered_route
        )

        return results

    def _verify_right_patient(
        self,
        patient_id: str,
        patient_name: str,
        patient_dob: str,
        scanned_patient_id: str
    ) -> Dict[str, Any]:
        """Verify patient identity matches"""
        if patient_id == scanned_patient_id:
            return {
                "status": VerificationStatus.VERIFIED.value,
                "message": "Patient identity confirmed",
                "patientId": patient_id,
                "patientName": patient_name,
                "verificationMethod": "Wristband barcode scan"
            }
        else:
            return {
                "status": VerificationStatus.FAILED.value,
                "message": f"PATIENT ID MISMATCH: Expected {patient_id}, scanned {scanned_patient_id}",
                "expectedId": patient_id,
                "scannedId": scanned_patient_id,
                "action": "Verify patient identity using two identifiers"
            }

    def _verify_right_drug(
        self,
        medication_name: str,
        scanned_barcode: Optional[str],
        allergies: Optional[List[str]],
        current_medications: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Verify correct medication and check for allergies/interactions"""
        result = {
            "status": VerificationStatus.VERIFIED.value,
            "medication": medication_name,
            "barcodeVerified": scanned_barcode is not None,
            "alerts": [],
            "warnings": []
        }

        med_lower = medication_name.lower()

        # Check for allergies
        if allergies:
            allergy_lower = [a.lower() for a in allergies]
            for allergy in allergy_lower:
                if allergy in med_lower or med_lower in allergy:
                    result["status"] = VerificationStatus.FAILED.value
                    result["alerts"].append({
                        "severity": AlertSeverity.CRITICAL.value,
                        "type": "ALLERGY",
                        "message": f"DOCUMENTED ALLERGY TO {allergy.upper()}",
                        "action": "DO NOT ADMINISTER - Contact prescriber"
                    })
                    return result

                # Check cross-reactivity
                cross_reactions = self._check_cross_reactivity(allergy, med_lower)
                if cross_reactions:
                    result["status"] = VerificationStatus.WARNING.value
                    result["warnings"].append({
                        "severity": AlertSeverity.HIGH.value,
                        "type": "CROSS_REACTIVITY",
                        "message": f"Potential cross-reactivity: allergy to {allergy}, prescribed {medication_name}",
                        "action": "Verify with prescriber before administration"
                    })

        return result

    def _check_cross_reactivity(self, allergy: str, medication: str) -> bool:
        """Check for potential cross-reactivity between allergy and medication"""
        cross_reactivity_groups = {
            "penicillin": ["amoxicillin", "ampicillin", "piperacillin", "cephalosporin", "cefazolin", "ceftriaxone"],
            "sulfa": ["sulfamethoxazole", "sulfasalazine", "celecoxib", "furosemide"],
            "aspirin": ["nsaid", "ibuprofen", "naproxen", "ketorolac"],
            "codeine": ["morphine", "hydrocodone", "oxycodone"],
        }

        for group, drugs in cross_reactivity_groups.items():
            if group in allergy:
                if any(drug in medication for drug in drugs):
                    return True
            if any(drug in allergy for drug in drugs):
                if group in medication or any(drug in medication for drug in drugs):
                    return True

        return False

    def _verify_right_dose(
        self,
        medication_name: str,
        dose: float,
        unit: str,
        route: str,
        weight: Optional[float],
        age: Optional[int],
        renal_function: Optional[str]
    ) -> Dict[str, Any]:
        """Verify dose is within acceptable range"""
        result = {
            "status": VerificationStatus.VERIFIED.value,
            "orderedDose": f"{dose} {unit}",
            "alerts": [],
            "warnings": [],
            "doseCalculation": None
        }

        med_lower = medication_name.lower()
        dose_info = None

        # Find dose range
        for drug_name, info in DOSE_RANGES.items():
            if drug_name in med_lower:
                dose_info = info
                break

        if not dose_info:
            result["warnings"].append({
                "severity": AlertSeverity.LOW.value,
                "type": "DOSE_RANGE_UNKNOWN",
                "message": "Dose range not in database - verify with pharmacy",
                "action": "Consult drug reference or pharmacist"
            })
            return result

        # Determine patient category
        is_pediatric = age is not None and age < 18
        is_geriatric = age is not None and age >= 65

        if is_pediatric and weight and "pediatric" in dose_info:
            # Weight-based pediatric dosing
            ped_info = dose_info["pediatric"]
            min_dose = ped_info.get("per_kg_min", 0) * weight
            max_dose = ped_info.get("per_kg_max", float("inf")) * weight

            result["doseCalculation"] = {
                "type": "weight-based",
                "weight": weight,
                "minDose": round(min_dose, 2),
                "maxDose": round(max_dose, 2),
                "unit": unit
            }

            if dose < min_dose * 0.8:
                result["status"] = VerificationStatus.WARNING.value
                result["warnings"].append({
                    "severity": AlertSeverity.MODERATE.value,
                    "type": "SUBTHERAPEUTIC_DOSE",
                    "message": f"Dose may be subtherapeutic. Calculated range: {min_dose:.1f}-{max_dose:.1f} {unit}",
                    "action": "Verify dose with prescriber"
                })
            elif dose > max_dose * 1.2:
                result["status"] = VerificationStatus.FAILED.value
                result["alerts"].append({
                    "severity": AlertSeverity.CRITICAL.value,
                    "type": "OVERDOSE_RISK",
                    "message": f"DOSE EXCEEDS MAXIMUM: {dose} {unit} > max {max_dose:.1f} {unit}",
                    "action": "DO NOT ADMINISTER - Contact prescriber immediately"
                })

        elif "adult" in dose_info:
            adult_info = dose_info["adult"]
            min_dose = adult_info.get("min", 0)
            max_dose = adult_info.get("max", float("inf"))

            # Apply weight-based adjustment if applicable
            if dose_info.get("weight_based") and weight:
                per_kg = dose_info.get("per_kg", 1)
                calculated_dose = weight * per_kg
                result["doseCalculation"] = {
                    "type": "weight-based",
                    "weight": weight,
                    "calculatedDose": round(calculated_dose, 2),
                    "unit": unit
                }

            # Apply geriatric reduction
            if is_geriatric and "geriatric_reduction" in dose_info:
                max_dose *= dose_info["geriatric_reduction"]
                result["warnings"].append({
                    "severity": AlertSeverity.MODERATE.value,
                    "type": "GERIATRIC_ADJUSTMENT",
                    "message": f"Geriatric patient - max dose reduced to {max_dose} {unit}",
                    "action": "Monitor for adverse effects"
                })

            # Apply renal adjustment
            if renal_function and renal_function in ["severe", "dialysis"]:
                max_dose *= 0.5
                result["warnings"].append({
                    "severity": AlertSeverity.HIGH.value,
                    "type": "RENAL_ADJUSTMENT",
                    "message": f"Renal impairment ({renal_function}) - dose adjustment required",
                    "action": "Verify renal-adjusted dosing with pharmacy"
                })

            if dose > max_dose:
                result["status"] = VerificationStatus.FAILED.value
                result["alerts"].append({
                    "severity": AlertSeverity.CRITICAL.value,
                    "type": "OVERDOSE_RISK",
                    "message": f"DOSE EXCEEDS MAXIMUM: {dose} {unit} > max {max_dose} {unit}",
                    "action": "DO NOT ADMINISTER - Contact prescriber immediately"
                })
            elif dose < min_dose * 0.5:
                result["status"] = VerificationStatus.WARNING.value
                result["warnings"].append({
                    "severity": AlertSeverity.MODERATE.value,
                    "type": "SUBTHERAPEUTIC_DOSE",
                    "message": f"Dose appears low. Typical range: {min_dose}-{max_dose} {unit}",
                    "action": "Verify dose with prescriber"
                })

        return result

    def _verify_right_route(
        self,
        medication_name: str,
        ordered_route: str
    ) -> Dict[str, Any]:
        """Verify administration route is appropriate"""
        result = {
            "status": VerificationStatus.VERIFIED.value,
            "orderedRoute": ordered_route,
            "alerts": [],
            "warnings": []
        }

        route_upper = ordered_route.upper()
        med_lower = medication_name.lower()

        # Critical route restrictions
        critical_restrictions = {
            "vincristine": {
                "forbidden": ["IT", "INTRATHECAL"],
                "message": "VINCRISTINE - FATAL IF GIVEN INTRATHECALLY"
            },
            "potassium chloride": {
                "forbidden": ["IVP", "IV PUSH"],
                "message": "POTASSIUM CHLORIDE - NEVER IV PUSH - CARDIAC ARREST RISK"
            },
            "vancomycin": {
                "required_duration": 60,
                "message": "Vancomycin must be infused over at least 60 minutes"
            }
        }

        for drug, restriction in critical_restrictions.items():
            if drug in med_lower:
                if "forbidden" in restriction:
                    for forbidden_route in restriction["forbidden"]:
                        if forbidden_route in route_upper:
                            result["status"] = VerificationStatus.FAILED.value
                            result["alerts"].append({
                                "severity": AlertSeverity.CRITICAL.value,
                                "type": "FORBIDDEN_ROUTE",
                                "message": restriction["message"],
                                "action": "DO NOT ADMINISTER BY THIS ROUTE"
                            })
                            return result

                if "required_duration" in restriction:
                    result["warnings"].append({
                        "severity": AlertSeverity.HIGH.value,
                        "type": "INFUSION_TIME",
                        "message": restriction["message"],
                        "action": f"Ensure infusion time >= {restriction['required_duration']} minutes"
                    })

        # Normalize and validate route
        route_normalized = None
        for standard_route, variants in VALID_ROUTES.items():
            if route_upper == standard_route or route_upper.lower() in variants:
                route_normalized = standard_route
                break

        if not route_normalized:
            result["status"] = VerificationStatus.WARNING.value
            result["warnings"].append({
                "severity": AlertSeverity.MODERATE.value,
                "type": "ROUTE_UNCLEAR",
                "message": f"Route '{ordered_route}' not recognized",
                "action": "Clarify route with prescriber"
            })

        return result

    def _verify_right_time(
        self,
        scheduled_time: str,
        current_time: Optional[str]
    ) -> Dict[str, Any]:
        """Verify medication is being given at correct time"""
        result = {
            "status": VerificationStatus.VERIFIED.value,
            "scheduledTime": scheduled_time,
            "warnings": []
        }

        try:
            scheduled = datetime.fromisoformat(scheduled_time.replace("Z", "+00:00"))
            current = datetime.fromisoformat(current_time.replace("Z", "+00:00")) if current_time else datetime.now()

            time_diff = abs((current - scheduled).total_seconds() / 60)  # Minutes

            result["timeDifference"] = f"{time_diff:.0f} minutes"

            if time_diff > 60:
                result["status"] = VerificationStatus.WARNING.value
                result["warnings"].append({
                    "severity": AlertSeverity.HIGH.value,
                    "type": "TIME_DEVIATION",
                    "message": f"More than 60 minutes from scheduled time",
                    "action": "Document reason for delay and consider dose adjustment"
                })
            elif time_diff > 30:
                result["status"] = VerificationStatus.WARNING.value
                result["warnings"].append({
                    "severity": AlertSeverity.MODERATE.value,
                    "type": "TIME_DEVIATION",
                    "message": f"Administration {time_diff:.0f} minutes from scheduled time",
                    "action": "Document reason if significantly early or late"
                })

            # Check if too early
            if current < scheduled - timedelta(minutes=30):
                result["warnings"].append({
                    "severity": AlertSeverity.MODERATE.value,
                    "type": "EARLY_ADMINISTRATION",
                    "message": "Medication being given more than 30 minutes early",
                    "action": "Verify early administration is appropriate"
                })

        except Exception as e:
            result["status"] = VerificationStatus.WARNING.value
            result["warnings"].append({
                "severity": AlertSeverity.LOW.value,
                "type": "TIME_PARSE_ERROR",
                "message": "Could not verify timing",
                "action": "Manually verify scheduled time"
            })

        return result

    def _check_high_alert_medication(self, medication_name: str) -> Optional[Dict[str, Any]]:
        """Check if medication is a high-alert medication"""
        med_lower = medication_name.lower()

        for drug_name, info in HIGH_ALERT_MEDICATIONS.items():
            if drug_name in med_lower or med_lower in drug_name:
                return {
                    "drugName": drug_name,
                    "category": info["category"],
                    "risk": info["risk"],
                    "special_checks": info["special_checks"]
                }

        return None

    def _check_lasa_drugs(
        self,
        medication_name: str,
        current_medications: Optional[List[str]]
    ) -> Optional[Dict[str, Any]]:
        """Check for look-alike/sound-alike drug confusion risk"""
        med_lower = medication_name.lower()
        similar_drugs = []

        for drug1, drug2 in LASA_DRUG_PAIRS:
            if drug1 in med_lower:
                similar_drugs.append(drug2)
            elif drug2 in med_lower:
                similar_drugs.append(drug1)

        if similar_drugs:
            return {
                "message": f"'{medication_name}' can be confused with similar-sounding medications",
                "similar_drugs": similar_drugs,
                "action": "Double-check medication name before administration"
            }

        return None

    def _generate_recommendations(
        self,
        results: Dict[str, Any],
        medication_name: str,
        route: str
    ) -> List[Dict[str, Any]]:
        """Generate safety recommendations based on verification results"""
        recommendations = []

        # High-alert medication recommendations
        if results.get("isHighAlertMedication"):
            high_alert = results["highAlertInfo"]
            recommendations.append({
                "priority": "HIGH",
                "type": "INDEPENDENT_DOUBLE_CHECK",
                "message": "Perform independent double-check with another nurse",
                "details": f"Required for {high_alert['category']} medications"
            })

            for check in high_alert.get("special_checks", []):
                recommendations.append({
                    "priority": "HIGH",
                    "type": "SPECIAL_CHECK",
                    "message": check,
                    "details": f"Required before administering {medication_name}"
                })

        # Route-specific recommendations
        if route.upper() in ["IV", "IVP", "IVPB"]:
            recommendations.append({
                "priority": "MODERATE",
                "type": "IV_ADMINISTRATION",
                "message": "Verify IV site patency and compatibility",
                "details": "Check for signs of infiltration or phlebitis"
            })

        # General safety recommendations
        recommendations.append({
            "priority": "STANDARD",
            "type": "DOCUMENTATION",
            "message": "Document administration in eMAR immediately after giving",
            "details": "Include any deviations or patient responses"
        })

        return recommendations

    def check_iv_compatibility(
        self,
        drug1: str,
        drug2: str,
        concentration1: Optional[str] = None,
        concentration2: Optional[str] = None
    ) -> Dict[str, Any]:
        """Check IV compatibility between two drugs"""
        drug1_lower = drug1.lower()
        drug2_lower = drug2.lower()

        result = {
            "drug1": drug1,
            "drug2": drug2,
            "compatible": None,
            "message": "",
            "recommendation": "",
            "modelVersion": self.model_version
        }

        # Check known incompatibilities
        for incompatible_pair in IV_COMPATIBILITY["incompatible"]:
            d1, d2 = incompatible_pair
            if (d1 in drug1_lower and (d2 in drug2_lower or d2 == "any" or d2 == "any_other")) or \
               (d1 in drug2_lower and (d2 in drug1_lower or d2 == "any" or d2 == "any_other")):
                result["compatible"] = False
                result["message"] = f"INCOMPATIBLE: {drug1} and {drug2} should NOT be mixed or run through same line"
                result["recommendation"] = "Use separate IV lines or flush between medications"
                return result

        # Check Y-site incompatibilities
        for y_incompatible_pair in IV_COMPATIBILITY["y_site_incompatible"]:
            d1, d2 = y_incompatible_pair
            if (d1 in drug1_lower and d2 in drug2_lower) or (d1 in drug2_lower and d2 in drug1_lower):
                result["compatible"] = False
                result["message"] = f"Y-SITE INCOMPATIBLE: Cannot give through Y-site together"
                result["recommendation"] = "Administer separately with line flush between"
                return result

        # Check known compatibilities
        for compatible_pair in IV_COMPATIBILITY["compatible"]:
            d1, d2 = compatible_pair
            if (d1 in drug1_lower and d2 in drug2_lower) or (d1 in drug2_lower and d2 in drug1_lower):
                result["compatible"] = True
                result["message"] = f"COMPATIBLE: {drug1} and {drug2} can be given together"
                result["recommendation"] = "Y-site administration acceptable"
                return result

        # Unknown compatibility
        result["compatible"] = None
        result["message"] = "Compatibility not confirmed in database"
        result["recommendation"] = "Consult pharmacy or IV compatibility reference before mixing"

        return result

    def get_high_alert_drugs(self) -> Dict[str, Any]:
        """Get list of all high-alert medications with categories"""
        categories = {}

        for drug, info in HIGH_ALERT_MEDICATIONS.items():
            category = info["category"]
            if category not in categories:
                categories[category] = []

            categories[category].append({
                "name": drug.title(),
                "risk": info["risk"],
                "specialChecks": info["special_checks"]
            })

        return {
            "categories": categories,
            "totalDrugs": len(HIGH_ALERT_MEDICATIONS),
            "modelVersion": self.model_version
        }

    def calculate_dose(
        self,
        medication_name: str,
        patient_weight: float,
        patient_age: int,
        dose_per_kg: Optional[float] = None,
        frequency_hours: Optional[int] = None,
        max_single_dose: Optional[float] = None,
        max_daily_dose: Optional[float] = None,
        renal_function: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculate appropriate dose based on patient parameters"""
        result = {
            "medication": medication_name,
            "patientWeight": patient_weight,
            "patientAge": patient_age,
            "calculations": [],
            "recommendedDose": None,
            "warnings": [],
            "modelVersion": self.model_version
        }

        med_lower = medication_name.lower()
        dose_info = None

        # Look up drug in database
        for drug_name, info in DOSE_RANGES.items():
            if drug_name in med_lower:
                dose_info = info
                break

        is_pediatric = patient_age < 18
        is_geriatric = patient_age >= 65

        if dose_per_kg:
            # Use provided dose per kg
            calculated_dose = patient_weight * dose_per_kg
            result["calculations"].append({
                "step": "Weight-based calculation",
                "formula": f"{patient_weight} kg x {dose_per_kg} mg/kg",
                "result": f"{calculated_dose:.2f} mg"
            })
        elif dose_info:
            if is_pediatric and "pediatric" in dose_info:
                ped_info = dose_info["pediatric"]
                per_kg = ped_info.get("per_kg_max", ped_info.get("per_kg_min", 1))
                calculated_dose = patient_weight * per_kg

                if "daily_max_per_kg" in ped_info:
                    daily_max = patient_weight * ped_info["daily_max_per_kg"]
                    result["calculations"].append({
                        "step": "Pediatric max daily",
                        "formula": f"{patient_weight} kg x {ped_info['daily_max_per_kg']} mg/kg/day",
                        "result": f"{daily_max:.2f} mg/day"
                    })

                result["calculations"].append({
                    "step": "Pediatric weight-based",
                    "formula": f"{patient_weight} kg x {per_kg} mg/kg",
                    "result": f"{calculated_dose:.2f} mg per dose"
                })
            else:
                adult_info = dose_info.get("adult", {})
                calculated_dose = adult_info.get("max", adult_info.get("min", 0))

                if dose_info.get("weight_based") and "per_kg" in dose_info:
                    calculated_dose = patient_weight * dose_info["per_kg"]
                    result["calculations"].append({
                        "step": "Weight-based calculation",
                        "formula": f"{patient_weight} kg x {dose_info['per_kg']} mg/kg",
                        "result": f"{calculated_dose:.2f} mg"
                    })
        else:
            result["warnings"].append({
                "type": "DATABASE_MISSING",
                "message": f"No dosing information for {medication_name}",
                "action": "Consult drug reference or pharmacist"
            })
            return result

        # Apply caps
        if max_single_dose and calculated_dose > max_single_dose:
            result["calculations"].append({
                "step": "Cap at max single dose",
                "formula": f"Capped from {calculated_dose:.2f} to {max_single_dose} mg",
                "result": f"{max_single_dose} mg"
            })
            calculated_dose = max_single_dose

        # Geriatric adjustment
        if is_geriatric and dose_info and dose_info.get("geriatric_reduction"):
            original = calculated_dose
            calculated_dose *= dose_info["geriatric_reduction"]
            result["calculations"].append({
                "step": "Geriatric adjustment",
                "formula": f"{original:.2f} x {dose_info['geriatric_reduction']} (50% reduction)",
                "result": f"{calculated_dose:.2f} mg"
            })
            result["warnings"].append({
                "type": "GERIATRIC",
                "message": "Dose reduced for geriatric patient",
                "action": "Monitor closely for adverse effects"
            })

        # Renal adjustment
        if renal_function in ["severe", "dialysis"]:
            original = calculated_dose
            calculated_dose *= 0.5
            result["calculations"].append({
                "step": "Renal adjustment",
                "formula": f"{original:.2f} x 0.5 (renal impairment)",
                "result": f"{calculated_dose:.2f} mg"
            })
            result["warnings"].append({
                "type": "RENAL",
                "message": f"Dose reduced for {renal_function} renal impairment",
                "action": "Monitor renal function and drug levels if applicable"
            })

        result["recommendedDose"] = {
            "value": round(calculated_dose, 2),
            "unit": dose_info.get("unit", "mg") if dose_info else "mg"
        }

        return result

    def get_medication_schedule(
        self,
        patient_medications: List[Dict[str, Any]],
        current_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get patient's medication schedule with due/overdue status"""
        current = datetime.fromisoformat(current_time.replace("Z", "+00:00")) if current_time else datetime.now()

        due_now = []
        upcoming = []
        overdue = []
        prn_available = []

        for med in patient_medications:
            scheduled_time_str = med.get("scheduledTime")
            is_prn = med.get("isPRN", False)

            if is_prn:
                prn_available.append({
                    **med,
                    "status": "PRN_AVAILABLE",
                    "lastGiven": med.get("lastAdministered"),
                    "canGiveAt": med.get("nextAvailableTime")
                })
                continue

            if not scheduled_time_str:
                continue

            try:
                scheduled = datetime.fromisoformat(scheduled_time_str.replace("Z", "+00:00"))
                time_diff = (scheduled - current).total_seconds() / 60  # Minutes

                med_entry = {
                    **med,
                    "scheduledTime": scheduled_time_str,
                    "minutesFromNow": round(time_diff)
                }

                if time_diff < -60:
                    med_entry["status"] = "OVERDUE"
                    med_entry["overdueMinutes"] = abs(round(time_diff))
                    overdue.append(med_entry)
                elif time_diff <= 30:
                    med_entry["status"] = "DUE_NOW"
                    due_now.append(med_entry)
                elif time_diff <= 120:
                    med_entry["status"] = "UPCOMING"
                    upcoming.append(med_entry)
                else:
                    med_entry["status"] = "SCHEDULED"
                    upcoming.append(med_entry)

            except Exception as e:
                logger.error(f"Error parsing medication time: {e}")

        # Sort by urgency
        overdue.sort(key=lambda x: x.get("overdueMinutes", 0), reverse=True)
        due_now.sort(key=lambda x: x.get("minutesFromNow", 0))
        upcoming.sort(key=lambda x: x.get("minutesFromNow", 0))

        return {
            "currentTime": current.isoformat(),
            "overdue": overdue,
            "dueNow": due_now,
            "upcoming": upcoming[:10],  # Next 10 upcoming
            "prnAvailable": prn_available,
            "totalDue": len(overdue) + len(due_now),
            "modelVersion": self.model_version
        }

    def process_barcode_scan(
        self,
        barcode: str,
        expected_type: str = "any"  # "patient", "medication", "any"
    ) -> Dict[str, Any]:
        """Process and interpret barcode scan"""
        result = {
            "barcode": barcode,
            "type": None,
            "data": None,
            "verified": False,
            "message": "",
            "modelVersion": self.model_version
        }

        # Patient wristband barcode patterns (typically MRN or patient ID)
        if barcode.startswith("PT") or barcode.startswith("MRN"):
            result["type"] = "PATIENT"
            result["data"] = {
                "patientId": barcode,
                "idType": "MRN" if barcode.startswith("MRN") else "PATIENT_ID"
            }
            result["verified"] = True
            result["message"] = "Patient wristband scanned"

        # Medication barcode patterns (NDC, GS1, etc.)
        elif barcode.startswith("01") or len(barcode) in [10, 11, 12, 13, 14]:
            result["type"] = "MEDICATION"
            result["data"] = {
                "ndc": barcode if len(barcode) in [10, 11] else None,
                "gtin": barcode if len(barcode) == 14 or barcode.startswith("01") else None,
                "rawBarcode": barcode
            }
            result["verified"] = True
            result["message"] = "Medication barcode scanned"

        # Location/bed barcode
        elif barcode.startswith("LOC") or barcode.startswith("BED"):
            result["type"] = "LOCATION"
            result["data"] = {
                "locationId": barcode,
                "locationType": "BED" if barcode.startswith("BED") else "LOCATION"
            }
            result["verified"] = True
            result["message"] = "Location barcode scanned"

        else:
            result["type"] = "UNKNOWN"
            result["verified"] = False
            result["message"] = "Barcode format not recognized"

        # Validate against expected type
        if expected_type != "any" and result["type"] != expected_type.upper():
            result["verified"] = False
            result["message"] = f"Expected {expected_type} barcode, got {result['type']}"

        return result

    def detect_timing_conflicts(
        self,
        patient_medications: List[Dict[str, Any]],
        new_medication: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Detect timing conflicts between medications"""
        conflicts = []
        warnings = []

        new_time_str = new_medication.get("scheduledTime")
        new_med_name = new_medication.get("name", "").lower()

        if not new_time_str:
            return {
                "hasConflicts": False,
                "conflicts": [],
                "warnings": [],
                "modelVersion": self.model_version
            }

        try:
            new_time = datetime.fromisoformat(new_time_str.replace("Z", "+00:00"))
        except:
            return {
                "hasConflicts": False,
                "conflicts": [],
                "warnings": ["Could not parse new medication time"],
                "modelVersion": self.model_version
            }

        for med in patient_medications:
            med_time_str = med.get("scheduledTime")
            med_name = med.get("name", "").lower()

            if not med_time_str:
                continue

            try:
                med_time = datetime.fromisoformat(med_time_str.replace("Z", "+00:00"))
                time_diff = abs((new_time - med_time).total_seconds() / 60)

                # Check for medications scheduled within 15 minutes of each other
                if time_diff <= 15 and med_name != new_med_name:
                    # Check for known interactions
                    interaction = self._check_timing_interaction(new_med_name, med_name)

                    if interaction:
                        conflicts.append({
                            "medication1": new_medication.get("name"),
                            "medication2": med.get("name"),
                            "timeDifference": f"{time_diff:.0f} minutes",
                            "conflict": interaction["conflict"],
                            "recommendation": interaction["recommendation"]
                        })
                    else:
                        warnings.append({
                            "medication1": new_medication.get("name"),
                            "medication2": med.get("name"),
                            "timeDifference": f"{time_diff:.0f} minutes",
                            "message": "Multiple medications scheduled close together",
                            "recommendation": "Verify no timing-related interactions"
                        })

            except Exception as e:
                logger.error(f"Error checking timing conflict: {e}")

        return {
            "hasConflicts": len(conflicts) > 0,
            "conflicts": conflicts,
            "warnings": warnings,
            "modelVersion": self.model_version
        }

    def _check_timing_interaction(
        self,
        drug1: str,
        drug2: str
    ) -> Optional[Dict[str, str]]:
        """Check for timing-related drug interactions"""
        timing_interactions = {
            ("levothyroxine", "calcium"): {
                "conflict": "Calcium reduces absorption of levothyroxine",
                "recommendation": "Separate by at least 4 hours"
            },
            ("levothyroxine", "iron"): {
                "conflict": "Iron reduces absorption of levothyroxine",
                "recommendation": "Separate by at least 4 hours"
            },
            ("ciprofloxacin", "antacid"): {
                "conflict": "Antacids reduce ciprofloxacin absorption",
                "recommendation": "Give ciprofloxacin 2 hours before or 6 hours after antacids"
            },
            ("ciprofloxacin", "calcium"): {
                "conflict": "Calcium reduces ciprofloxacin absorption",
                "recommendation": "Separate by at least 2 hours"
            },
            ("bisphosphonate", "calcium"): {
                "conflict": "Calcium reduces bisphosphonate absorption",
                "recommendation": "Take bisphosphonate on empty stomach, wait 30-60 minutes"
            },
            ("tetracycline", "dairy"): {
                "conflict": "Dairy products reduce tetracycline absorption",
                "recommendation": "Separate by at least 2 hours"
            },
        }

        for (d1, d2), info in timing_interactions.items():
            if (d1 in drug1 and d2 in drug2) or (d1 in drug2 and d2 in drug1):
                return info

        return None


# Create singleton instance
medication_safety_ai = MedicationSafetyAI()
