"""
Pharmacy AI Service - Drug Interaction Checker
Comprehensive drug interaction analysis with severity classification and clinical recommendations
Enhanced with AI-powered analysis, medication reconciliation, adherence prediction, and antimicrobial stewardship
"""

from typing import List, Dict, Any, Optional, Tuple
import logging
import re
import os
from datetime import datetime

from .knowledge_base import (
    DRUG_DATABASE,
    DRUG_INTERACTIONS,
    DRUG_FOOD_INTERACTIONS,
    DRUG_CONDITION_CONTRAINDICATIONS,
    SEVERITY_LEVELS,
)

logger = logging.getLogger(__name__)

# Import shared OpenAI client
from shared.openai_client import openai_manager, TaskComplexity, OPENAI_AVAILABLE


# Antibiotic knowledge base for antimicrobial stewardship
ANTIBIOTIC_GUIDELINES = {
    "amoxicillin": {
        "spectrum": "narrow",
        "typical_duration": {"uti": 3, "sinusitis": 5, "strep_pharyngitis": 10, "pneumonia": 5},
        "de_escalation_from": ["amoxicillin-clavulanate", "ampicillin-sulbactam"],
        "avoid_in": ["pcn_allergy"],
        "typical_indications": ["strep_pharyngitis", "otitis_media", "dental_infection"]
    },
    "azithromycin": {
        "spectrum": "broad",
        "typical_duration": {"cap": 5, "bronchitis": 3, "sinusitis": 3},
        "de_escalation_from": ["levofloxacin", "moxifloxacin"],
        "avoid_in": ["qt_prolongation"],
        "typical_indications": ["cap", "bronchitis", "chlamydia"]
    },
    "ciprofloxacin": {
        "spectrum": "broad",
        "typical_duration": {"uti": 3, "prostatitis": 28, "pyelonephritis": 7},
        "de_escalation_to": ["nitrofurantoin", "trimethoprim-sulfamethoxazole"],
        "avoid_in": ["tendon_disorder", "myasthenia_gravis", "children"],
        "typical_indications": ["complicated_uti", "prostatitis", "traveler_diarrhea"]
    },
    "levofloxacin": {
        "spectrum": "broad",
        "typical_duration": {"cap": 5, "uti": 5, "sinusitis": 5},
        "de_escalation_to": ["azithromycin", "amoxicillin"],
        "avoid_in": ["tendon_disorder", "myasthenia_gravis"],
        "typical_indications": ["cap", "complicated_uti", "sinusitis"]
    },
    "vancomycin": {
        "spectrum": "narrow_gram_positive",
        "typical_duration": {"mrsa_skin": 7, "bacteremia": 14, "endocarditis": 42},
        "de_escalation_to": ["cefazolin", "nafcillin", "daptomycin"],
        "requires_monitoring": ["trough_levels", "renal_function"],
        "typical_indications": ["mrsa", "c_diff", "serious_gram_positive"]
    },
    "piperacillin-tazobactam": {
        "spectrum": "very_broad",
        "typical_duration": {"hap": 7, "intra_abdominal": 4, "febrile_neutropenia": "until_afebrile"},
        "de_escalation_to": ["ampicillin-sulbactam", "ceftriaxone", "metronidazole"],
        "typical_indications": ["hap", "intra_abdominal", "febrile_neutropenia"]
    },
    "meropenem": {
        "spectrum": "carbapenem",
        "typical_duration": {"meningitis": 21, "hap": 7, "intra_abdominal": 4},
        "de_escalation_to": ["piperacillin-tazobactam", "ceftriaxone"],
        "reserve_for": ["esbl", "multidrug_resistant"],
        "typical_indications": ["severe_infections", "esbl", "mdr_organisms"]
    },
    "ceftriaxone": {
        "spectrum": "broad",
        "typical_duration": {"cap": 5, "meningitis": 14, "uti": 7},
        "de_escalation_to": ["cephalexin", "amoxicillin"],
        "typical_indications": ["cap", "meningitis", "gonorrhea"]
    },
    "metronidazole": {
        "spectrum": "anaerobic",
        "typical_duration": {"c_diff": 10, "bacterial_vaginosis": 7, "intra_abdominal": 4},
        "typical_indications": ["c_diff", "anaerobic_infections", "h_pylori"]
    },
    "trimethoprim-sulfamethoxazole": {
        "spectrum": "moderate",
        "typical_duration": {"uti": 3, "pcp": 21, "skin_infection": 7},
        "typical_indications": ["uncomplicated_uti", "pcp_prophylaxis", "mrsa_skin"]
    }
}

# Adherence risk factors
ADHERENCE_RISK_FACTORS = {
    "regimen_complexity": {
        "once_daily": 0,
        "twice_daily": 5,
        "three_times_daily": 15,
        "four_times_daily": 25,
        "complex_timing": 20
    },
    "pill_burden": {
        "1-3": 0,
        "4-6": 10,
        "7-10": 20,
        "11+": 35
    },
    "side_effects": {
        "minimal": 0,
        "moderate": 15,
        "significant": 30,
        "severe": 45
    },
    "cost_concerns": {
        "none": 0,
        "mild": 10,
        "moderate": 25,
        "severe": 40
    },
    "age_factors": {
        "18-40": 10,  # May have lifestyle barriers
        "41-64": 0,   # Generally stable
        "65-74": 5,   # Memory concerns
        "75+": 15     # Cognitive/physical barriers
    },
    "cognitive_status": {
        "intact": 0,
        "mild_impairment": 20,
        "moderate_impairment": 40,
        "severe_impairment": 60
    }
}


