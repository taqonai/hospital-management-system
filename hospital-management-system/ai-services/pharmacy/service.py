"""
Pharmacy AI Service - Drug Interaction Checker
Comprehensive drug interaction analysis with severity classification and clinical recommendations
"""

from typing import List, Dict, Any, Optional, Tuple
import logging
import re

from .knowledge_base import (
    DRUG_DATABASE,
    DRUG_INTERACTIONS,
    DRUG_FOOD_INTERACTIONS,
    DRUG_CONDITION_CONTRAINDICATIONS,
    SEVERITY_LEVELS,
)

logger = logging.getLogger(__name__)


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