class DrugNormalizer:
    """Normalizes drug names to match database entries"""

    # Common aliases and brand name mappings
    DRUG_ALIASES = {
        # Brand to generic mappings
        "coumadin": "warfarin",
        "jantoven": "warfarin",
        "xarelto": "rivaroxaban",
        "eliquis": "apixaban",
        "pradaxa": "dabigatran",
        "plavix": "clopidogrel",
        "effient": "prasugrel",
        "brilinta": "ticagrelor",
        "advil": "ibuprofen",
        "motrin": "ibuprofen",
        "aleve": "naproxen",
        "naprosyn": "naproxen",
        "voltaren": "diclofenac",
        "celebrex": "celecoxib",
        "lipitor": "atorvastatin",
        "zocor": "simvastatin",
        "crestor": "rosuvastatin",
        "pravachol": "pravastatin",
        "glucophage": "metformin",
        "lasix": "furosemide",
        "aldactone": "spironolactone",
        "lanoxin": "digoxin",
        "cordarone": "amiodarone",
        "pacerone": "amiodarone",
        "prilosec": "omeprazole",
        "nexium": "esomeprazole",
        "protonix": "pantoprazole",
        "synthroid": "levothyroxine",
        "levoxyl": "levothyroxine",
        "zoloft": "sertraline",
        "prozac": "fluoxetine",
        "lexapro": "escitalopram",
        "paxil": "paroxetine",
        "celexa": "citalopram",
        "effexor": "venlafaxine",
        "cymbalta": "duloxetine",
        "xanax": "alprazolam",
        "ativan": "lorazepam",
        "valium": "diazepam",
        "ambien": "zolpidem",
        "ultram": "tramadol",
        "tylenol": "acetaminophen",
        "norvasc": "amlodipine",
        "cardizem": "diltiazem",
        "calan": "verapamil",
        "verelan": "verapamil",
        "lopressor": "metoprolol",
        "toprol": "metoprolol",
        "coreg": "carvedilol",
        "tenormin": "atenolol",
        "inderal": "propranolol",
        "zestril": "lisinopril",
        "prinivil": "lisinopril",
        "vasotec": "enalapril",
        "altace": "ramipril",
        "cozaar": "losartan",
        "diovan": "valsartan",
        "dilantin": "phenytoin",
        "tegretol": "carbamazepine",
        "depakote": "valproic acid",
        "depakene": "valproic acid",
        "neurontin": "gabapentin",
        "keppra": "levetiracetam",
        "diflucan": "fluconazole",
        "cipro": "ciprofloxacin",
        "levaquin": "levofloxacin",
        "zithromax": "azithromycin",
        "z-pack": "azithromycin",
        "biaxin": "clarithromycin",
        "flagyl": "metronidazole",
        "bactrim": "trimethoprim-sulfamethoxazole",
        "septra": "trimethoprim-sulfamethoxazole",
        "zyloprim": "allopurinol",
        "colcrys": "colchicine",
        "deltasone": "prednisone",
        "medrol": "methylprednisolone",
        "lovenox": "enoxaparin",
        "vicodin": "hydrocodone",
        "norco": "hydrocodone",
        "percocet": "oxycodone",
        "oxycontin": "oxycodone",
        "ms contin": "morphine",
        "roxanol": "morphine",
        # Common abbreviations
        "asa": "aspirin",
        "hctz": "hydrochlorothiazide",
        "apap": "acetaminophen",
        "tmp-smx": "trimethoprim-sulfamethoxazole",
        "tmp/smx": "trimethoprim-sulfamethoxazole",
    }

    @classmethod
    def normalize(cls, drug_name: str) -> str:
        """Normalize drug name to lowercase generic name"""
        if not drug_name:
            return ""

        normalized = drug_name.lower().strip()

        # Remove common suffixes like dosages
        normalized = re.sub(r'\s*\d+\s*(mg|mcg|ml|g)\s*$', '', normalized)
        normalized = re.sub(r'\s*(xl|xr|sr|cr|er|la|cd)\s*$', '', normalized)

        # Check alias mapping
        if normalized in cls.DRUG_ALIASES:
            return cls.DRUG_ALIASES[normalized]

        return normalized


class PharmacyAI:
    """AI-powered drug interaction and safety checker"""

    def __init__(self):
        self.model_version = "1.0.0"
        self.normalizer = DrugNormalizer()

    def check_interactions(
        self,
        medications: List[str],
        patient_conditions: Optional[List[str]] = None,
        patient_age: Optional[int] = None,
        patient_weight: Optional[float] = None,
        allergies: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Comprehensive drug interaction analysis

        Args:
            medications: List of medication names
            patient_conditions: Optional list of medical conditions
            patient_age: Optional patient age
            patient_weight: Optional patient weight in kg
            allergies: Optional list of drug allergies

        Returns:
            Dictionary containing interaction analysis results
        """
        if not medications:
            return {
                "interactions": [],
                "foodInteractions": [],
                "conditionContraindications": [],
                "allergyAlerts": [],
                "summary": {
                    "totalInteractions": 0,
                    "criticalCount": 0,
                    "severeCount": 0,
                    "moderateCount": 0,
                    "minorCount": 0,
                    "overallRisk": "LOW"
                },
                "recommendations": [],
                "drugInfo": [],
                "modelVersion": self.model_version
            }

        # Normalize all medication names
        normalized_meds = [self.normalizer.normalize(med) for med in medications]
        med_mapping = dict(zip(normalized_meds, medications))  # Map normalized to original

        # Check drug-drug interactions
        interactions = self._check_drug_drug_interactions(normalized_meds, med_mapping)

        # Check drug-food interactions
        food_interactions = self._check_food_interactions(normalized_meds, med_mapping)

        # Check condition contraindications
        contraindications = []
        if patient_conditions:
            contraindications = self._check_condition_contraindications(
                normalized_meds, patient_conditions, med_mapping
            )

        # Check allergy alerts
        allergy_alerts = []
        if allergies:
            allergy_alerts = self._check_allergies(normalized_meds, allergies, med_mapping)

        # Get drug information
        drug_info = self._get_drug_info(normalized_meds, med_mapping)

        # Generate summary
        summary = self._generate_summary(interactions, contraindications, allergy_alerts)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            interactions, food_interactions, contraindications, allergy_alerts,
            patient_age
        )

        return {
            "interactions": interactions,
            "foodInteractions": food_interactions,
            "conditionContraindications": contraindications,
            "allergyAlerts": allergy_alerts,
            "summary": summary,
            "recommendations": recommendations,
            "drugInfo": drug_info,
            "modelVersion": self.model_version
        }

    def _check_drug_drug_interactions(
        self,
        medications: List[str],
        med_mapping: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Check for drug-drug interactions between all medication pairs"""
        interactions = []
        checked_pairs = set()

        for i, drug1 in enumerate(medications):
            for j, drug2 in enumerate(medications):
                if i >= j:
                    continue

                # Create sorted pair to avoid duplicates
                pair = tuple(sorted([drug1, drug2]))
                if pair in checked_pairs:
                    continue
                checked_pairs.add(pair)

                # Check both directions in interaction database
                interaction = self._find_interaction(drug1, drug2)
                if interaction:
                    interactions.append({
                        "drug1": med_mapping.get(drug1, drug1).title(),
                        "drug2": med_mapping.get(drug2, drug2).title(),
                        "drug1Generic": drug1,
                        "drug2Generic": drug2,
                        "severity": interaction["severity"],
                        "severityLevel": SEVERITY_LEVELS.get(interaction["severity"], {}).get("level", 1),
                        "effect": interaction["effect"],
                        "mechanism": interaction.get("mechanism", "Unknown mechanism"),
                        "management": interaction.get("management", "Monitor therapy"),
                        "clinicalEvidence": interaction.get("clinical_evidence", "Unknown"),
                        "color": SEVERITY_LEVELS.get(interaction["severity"], {}).get("color", "gray")
                    })

        # Sort by severity (most severe first)
        interactions.sort(key=lambda x: x["severityLevel"], reverse=True)

        return interactions

    def _find_interaction(self, drug1: str, drug2: str) -> Optional[Dict[str, Any]]:
        """Find interaction between two drugs in either direction"""
        # Check drug1 -> drug2
        if drug1 in DRUG_INTERACTIONS:
            if drug2 in DRUG_INTERACTIONS[drug1]:
                return DRUG_INTERACTIONS[drug1][drug2]

        # Check drug2 -> drug1
        if drug2 in DRUG_INTERACTIONS:
            if drug1 in DRUG_INTERACTIONS[drug2]:
                return DRUG_INTERACTIONS[drug2][drug1]

        # Check drug class interactions
        drug1_info = DRUG_DATABASE.get(drug1, {})
        drug2_info = DRUG_DATABASE.get(drug2, {})

        # NSAIDs + Anticoagulants
        if self._is_drug_class(drug1, "NSAID") and self._is_drug_class(drug2, "Anticoagulant"):
            return {
                "severity": "SEVERE",
                "effect": "Increased bleeding risk",
                "mechanism": "NSAIDs inhibit platelet function and may cause GI bleeding",
                "management": "Avoid combination if possible. If necessary, use PPI prophylaxis.",
                "clinical_evidence": "Well-documented"
            }
        if self._is_drug_class(drug2, "NSAID") and self._is_drug_class(drug1, "Anticoagulant"):
            return {
                "severity": "SEVERE",
                "effect": "Increased bleeding risk",
                "mechanism": "NSAIDs inhibit platelet function and may cause GI bleeding",
                "management": "Avoid combination if possible. If necessary, use PPI prophylaxis.",
                "clinical_evidence": "Well-documented"
            }

        # ACE inhibitors/ARBs + Potassium-sparing diuretics
        if (self._is_drug_class(drug1, "ACE Inhibitor") or self._is_drug_class(drug1, "ARB")):
            if self._is_drug_class(drug2, "Potassium-Sparing Diuretic"):
                return {
                    "severity": "SEVERE",
                    "effect": "Risk of hyperkalemia",
                    "mechanism": "Both reduce potassium excretion",
                    "management": "Monitor potassium levels closely. Avoid potassium supplements.",
                    "clinical_evidence": "Well-documented"
                }

        # Opioids + Benzodiazepines (general class check)
        if self._is_drug_class(drug1, "Opioid") and self._is_drug_class(drug2, "Benzodiazepine"):
            return {
                "severity": "CONTRAINDICATED",
                "effect": "Severe respiratory depression, overdose, death",
                "mechanism": "Additive CNS depression",
                "management": "Avoid combination. FDA Black Box Warning.",
                "clinical_evidence": "Well-documented - FDA Black Box Warning"
            }
        if self._is_drug_class(drug2, "Opioid") and self._is_drug_class(drug1, "Benzodiazepine"):
            return {
                "severity": "CONTRAINDICATED",
                "effect": "Severe respiratory depression, overdose, death",
                "mechanism": "Additive CNS depression",
                "management": "Avoid combination. FDA Black Box Warning.",
                "clinical_evidence": "Well-documented - FDA Black Box Warning"
            }

        return None

    def _is_drug_class(self, drug: str, drug_class: str) -> bool:
        """Check if a drug belongs to a specific class or subclass"""
        drug_info = DRUG_DATABASE.get(drug, {})
        return (drug_info.get("class") == drug_class or
                drug_info.get("subclass") == drug_class)

    def _check_food_interactions(
        self,
        medications: List[str],
        med_mapping: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Check for drug-food interactions"""
        food_interactions = []

        for drug in medications:
            if drug in DRUG_FOOD_INTERACTIONS:
                for food_type, interaction in DRUG_FOOD_INTERACTIONS[drug].items():
                    food_interactions.append({
                        "drug": med_mapping.get(drug, drug).title(),
                        "drugGeneric": drug,
                        "foodType": food_type.replace("_", " ").title(),
                        "foods": interaction.get("foods", []),
                        "effect": interaction.get("effect", "Unknown effect"),
                        "management": interaction.get("management", "Consult pharmacist")
                    })

        return food_interactions

    def _check_condition_contraindications(
        self,
        medications: List[str],
        conditions: List[str],
        med_mapping: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Check for drug-condition contraindications"""
        contraindications = []
        conditions_lower = [c.lower() for c in conditions]

        for drug in medications:
            if drug in DRUG_CONDITION_CONTRAINDICATIONS:
                for condition_key, info in DRUG_CONDITION_CONTRAINDICATIONS[drug].items():
                    # Check if patient has this condition
                    condition_matches = any(
                        condition_key.replace("_", " ") in c or
                        info.get("condition", "").lower() in c
                        for c in conditions_lower
                    )

                    if condition_matches:
                        contraindications.append({
                            "drug": med_mapping.get(drug, drug).title(),
                            "drugGeneric": drug,
                            "condition": info.get("condition", condition_key),
                            "risk": info.get("risk", "Unknown risk"),
                            "action": info.get("action", "Review medication"),
                            "severity": "HIGH"
                        })

        return contraindications

    def _check_allergies(
        self,
        medications: List[str],
        allergies: List[str],
        med_mapping: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Check for drug allergy alerts"""
        allergy_alerts = []
        allergies_lower = [a.lower() for a in allergies]

        # Cross-reactivity patterns
        cross_reactivity = {
            "penicillin": ["amoxicillin", "ampicillin", "piperacillin"],
            "sulfa": ["sulfamethoxazole", "sulfasalazine", "celecoxib"],
            "cephalosporin": ["cephalexin", "ceftriaxone", "cefuroxime"],
            "aspirin": ["ibuprofen", "naproxen", "diclofenac", "celecoxib"],
        }

        for drug in medications:
            # Direct match
            if drug in allergies_lower:
                allergy_alerts.append({
                    "drug": med_mapping.get(drug, drug).title(),
                    "drugGeneric": drug,
                    "allergen": drug.title(),
                    "alertType": "DIRECT",
                    "severity": "HIGH",
                    "message": f"Patient has documented allergy to {drug}",
                    "action": "Do not administer. Select alternative medication."
                })
                continue

            # Cross-reactivity check
            drug_info = DRUG_DATABASE.get(drug, {})
            drug_class = drug_info.get("subclass", "").lower()

            for allergen, related_drugs in cross_reactivity.items():
                if allergen in allergies_lower:
                    # Check if current drug is in related class or is a related drug
                    if drug in related_drugs or allergen in drug_class:
                        allergy_alerts.append({
                            "drug": med_mapping.get(drug, drug).title(),
                            "drugGeneric": drug,
                            "allergen": allergen.title(),
                            "alertType": "CROSS-REACTIVITY",
                            "severity": "MODERATE",
                            "message": f"Patient allergic to {allergen}. {drug.title()} may cause cross-reaction.",
                            "action": "Use with caution. Consider alternative. Monitor for allergic reaction."
                        })

        return allergy_alerts

    def _get_drug_info(
        self,
        medications: List[str],
        med_mapping: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Get information about each medication"""
        drug_info = []

        for drug in medications:
            info = DRUG_DATABASE.get(drug, {})
            drug_info.append({
                "name": med_mapping.get(drug, drug).title(),
                "genericName": drug,
                "class": info.get("class", "Unknown"),
                "subclass": info.get("subclass", "Unknown"),
                "brandNames": info.get("brand_names", []),
                "mechanism": info.get("mechanism", "Unknown mechanism"),
                "commonUses": info.get("common_uses", []),
                "monitoring": info.get("monitoring", []),
                "found": bool(info)
            })

        return drug_info

    def _generate_summary(
        self,
        interactions: List[Dict[str, Any]],
        contraindications: List[Dict[str, Any]],
        allergy_alerts: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate interaction summary"""
        critical_count = sum(1 for i in interactions if i["severity"] == "CONTRAINDICATED")
        severe_count = sum(1 for i in interactions if i["severity"] == "SEVERE")
        moderate_count = sum(1 for i in interactions if i["severity"] == "MODERATE")
        minor_count = sum(1 for i in interactions if i["severity"] == "MINOR")

        # Add allergy and contraindication counts to severity
        critical_count += len(allergy_alerts)
        critical_count += len([c for c in contraindications if c.get("severity") == "HIGH"])

        # Determine overall risk
        if critical_count > 0:
            overall_risk = "CRITICAL"
        elif severe_count > 0:
            overall_risk = "HIGH"
        elif moderate_count > 0:
            overall_risk = "MODERATE"
        elif minor_count > 0:
            overall_risk = "LOW"
        else:
            overall_risk = "MINIMAL"

        return {
            "totalInteractions": len(interactions),
            "criticalCount": critical_count,
            "severeCount": severe_count,
            "moderateCount": moderate_count,
            "minorCount": minor_count,
            "allergyAlertCount": len(allergy_alerts),
            "contraindicationCount": len(contraindications),
            "overallRisk": overall_risk
        }

    def _generate_recommendations(
        self,
        interactions: List[Dict[str, Any]],
        food_interactions: List[Dict[str, Any]],
        contraindications: List[Dict[str, Any]],
        allergy_alerts: List[Dict[str, Any]],
        patient_age: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Generate clinical recommendations"""
        recommendations = []

        # Critical interaction recommendations
        critical_interactions = [i for i in interactions if i["severity"] == "CONTRAINDICATED"]
        for interaction in critical_interactions:
            recommendations.append({
                "priority": "CRITICAL",
                "type": "DRUG_INTERACTION",
                "message": f"AVOID: {interaction['drug1']} + {interaction['drug2']} - {interaction['effect']}",
                "action": interaction["management"]
            })

        # Allergy recommendations
        for alert in allergy_alerts:
            recommendations.append({
                "priority": "CRITICAL" if alert["alertType"] == "DIRECT" else "HIGH",
                "type": "ALLERGY",
                "message": alert["message"],
                "action": alert["action"]
            })

        # Contraindication recommendations
        for contra in contraindications:
            recommendations.append({
                "priority": "HIGH",
                "type": "CONTRAINDICATION",
                "message": f"{contra['drug']}: {contra['risk']} in {contra['condition']}",
                "action": contra["action"]
            })

        # Severe interaction recommendations
        severe_interactions = [i for i in interactions if i["severity"] == "SEVERE"]
        for interaction in severe_interactions:
            recommendations.append({
                "priority": "HIGH",
                "type": "DRUG_INTERACTION",
                "message": f"Caution: {interaction['drug1']} + {interaction['drug2']} - {interaction['effect']}",
                "action": interaction["management"]
            })

        # Food interaction recommendations
        for food in food_interactions:
            recommendations.append({
                "priority": "MODERATE",
                "type": "FOOD_INTERACTION",
                "message": f"{food['drug']}: {food['effect']} with {food['foodType']}",
                "action": food["management"]
            })

        # Age-specific recommendations
        if patient_age and patient_age >= 65:
            recommendations.append({
                "priority": "MODERATE",
                "type": "GERIATRIC",
                "message": "Patient is 65+ years old",
                "action": "Review for age-appropriate dosing. Consider renal/hepatic function."
            })

        # Moderate interaction recommendations
        moderate_interactions = [i for i in interactions if i["severity"] == "MODERATE"]
        for interaction in moderate_interactions[:3]:  # Limit to top 3
            recommendations.append({
                "priority": "MODERATE",
                "type": "DRUG_INTERACTION",
                "message": f"Monitor: {interaction['drug1']} + {interaction['drug2']}",
                "action": interaction["management"]
            })

        # Sort by priority
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
        recommendations.sort(key=lambda x: priority_order.get(x["priority"], 4))

        return recommendations

    def get_drug_info(self, drug_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific drug"""
        normalized = self.normalizer.normalize(drug_name)
        info = DRUG_DATABASE.get(normalized)

        if not info:
            return None

        return {
            "name": drug_name.title(),
            "genericName": normalized,
            **info,
            "interactions": list(DRUG_INTERACTIONS.get(normalized, {}).keys()),
            "foodInteractions": list(DRUG_FOOD_INTERACTIONS.get(normalized, {}).keys()),
            "modelVersion": self.model_version
        }

    def search_drugs(self, query: str, limit: int = 10) -> List[Dict[str, str]]:
        """Search for drugs by name or class"""
        query_lower = query.lower()
        results = []

        for drug_name, info in DRUG_DATABASE.items():
            # Check drug name
            if query_lower in drug_name:
                results.append({
                    "name": drug_name.title(),
                    "genericName": drug_name,
                    "class": info.get("class", "Unknown"),
                    "matchType": "name"
                })
                continue

            # Check brand names
            for brand in info.get("brand_names", []):
                if query_lower in brand.lower():
                    results.append({
                        "name": brand,
                        "genericName": drug_name,
                        "class": info.get("class", "Unknown"),
                        "matchType": "brand"
                    })
                    break

            # Check class
            if query_lower in info.get("class", "").lower():
                results.append({
                    "name": drug_name.title(),
                    "genericName": drug_name,
                    "class": info.get("class", "Unknown"),
                    "matchType": "class"
                })

        return results[:limit]

    @staticmethod
    def is_available() -> bool:
        """Check if AI-enhanced analysis is available"""
        return openai_manager.is_available()

    def analyze_interactions_with_ai(
        self,
        medications: List[str],
        patient_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        AI-enhanced drug interaction analysis using GPT-4.
        Falls back to rule-based analysis if OpenAI is unavailable.

        Args:
            medications: List of medication names
            patient_context: Optional patient-specific factors (age, conditions, other meds, etc.)

        Returns:
            Enhanced interaction analysis with AI insights
        """
        # First, perform rule-based analysis
        patient_conditions = patient_context.get("conditions", []) if patient_context else []
        patient_age = patient_context.get("age") if patient_context else None
        patient_weight = patient_context.get("weight") if patient_context else None
        allergies = patient_context.get("allergies", []) if patient_context else []

        rule_based_result = self.check_interactions(
            medications=medications,
            patient_conditions=patient_conditions,
            patient_age=patient_age,
            patient_weight=patient_weight,
            allergies=allergies
        )

        # Try AI-enhanced analysis
        if not openai_manager.is_available():
            return {
                **rule_based_result,
                "aiEnhanced": False,
                "aiAnalysis": None,
                "analysisMethod": "rule_based",
                "message": "AI analysis unavailable - using rule-based analysis only"
            }

        try:
            # Build prompt for GPT-4
            med_list = ", ".join(medications)
            context_str = ""
            if patient_context:
                context_parts = []
                if patient_age:
                    context_parts.append(f"Age: {patient_age}")
                if patient_weight:
                    context_parts.append(f"Weight: {patient_weight}kg")
                if patient_conditions:
                    context_parts.append(f"Conditions: {', '.join(patient_conditions)}")
                if allergies:
                    context_parts.append(f"Allergies: {', '.join(allergies)}")
                if patient_context.get("renal_function"):
                    context_parts.append(f"Renal function (eGFR): {patient_context['renal_function']}")
                if patient_context.get("hepatic_function"):
                    context_parts.append(f"Hepatic function: {patient_context['hepatic_function']}")
                context_str = "\n".join(context_parts)

            prompt = f"""As an expert clinical pharmacist with subspecialty training in pharmacokinetics and drug interactions, perform a comprehensive drug interaction analysis.

MEDICATIONS: {med_list}

PATIENT CONTEXT:
{context_str if context_str else "No additional patient context provided"}

Provide a detailed JSON response with the following structure:
{{
    "clinicalSummary": "2-3 sentence executive summary of most critical concerns requiring immediate attention",
    "patientSpecificRisks": [
        {{
            "risk": "Specific risk description",
            "severity": "CRITICAL/HIGH/MODERATE/LOW",
            "rationale": "Why this patient is at increased risk"
        }}
    ],
    "additionalInteractions": [
        {{
            "drugs": ["drug1", "drug2"],
            "severity": "CRITICAL/HIGH/MODERATE/LOW",
            "mechanism": "Pharmacokinetic or pharmacodynamic mechanism",
            "clinicalSignificance": "Expected clinical impact with onset timeframe",
            "recommendation": "Specific actionable recommendation"
        }}
    ],
    "pharmacokineticConsiderations": [
        {{
            "concern": "Description of PK concern",
            "affectedDrugs": ["drugs affected"],
            "clinicalImplication": "How this affects dosing/efficacy/toxicity",
            "adjustment": "Specific dose adjustment recommendation if applicable"
        }}
    ],
    "renalHepatic": {{
        "renalAdjustments": [
            {{
                "drug": "Drug name",
                "currentDose": "Typical dose",
                "recommendedAdjustment": "Adjustment based on patient's function",
                "rationale": "Why adjustment needed"
            }}
        ],
        "hepaticAdjustments": [
            {{
                "drug": "Drug name",
                "concern": "Hepatic metabolism concern",
                "recommendation": "Monitoring or dose adjustment"
            }}
        ]
    }},
    "monitoringRecommendations": [
        {{
            "parameter": "What to monitor",
            "targetRange": "Specific target values when applicable",
            "frequency": "How often to monitor",
            "rationale": "Why this monitoring is important"
        }}
    ],
    "alternatives": [
        {{
            "currentDrug": "Drug to replace",
            "alternative": "Suggested alternative",
            "rationale": "Why this is safer/more effective for this patient",
            "considerations": "Things to watch when switching"
        }}
    ],
    "drugFoodTimingAdvice": [
        {{
            "drug": "Drug name",
            "advice": "Specific administration timing guidance"
        }}
    ],
    "overallRiskAssessment": "LOW/MODERATE/HIGH/CRITICAL",
    "prioritizedActions": ["List of actions in order of priority"]
}}

ANALYSIS GUIDELINES:
1. Prioritize life-threatening interactions (QT prolongation, serotonin syndrome, bleeding risk, respiratory depression)
2. Consider patient age for pharmacokinetic changes (reduced renal clearance, altered distribution)
3. Account for polypharmacy risks and cumulative toxicities
4. Identify cytochrome P450 interactions (2D6, 3A4, 2C9, 2C19 substrates/inhibitors/inducers)
5. Note protein binding displacement interactions
6. Provide specific monitoring parameters with target ranges, not generic advice
7. Consider patient conditions when assessing risk (e.g., cardiac history + QT-prolonging drugs)
8. Identify therapeutic duplications that may increase adverse effects"""

            system_message = """You are a board-certified clinical pharmacist with expertise in:
- Drug-drug and drug-disease interactions
- Clinical pharmacokinetics and pharmacodynamics
- Geriatric and renal/hepatic dosing adjustments
- Medication safety and adverse drug reaction prevention
- Antimicrobial stewardship

Provide evidence-based, actionable analysis. Be specific with monitoring parameters (include target ranges), dose adjustments, and timing recommendations. Prioritize patient safety while avoiding unnecessary alarm for minor interactions."""

            result = openai_manager.chat_completion_json(
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                task_complexity=TaskComplexity.SIMPLE,  # gpt-4o-mini for pharmacy
                temperature=0.3,
                max_tokens=2000
            )

            if result and result.get("success"):
                ai_analysis = result.get("data", {})
            else:
                ai_analysis = {
                    "clinicalSummary": "Analysis completed with parsing issues",
                    "parseError": True
                }

            return {
                **rule_based_result,
                "aiEnhanced": True,
                "aiAnalysis": ai_analysis,
                "analysisMethod": "ai_enhanced",
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return {
                **rule_based_result,
                "aiEnhanced": False,
                "aiAnalysis": None,
                "analysisMethod": "rule_based",
                "error": str(e),
                "message": "AI analysis failed - using rule-based analysis only"
            }

    def reconcile_medications(
        self,
        current_meds: List[Dict[str, Any]],
        new_prescription: Optional[Dict[str, Any]] = None,
        patient_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform medication reconciliation to identify duplicates, therapeutic overlaps,
        and missing chronic medications.

        Args:
            current_meds: List of current medications with name, dose, frequency, indication
            new_prescription: Optional new prescription being added
            patient_data: Patient data including chronic conditions, admission meds, etc.

        Returns:
            Reconciliation report with findings and recommendations
        """
        timestamp = datetime.now().isoformat()

        # Normalize all medications
        normalized_current = []
        for med in current_meds:
            med_name = med.get("name", med.get("medication", ""))
            normalized_name = self.normalizer.normalize(med_name)
            drug_info = DRUG_DATABASE.get(normalized_name, {})
            normalized_current.append({
                **med,
                "normalizedName": normalized_name,
                "drugClass": drug_info.get("class", "Unknown"),
                "subclass": drug_info.get("subclass", "Unknown")
            })

        findings = {
            "duplicates": [],
            "therapeuticOverlaps": [],
            "missingChronicMeds": [],
            "doseDiscrepancies": [],
            "newInteractions": [],
            "recommendations": []
        }

        # Check for duplicate medications
        seen_drugs = {}
        for med in normalized_current:
            norm_name = med["normalizedName"]
            if norm_name in seen_drugs:
                findings["duplicates"].append({
                    "medication": med.get("name", norm_name),
                    "existingEntry": seen_drugs[norm_name],
                    "newEntry": med,
                    "severity": "HIGH",
                    "recommendation": f"Duplicate {norm_name} detected. Review and consolidate."
                })
            else:
                seen_drugs[norm_name] = med

        # Check for therapeutic overlaps (same class medications)
        class_groups = {}
        for med in normalized_current:
            drug_class = med.get("subclass") or med.get("drugClass", "Unknown")
            if drug_class != "Unknown":
                if drug_class not in class_groups:
                    class_groups[drug_class] = []
                class_groups[drug_class].append(med)

        therapeutic_overlap_classes = [
            "SSRI", "SNRI", "Beta Blocker", "ACE Inhibitor", "ARB",
            "Proton Pump Inhibitor", "Benzodiazepine", "Opioid",
            "Loop Diuretic", "HMG-CoA Reductase Inhibitor", "NSAID"
        ]

        for drug_class, meds in class_groups.items():
            if len(meds) > 1 and any(tc in drug_class for tc in therapeutic_overlap_classes):
                findings["therapeuticOverlaps"].append({
                    "drugClass": drug_class,
                    "medications": [m.get("name", m["normalizedName"]) for m in meds],
                    "count": len(meds),
                    "severity": "MODERATE",
                    "recommendation": f"Multiple {drug_class} medications. Review for therapeutic duplication."
                })

        # Check for missing chronic medications if patient data provided
        if patient_data:
            chronic_conditions = patient_data.get("chronicConditions", [])
            admission_meds = patient_data.get("admissionMedications", [])

            # Essential medications by condition
            essential_by_condition = {
                "diabetes": ["metformin", "insulin", "glipizide", "glyburide", "sitagliptin", "empagliflozin"],
                "hypertension": ["lisinopril", "amlodipine", "metoprolol", "losartan", "hydrochlorothiazide"],
                "heart failure": ["carvedilol", "metoprolol", "lisinopril", "spironolactone", "furosemide"],
                "atrial fibrillation": ["warfarin", "apixaban", "rivaroxaban", "metoprolol", "diltiazem"],
                "hypothyroidism": ["levothyroxine"],
                "copd": ["tiotropium", "albuterol", "fluticasone"],
                "depression": ["sertraline", "fluoxetine", "escitalopram", "venlafaxine", "duloxetine"]
            }

            current_norm_names = [m["normalizedName"] for m in normalized_current]

            for condition in chronic_conditions:
                condition_lower = condition.lower()
                for cond_key, meds in essential_by_condition.items():
                    if cond_key in condition_lower:
                        has_essential = any(
                            self.normalizer.normalize(m) in current_norm_names
                            for m in meds
                        )
                        if not has_essential:
                            findings["missingChronicMeds"].append({
                                "condition": condition,
                                "typicalMedications": meds[:3],
                                "severity": "MODERATE",
                                "recommendation": f"No medication for {condition}. Verify if intentional."
                            })

            # Check for medications on admission that are now missing
            if admission_meds:
                admission_norm = [self.normalizer.normalize(m.get("name", m) if isinstance(m, dict) else m) for m in admission_meds]
                for adm_med in admission_norm:
                    if adm_med and adm_med not in current_norm_names:
                        drug_info = DRUG_DATABASE.get(adm_med, {})
                        findings["missingChronicMeds"].append({
                            "medication": adm_med.title(),
                            "source": "admission_list",
                            "drugClass": drug_info.get("class", "Unknown"),
                            "severity": "MODERATE",
                            "recommendation": f"{adm_med.title()} was on admission list but not in current meds. Verify if discontinued intentionally."
                        })

        # Check new prescription against current medications
        if new_prescription:
            new_med_name = new_prescription.get("name", new_prescription.get("medication", ""))
            new_norm = self.normalizer.normalize(new_med_name)

            # Check for interactions with new prescription
            all_meds = [m["normalizedName"] for m in normalized_current] + [new_norm]
            interaction_check = self.check_interactions(
                medications=all_meds,
                patient_conditions=patient_data.get("conditions", []) if patient_data else None,
                patient_age=patient_data.get("age") if patient_data else None
            )

            if interaction_check["interactions"]:
                for interaction in interaction_check["interactions"]:
                    if new_norm in [interaction.get("drug1Generic", ""), interaction.get("drug2Generic", "")]:
                        findings["newInteractions"].append({
                            "newMedication": new_med_name,
                            "interactsWith": interaction["drug1"] if interaction.get("drug2Generic") == new_norm else interaction["drug2"],
                            "severity": interaction["severity"],
                            "effect": interaction["effect"],
                            "management": interaction["management"]
                        })

        # Generate overall recommendations
        if findings["duplicates"]:
            findings["recommendations"].append({
                "priority": "HIGH",
                "action": "Review and remove duplicate medications"
            })

        if findings["therapeuticOverlaps"]:
            findings["recommendations"].append({
                "priority": "MODERATE",
                "action": "Evaluate therapeutic duplications for medical necessity"
            })

        if findings["missingChronicMeds"]:
            findings["recommendations"].append({
                "priority": "MODERATE",
                "action": "Verify intentional discontinuation of chronic medications"
            })

        if findings["newInteractions"]:
            severe_interactions = [i for i in findings["newInteractions"] if i["severity"] in ["CONTRAINDICATED", "SEVERE"]]
            if severe_interactions:
                findings["recommendations"].append({
                    "priority": "CRITICAL",
                    "action": "Address severe drug interactions before starting new medication"
                })

        # Calculate reconciliation status
        issue_count = (
            len(findings["duplicates"]) +
            len(findings["therapeuticOverlaps"]) +
            len(findings["missingChronicMeds"]) +
            len(findings["newInteractions"])
        )

        if issue_count == 0:
            status = "RECONCILED"
            status_message = "No reconciliation issues identified"
        elif any(f["severity"] in ["CRITICAL", "HIGH"] for category in ["duplicates", "newInteractions"] for f in findings.get(category, [])):
            status = "CRITICAL_ISSUES"
            status_message = "Critical reconciliation issues require immediate attention"
        else:
            status = "ISSUES_FOUND"
            status_message = f"{issue_count} reconciliation issue(s) identified"

        return {
            "status": status,
            "statusMessage": status_message,
            "totalIssues": issue_count,
            "findings": findings,
            "medicationCount": len(current_meds),
            "timestamp": timestamp,
            "modelVersion": self.model_version
        }

    def predict_adherence_risk(
        self,
        medications: List[Dict[str, Any]],
        patient_demographics: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Predict medication adherence risk based on regimen complexity, pill burden,
        side effect profile, cost, and patient demographics.

        Args:
            medications: List of medications with name, dose, frequency, cost info
            patient_demographics: Patient info including age, cognitive status, socioeconomic factors

        Returns:
            Adherence risk assessment with score, factors, and interventions
        """
        timestamp = datetime.now().isoformat()

        risk_score = 0
        risk_factors = []
        interventions = []

        # Calculate pill burden
        pill_count = len(medications)
        if pill_count <= 3:
            pill_burden_score = ADHERENCE_RISK_FACTORS["pill_burden"]["1-3"]
        elif pill_count <= 6:
            pill_burden_score = ADHERENCE_RISK_FACTORS["pill_burden"]["4-6"]
            risk_factors.append({
                "factor": "Moderate pill burden",
                "description": f"Patient takes {pill_count} medications",
                "contribution": pill_burden_score
            })
        elif pill_count <= 10:
            pill_burden_score = ADHERENCE_RISK_FACTORS["pill_burden"]["7-10"]
            risk_factors.append({
                "factor": "High pill burden",
                "description": f"Patient takes {pill_count} medications",
                "contribution": pill_burden_score
            })
            interventions.append({
                "type": "pill_burden",
                "intervention": "Consider combination products or medication simplification",
                "priority": "MODERATE"
            })
        else:
            pill_burden_score = ADHERENCE_RISK_FACTORS["pill_burden"]["11+"]
            risk_factors.append({
                "factor": "Very high pill burden",
                "description": f"Patient takes {pill_count} medications",
                "contribution": pill_burden_score
            })
            interventions.append({
                "type": "pill_burden",
                "intervention": "Strongly recommend medication review to reduce pill burden",
                "priority": "HIGH"
            })
        risk_score += pill_burden_score

        # Calculate regimen complexity
        dosing_frequencies = {}
        for med in medications:
            freq = med.get("frequency", "once_daily").lower()
            if freq not in dosing_frequencies:
                dosing_frequencies[freq] = 0
            dosing_frequencies[freq] += 1

        max_complexity = 0
        for freq in dosing_frequencies.keys():
            if "four" in freq or "qid" in freq or "4" in freq:
                max_complexity = max(max_complexity, ADHERENCE_RISK_FACTORS["regimen_complexity"]["four_times_daily"])
            elif "three" in freq or "tid" in freq or "3" in freq:
                max_complexity = max(max_complexity, ADHERENCE_RISK_FACTORS["regimen_complexity"]["three_times_daily"])
            elif "twice" in freq or "bid" in freq or "2" in freq:
                max_complexity = max(max_complexity, ADHERENCE_RISK_FACTORS["regimen_complexity"]["twice_daily"])

        if len(dosing_frequencies) > 3:
            max_complexity = max(max_complexity, ADHERENCE_RISK_FACTORS["regimen_complexity"]["complex_timing"])
            risk_factors.append({
                "factor": "Complex dosing schedule",
                "description": f"Multiple different dosing frequencies ({len(dosing_frequencies)} different schedules)",
                "contribution": max_complexity
            })
            interventions.append({
                "type": "regimen_complexity",
                "intervention": "Synchronize dosing times where possible",
                "priority": "MODERATE"
            })
        elif max_complexity > 0:
            risk_factors.append({
                "factor": "Multiple daily doses required",
                "description": "Some medications require multiple daily doses",
                "contribution": max_complexity
            })
        risk_score += max_complexity

        # Assess side effect profile
        high_side_effect_drugs = ["metformin", "metoprolol", "lisinopril", "statins", "opioids", "ssri", "snri"]
        side_effect_count = 0
        for med in medications:
            med_name = med.get("name", "").lower()
            norm_name = self.normalizer.normalize(med_name)
            drug_info = DRUG_DATABASE.get(norm_name, {})
            drug_class = drug_info.get("subclass", "").lower()

            if any(se_drug in norm_name or se_drug in drug_class for se_drug in high_side_effect_drugs):
                side_effect_count += 1

        if side_effect_count >= 3:
            se_score = ADHERENCE_RISK_FACTORS["side_effects"]["significant"]
            risk_factors.append({
                "factor": "Multiple medications with notable side effects",
                "description": f"{side_effect_count} medications with significant side effect profiles",
                "contribution": se_score
            })
            interventions.append({
                "type": "side_effects",
                "intervention": "Proactive counseling on side effect management",
                "priority": "MODERATE"
            })
        elif side_effect_count >= 1:
            se_score = ADHERENCE_RISK_FACTORS["side_effects"]["moderate"]
        else:
            se_score = ADHERENCE_RISK_FACTORS["side_effects"]["minimal"]
        risk_score += se_score

        # Assess patient demographics
        if patient_demographics:
            # Age factors
            age = patient_demographics.get("age")
            if age:
                if age < 40:
                    age_score = ADHERENCE_RISK_FACTORS["age_factors"]["18-40"]
                    risk_factors.append({
                        "factor": "Younger adult",
                        "description": "May have lifestyle factors affecting adherence",
                        "contribution": age_score
                    })
                elif age < 65:
                    age_score = ADHERENCE_RISK_FACTORS["age_factors"]["41-64"]
                elif age < 75:
                    age_score = ADHERENCE_RISK_FACTORS["age_factors"]["65-74"]
                    risk_factors.append({
                        "factor": "Older adult",
                        "description": "Age-related factors may affect adherence",
                        "contribution": age_score
                    })
                else:
                    age_score = ADHERENCE_RISK_FACTORS["age_factors"]["75+"]
                    risk_factors.append({
                        "factor": "Elderly patient",
                        "description": "Higher risk due to cognitive and physical factors",
                        "contribution": age_score
                    })
                    interventions.append({
                        "type": "age_related",
                        "intervention": "Consider pill organizer, caregiver involvement, or blister packaging",
                        "priority": "HIGH"
                    })
                risk_score += age_score

            # Cognitive status
            cognitive = patient_demographics.get("cognitiveStatus", "intact").lower()
            if "mild" in cognitive:
                cog_score = ADHERENCE_RISK_FACTORS["cognitive_status"]["mild_impairment"]
                risk_factors.append({
                    "factor": "Mild cognitive impairment",
                    "description": "May need reminders or assistance",
                    "contribution": cog_score
                })
                interventions.append({
                    "type": "cognitive",
                    "intervention": "Use pill organizers and medication reminders",
                    "priority": "MODERATE"
                })
            elif "moderate" in cognitive:
                cog_score = ADHERENCE_RISK_FACTORS["cognitive_status"]["moderate_impairment"]
                risk_factors.append({
                    "factor": "Moderate cognitive impairment",
                    "description": "Requires assistance with medication management",
                    "contribution": cog_score
                })
                interventions.append({
                    "type": "cognitive",
                    "intervention": "Arrange caregiver medication administration",
                    "priority": "HIGH"
                })
            elif "severe" in cognitive:
                cog_score = ADHERENCE_RISK_FACTORS["cognitive_status"]["severe_impairment"]
                risk_factors.append({
                    "factor": "Severe cognitive impairment",
                    "description": "Unable to self-manage medications",
                    "contribution": cog_score
                })
                interventions.append({
                    "type": "cognitive",
                    "intervention": "Full medication management by caregiver required",
                    "priority": "CRITICAL"
                })
            else:
                cog_score = ADHERENCE_RISK_FACTORS["cognitive_status"]["intact"]
            risk_score += cog_score

            # Cost concerns
            cost_concern = patient_demographics.get("costConcern", "none").lower()
            if "severe" in cost_concern:
                cost_score = ADHERENCE_RISK_FACTORS["cost_concerns"]["severe"]
                risk_factors.append({
                    "factor": "Severe cost concerns",
                    "description": "Financial barriers to obtaining medications",
                    "contribution": cost_score
                })
                interventions.append({
                    "type": "cost",
                    "intervention": "Patient assistance programs, generic substitutions, 90-day supplies",
                    "priority": "HIGH"
                })
            elif "moderate" in cost_concern:
                cost_score = ADHERENCE_RISK_FACTORS["cost_concerns"]["moderate"]
                risk_factors.append({
                    "factor": "Moderate cost concerns",
                    "description": "May skip doses due to cost",
                    "contribution": cost_score
                })
                interventions.append({
                    "type": "cost",
                    "intervention": "Review for lower-cost alternatives",
                    "priority": "MODERATE"
                })
            elif "mild" in cost_concern:
                cost_score = ADHERENCE_RISK_FACTORS["cost_concerns"]["mild"]
            else:
                cost_score = ADHERENCE_RISK_FACTORS["cost_concerns"]["none"]
            risk_score += cost_score

            # Previous non-adherence history
            if patient_demographics.get("previousNonAdherence"):
                history_score = 25
                risk_score += history_score
                risk_factors.append({
                    "factor": "History of non-adherence",
                    "description": "Previous documented medication non-adherence",
                    "contribution": history_score
                })
                interventions.append({
                    "type": "behavioral",
                    "intervention": "Motivational interviewing, identify and address previous barriers",
                    "priority": "HIGH"
                })

        # Determine risk level
        if risk_score >= 80:
            risk_level = "CRITICAL"
            risk_description = "Very high risk of medication non-adherence"
        elif risk_score >= 50:
            risk_level = "HIGH"
            risk_description = "High risk of medication non-adherence"
        elif risk_score >= 25:
            risk_level = "MODERATE"
            risk_description = "Moderate risk of medication non-adherence"
        else:
            risk_level = "LOW"
            risk_description = "Low risk of medication non-adherence"

        # Sort interventions by priority
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
        interventions.sort(key=lambda x: priority_order.get(x["priority"], 4))

        return {
            "riskScore": min(risk_score, 100),
            "riskLevel": risk_level,
            "riskDescription": risk_description,
            "riskFactors": risk_factors,
            "interventions": interventions,
            "medicationCount": len(medications),
            "timestamp": timestamp,
            "modelVersion": self.model_version
        }

    def review_antibiotic(
        self,
        antibiotic: str,
        indication: str,
        duration: int,
        cultures: Optional[Dict[str, Any]] = None,
        patient_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Antimicrobial stewardship review for antibiotic prescriptions.

        Args:
            antibiotic: Name of the antibiotic
            indication: Clinical indication for use
            duration: Planned duration in days
            cultures: Culture results if available
            patient_data: Patient information including allergies, renal function

        Returns:
            Stewardship recommendations
        """
        timestamp = datetime.now().isoformat()
        normalized_antibiotic = self.normalizer.normalize(antibiotic)

        # Get antibiotic guidelines
        abx_info = ANTIBIOTIC_GUIDELINES.get(normalized_antibiotic, {})
        drug_db_info = DRUG_DATABASE.get(normalized_antibiotic, {})

        recommendations = []
        alerts = []
        appropriateness = "APPROPRIATE"

        indication_lower = indication.lower().replace(" ", "_").replace("-", "_")

        # Check duration appropriateness
        if abx_info:
            typical_durations = abx_info.get("typical_duration", {})
            recommended_duration = None

            for ind_key, dur in typical_durations.items():
                if ind_key in indication_lower or indication_lower in ind_key:
                    recommended_duration = dur
                    break

            if recommended_duration:
                if isinstance(recommended_duration, int):
                    if duration > recommended_duration + 2:
                        alerts.append({
                            "type": "DURATION",
                            "severity": "MODERATE",
                            "message": f"Duration ({duration} days) exceeds typical duration ({recommended_duration} days) for {indication}",
                            "recommendation": f"Consider shorter course of {recommended_duration} days per guidelines"
                        })
                        appropriateness = "REVIEW_RECOMMENDED"
                    elif duration < recommended_duration - 1:
                        alerts.append({
                            "type": "DURATION",
                            "severity": "LOW",
                            "message": f"Duration ({duration} days) is shorter than typical ({recommended_duration} days)",
                            "recommendation": "Ensure adequate treatment duration unless de-escalating based on clinical response"
                        })

            # Check if indication is appropriate for this antibiotic
            typical_indications = abx_info.get("typical_indications", [])
            indication_match = any(
                ind in indication_lower or indication_lower in ind
                for ind in typical_indications
            )

            if not indication_match and typical_indications:
                recommendations.append({
                    "type": "INDICATION",
                    "priority": "MODERATE",
                    "message": f"{antibiotic} is not typically first-line for {indication}",
                    "typical_uses": typical_indications
                })
                appropriateness = "REVIEW_RECOMMENDED"

            # Check for de-escalation opportunities
            spectrum = abx_info.get("spectrum", "")
            de_escalation_options = abx_info.get("de_escalation_to", [])

            if spectrum in ["broad", "very_broad", "carbapenem"] and de_escalation_options:
                if cultures and cultures.get("organism"):
                    organism = cultures.get("organism", "").lower()
                    sensitivities = cultures.get("sensitivities", [])

                    # Check if narrower spectrum would cover organism
                    for narrow_option in de_escalation_options:
                        if narrow_option.lower() in [s.lower() for s in sensitivities]:
                            recommendations.append({
                                "type": "DE_ESCALATION",
                                "priority": "HIGH",
                                "message": f"Culture shows {organism} sensitive to {narrow_option}",
                                "recommendation": f"Consider de-escalating from {antibiotic} to {narrow_option}"
                            })
                            appropriateness = "DE_ESCALATION_RECOMMENDED"
                            break
                else:
                    recommendations.append({
                        "type": "SPECTRUM",
                        "priority": "MODERATE",
                        "message": f"{antibiotic} has {spectrum} spectrum",
                        "recommendation": "Obtain cultures to guide potential de-escalation",
                        "de_escalation_options": de_escalation_options
                    })

            # Check for contraindications
            avoid_conditions = abx_info.get("avoid_in", [])
            if patient_data and avoid_conditions:
                allergies = [a.lower() for a in patient_data.get("allergies", [])]
                conditions = [c.lower() for c in patient_data.get("conditions", [])]

                for avoid in avoid_conditions:
                    if avoid in allergies or avoid in str(conditions):
                        alerts.append({
                            "type": "CONTRAINDICATION",
                            "severity": "HIGH",
                            "message": f"{antibiotic} should be avoided due to: {avoid}",
                            "recommendation": "Consider alternative antibiotic"
                        })
                        appropriateness = "CONTRAINDICATED"

            # Check for required monitoring
            monitoring = abx_info.get("requires_monitoring", [])
            if monitoring:
                recommendations.append({
                    "type": "MONITORING",
                    "priority": "MODERATE",
                    "message": f"{antibiotic} requires monitoring",
                    "parameters": monitoring
                })

            # Reserve antibiotics warning
            reserve_for = abx_info.get("reserve_for", [])
            if reserve_for:
                alerts.append({
                    "type": "RESTRICTED",
                    "severity": "MODERATE",
                    "message": f"{antibiotic} should be reserved for: {', '.join(reserve_for)}",
                    "recommendation": "Ensure appropriate indication for restricted antibiotic"
                })

        # Additional recommendations based on patient data
        if patient_data:
            renal_function = patient_data.get("renal_function")  # eGFR
            if renal_function and renal_function < 30:
                recommendations.append({
                    "type": "RENAL_ADJUSTMENT",
                    "priority": "HIGH",
                    "message": f"Patient has reduced renal function (eGFR: {renal_function})",
                    "recommendation": "Review for dose adjustment based on renal function"
                })

            age = patient_data.get("age")
            if age and age >= 65:
                if normalized_antibiotic in ["ciprofloxacin", "levofloxacin"]:
                    alerts.append({
                        "type": "AGE_CONSIDERATION",
                        "severity": "MODERATE",
                        "message": "Fluoroquinolones have increased risk of adverse effects in elderly",
                        "recommendation": "Consider alternatives if appropriate"
                    })

        # Sort by severity/priority
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
        alerts.sort(key=lambda x: severity_order.get(x.get("severity", "LOW"), 4))

        priority_order = {"HIGH": 0, "MODERATE": 1, "LOW": 2}
        recommendations.sort(key=lambda x: priority_order.get(x.get("priority", "LOW"), 3))

        return {
            "antibiotic": antibiotic,
            "normalizedName": normalized_antibiotic,
            "indication": indication,
            "prescribedDuration": duration,
            "appropriateness": appropriateness,
            "spectrum": abx_info.get("spectrum", "unknown"),
            "alerts": alerts,
            "recommendations": recommendations,
            "drugInfo": {
                "class": drug_db_info.get("class", "Antibiotic"),
                "subclass": drug_db_info.get("subclass", "Unknown"),
                "mechanism": drug_db_info.get("mechanism", "Unknown")
            },
            "cultureData": cultures if cultures else None,
            "timestamp": timestamp,
            "modelVersion": self.model_version
        }
