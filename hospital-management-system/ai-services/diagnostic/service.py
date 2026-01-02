"""
Diagnostic AI Service with ML-powered Symptom Analysis
Uses Sentence Transformers for semantic matching and Bayesian-style inference
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import logging
import re

# Initialize logger
logger = logging.getLogger(__name__)

# Lazy load sentence transformers to speed up initial startup
_model = None
_symptom_embeddings_cache = {}


def get_sentence_model():
    """Lazy load the sentence transformer model"""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence transformer model...")
            # Use a lightweight but effective model for medical text
            _model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Sentence transformer model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load sentence transformer: {e}. Using fallback matching.")
            _model = "fallback"
    return _model


# Import knowledge base
from .knowledge_base import (
    DISEASE_DATABASE,
    SYMPTOM_TEST_RECOMMENDATIONS,
    DRUG_INTERACTIONS_DATABASE,
    SYMPTOM_SYNONYMS,
)


class SymptomEncoder:
    """Encodes symptoms using sentence transformers for semantic matching"""

    def __init__(self):
        self.model = None
        self._disease_symptom_embeddings = {}
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of the model and embeddings"""
        if self._initialized:
            return

        self.model = get_sentence_model()
        if self.model != "fallback":
            self._precompute_disease_embeddings()
        self._initialized = True

    def _precompute_disease_embeddings(self):
        """Pre-compute embeddings for all disease symptoms"""
        if self.model == "fallback":
            return

        for icd_code, disease_data in DISEASE_DATABASE.items():
            symptoms = disease_data.get("symptoms", [])
            if symptoms:
                try:
                    embeddings = self.model.encode(symptoms, convert_to_numpy=True)
                    self._disease_symptom_embeddings[icd_code] = {
                        "symptoms": symptoms,
                        "embeddings": embeddings,
                        "weights": disease_data.get("symptom_weights", {})
                    }
                except Exception as e:
                    logger.warning(f"Failed to encode symptoms for {icd_code}: {e}")

    def encode_symptoms(self, symptoms: List[str]) -> Optional[np.ndarray]:
        """Encode input symptoms into embeddings"""
        self._ensure_initialized()

        if self.model == "fallback" or not symptoms:
            return None

        try:
            return self.model.encode(symptoms, convert_to_numpy=True)
        except Exception as e:
            logger.warning(f"Failed to encode symptoms: {e}")
            return None

    def compute_disease_similarity(
        self,
        input_embeddings: np.ndarray,
        input_symptoms: List[str]
    ) -> Dict[str, float]:
        """Compute similarity between input symptoms and each disease"""
        self._ensure_initialized()

        disease_scores = {}

        for icd_code, data in self._disease_symptom_embeddings.items():
            disease_embeddings = data["embeddings"]
            disease_symptoms = data["symptoms"]
            symptom_weights = data["weights"]

            # Compute cosine similarity matrix
            similarity_matrix = cosine_similarity(input_embeddings, disease_embeddings)

            # For each input symptom, find best matching disease symptom
            total_score = 0.0
            matched_symptoms = []

            for i, input_symptom in enumerate(input_symptoms):
                best_match_idx = np.argmax(similarity_matrix[i])
                best_match_score = similarity_matrix[i][best_match_idx]

                # Only count if similarity is above threshold
                if best_match_score > 0.4:
                    matched_disease_symptom = disease_symptoms[best_match_idx]
                    # Apply symptom weight from knowledge base
                    weight = symptom_weights.get(matched_disease_symptom, 0.5)
                    weighted_score = best_match_score * weight
                    total_score += weighted_score
                    matched_symptoms.append({
                        "input": input_symptom,
                        "matched": matched_disease_symptom,
                        "similarity": float(best_match_score),
                        "weighted_score": float(weighted_score)
                    })

            # Normalize by number of input symptoms
            if len(input_symptoms) > 0:
                normalized_score = total_score / len(input_symptoms)
                disease_scores[icd_code] = {
                    "score": normalized_score,
                    "matched_symptoms": matched_symptoms,
                    "symptom_coverage": len(matched_symptoms) / len(disease_symptoms)
                }

        return disease_scores


class DiagnosticAI:
    """ML-powered Diagnostic AI for clinical decision support"""

    def __init__(self):
        self.model_version = "2.0.0-ml"
        self.symptom_encoder = SymptomEncoder()
        self._use_ml = True

    def analyze(
        self,
        symptoms: List[str],
        patient_age: int,
        gender: str,
        medical_history: Optional[List[str]] = None,
        current_medications: Optional[List[str]] = None,
        allergies: Optional[List[str]] = None,
        vital_signs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze symptoms using ML-powered semantic matching and generate differential diagnosis
        """
        # Normalize input symptoms
        normalized_symptoms = self._normalize_symptoms(symptoms)

        # Generate diagnoses using ML or fallback
        diagnoses = self._generate_diagnoses_ml(
            normalized_symptoms, patient_age, gender, medical_history
        )

        # Get recommended tests
        recommended_tests = self._recommend_tests(normalized_symptoms, diagnoses)

        # Generate treatment suggestions based on top diagnoses
        treatment_suggestions = self._suggest_treatments(diagnoses, patient_age, medical_history)

        # Check drug interactions
        drug_interactions = self._check_drug_interactions(current_medications or [], allergies or [])

        # Identify risk factors
        risk_factors = self._identify_risk_factors(
            patient_age, gender, medical_history or [], vital_signs, diagnoses
        )

        # Calculate overall confidence
        confidence = self._calculate_confidence(symptoms, diagnoses)

        return {
            "diagnoses": diagnoses[:5],
            "recommendedTests": list(set(recommended_tests))[:8],
            "treatmentSuggestions": treatment_suggestions[:6],
            "drugInteractions": drug_interactions,
            "riskFactors": risk_factors,
            "confidence": confidence,
            "modelVersion": self.model_version,
        }

    def _normalize_symptoms(self, symptoms: List[str]) -> List[str]:
        """Normalize and expand symptoms using synonym matching"""
        normalized = []

        for symptom in symptoms:
            symptom_lower = symptom.lower().strip()
            normalized.append(symptom_lower)

            # Check if symptom matches any synonyms and add canonical form
            for canonical, synonyms in SYMPTOM_SYNONYMS.items():
                if symptom_lower in synonyms or canonical in symptom_lower:
                    if canonical not in normalized:
                        normalized.append(canonical)
                    break

        return list(set(normalized))

    def _generate_diagnoses_ml(
        self,
        symptoms: List[str],
        patient_age: int,
        gender: str,
        medical_history: Optional[List[str]],
    ) -> List[Dict[str, Any]]:
        """Generate diagnoses using ML-based semantic matching"""

        # Try ML-based approach
        input_embeddings = self.symptom_encoder.encode_symptoms(symptoms)

        if input_embeddings is not None:
            disease_scores = self.symptom_encoder.compute_disease_similarity(
                input_embeddings, symptoms
            )
            diagnoses = self._process_ml_scores(
                disease_scores, patient_age, gender, medical_history
            )
        else:
            # Fallback to keyword matching
            diagnoses = self._generate_diagnoses_fallback(
                symptoms, patient_age, gender, medical_history
            )

        return diagnoses

    def _process_ml_scores(
        self,
        disease_scores: Dict[str, Dict[str, Any]],
        patient_age: int,
        gender: str,
        medical_history: Optional[List[str]]
    ) -> List[Dict[str, Any]]:
        """Process ML scores and apply clinical modifiers"""

        diagnoses = []

        for icd_code, score_data in disease_scores.items():
            if icd_code not in DISEASE_DATABASE:
                continue

            disease_info = DISEASE_DATABASE[icd_code]
            base_score = score_data["score"]

            # Apply age modifier
            age_modifier = self._get_age_modifier(patient_age, disease_info.get("age_modifier", {}))

            # Apply gender modifier
            gender_modifier = self._get_gender_modifier(gender, disease_info.get("gender_modifier", {}))

            # Apply medical history modifier
            history_modifier = self._get_history_modifier(
                medical_history or [], disease_info.get("risk_factors", [])
            )

            # Calculate final score
            final_score = base_score * age_modifier * gender_modifier * history_modifier

            # Calculate confidence (scaled and bounded)
            confidence = min(max(final_score, 0.05), 0.95)

            diagnoses.append({
                "icd10": icd_code,
                "name": disease_info["name"],
                "confidence": round(float(confidence), 3),
                "category": disease_info.get("category", "general"),
                "severity": disease_info.get("severity", "unknown"),
                "matched_symptoms": score_data.get("matched_symptoms", [])[:3],
                "symptom_coverage": round(float(score_data.get("symptom_coverage", 0)), 2),
            })

        # Sort by confidence
        diagnoses.sort(key=lambda x: x["confidence"], reverse=True)

        # Remove matched_symptoms and ensure proper float formatting
        for diag in diagnoses:
            del diag["matched_symptoms"]
            del diag["symptom_coverage"]
            # Ensure confidence is properly rounded
            diag["confidence"] = round(float(diag["confidence"]), 3)

        return diagnoses

    def _generate_diagnoses_fallback(
        self,
        symptoms: List[str],
        patient_age: int,
        gender: str,
        medical_history: Optional[List[str]],
    ) -> List[Dict[str, Any]]:
        """Fallback keyword-based diagnosis generation"""
        diagnosis_scores: Dict[str, Dict[str, Any]] = {}

        for icd_code, disease_info in DISEASE_DATABASE.items():
            disease_symptoms = [s.lower() for s in disease_info.get("symptoms", [])]
            symptom_weights = disease_info.get("symptom_weights", {})

            total_score = 0.0
            matches = 0

            for input_symptom in symptoms:
                input_lower = input_symptom.lower()
                for disease_symptom in disease_symptoms:
                    if input_lower in disease_symptom or disease_symptom in input_lower:
                        weight = symptom_weights.get(disease_symptom, 0.5)
                        total_score += weight
                        matches += 1
                        break

            if matches > 0:
                # Normalize score
                normalized_score = total_score / max(len(symptoms), 1)

                # Apply modifiers
                age_mod = self._get_age_modifier(patient_age, disease_info.get("age_modifier", {}))
                gender_mod = self._get_gender_modifier(gender, disease_info.get("gender_modifier", {}))
                history_mod = self._get_history_modifier(
                    medical_history or [], disease_info.get("risk_factors", [])
                )

                final_score = normalized_score * age_mod * gender_mod * history_mod
                confidence = min(max(final_score, 0.05), 0.95)

                diagnosis_scores[icd_code] = {
                    "icd10": icd_code,
                    "name": disease_info["name"],
                    "confidence": float(round(confidence, 3)),
                    "category": disease_info.get("category", "general"),
                    "severity": disease_info.get("severity", "unknown"),
                }

        diagnoses = list(diagnosis_scores.values())
        diagnoses.sort(key=lambda x: x["confidence"], reverse=True)

        return diagnoses

    def _get_age_modifier(self, age: int, age_modifiers: Dict[str, float]) -> float:
        """Get age-based modifier for disease probability"""
        if not age_modifiers:
            return 1.0

        for age_range, modifier in age_modifiers.items():
            if "-" in age_range:
                parts = age_range.replace("+", "").split("-")
                min_age = int(parts[0])
                max_age = int(parts[1]) if len(parts) > 1 and parts[1] else 150
                if min_age <= age <= max_age:
                    return modifier
            elif age_range.endswith("+"):
                min_age = int(age_range[:-1])
                if age >= min_age:
                    return modifier

        return 1.0

    def _get_gender_modifier(self, gender: str, gender_modifiers: Dict[str, float]) -> float:
        """Get gender-based modifier for disease probability"""
        if not gender_modifiers:
            return 1.0

        gender_lower = gender.lower()
        return gender_modifiers.get(gender_lower, 1.0)

    def _get_history_modifier(self, history: List[str], risk_factors: List[str]) -> float:
        """Get medical history-based modifier"""
        if not history or not risk_factors:
            return 1.0

        history_lower = [h.lower() for h in history]
        risk_lower = [r.lower() for r in risk_factors]

        matches = 0
        for hist in history_lower:
            for risk in risk_lower:
                if risk in hist or hist in risk:
                    matches += 1
                    break

        # Increase probability based on matching risk factors
        if matches > 0:
            return 1.0 + (matches * 0.15)

        return 1.0

    def _recommend_tests(
        self,
        symptoms: List[str],
        diagnoses: List[Dict[str, Any]]
    ) -> List[str]:
        """Recommend diagnostic tests based on symptoms and potential diagnoses"""
        tests = set()

        # Add tests based on symptoms
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            for key, test_list in SYMPTOM_TEST_RECOMMENDATIONS.items():
                if key in symptom_lower or symptom_lower in key:
                    tests.update(test_list)

        # Add tests based on top diagnoses categories
        for diag in diagnoses[:3]:
            category = diag.get("category", "")
            severity = diag.get("severity", "")

            if category == "cardiovascular":
                tests.update(["ECG", "Troponin I/T", "BNP/NT-proBNP", "Lipid Panel"])
            elif category == "respiratory":
                tests.update(["Chest X-ray", "Pulmonary Function Test", "Pulse Oximetry"])
            elif category == "gastrointestinal":
                tests.update(["Abdominal Ultrasound", "Liver Function Test", "Lipase"])
            elif category == "endocrine":
                tests.update(["Thyroid Panel (TSH, T3, T4)", "HbA1c", "Fasting Glucose"])
            elif category == "infectious":
                tests.update(["CBC with Differential", "CRP", "Blood Culture"])
            elif category == "hematological":
                tests.update(["CBC", "Iron Studies", "Vitamin B12", "Folate"])

            # Add more tests for severe conditions
            if "severe" in severity or "emergency" in severity:
                tests.update(["Basic Metabolic Panel", "CBC", "Urinalysis"])

        return list(tests)

    def _suggest_treatments(
        self,
        diagnoses: List[Dict[str, Any]],
        patient_age: int,
        medical_history: Optional[List[str]]
    ) -> List[str]:
        """Generate treatment suggestions based on diagnoses"""
        suggestions = []

        if not diagnoses:
            suggestions.append("Further clinical evaluation recommended")
            return suggestions

        top_diagnosis = diagnoses[0] if diagnoses else None

        if top_diagnosis:
            severity = top_diagnosis.get("severity", "")
            category = top_diagnosis.get("category", "")

            # Emergency conditions
            if "emergency" in severity:
                suggestions.append("URGENT: Immediate medical evaluation required")
                suggestions.append("Consider emergency department referral")

            # Category-specific suggestions
            if category == "cardiovascular":
                suggestions.append("Cardiology consultation recommended")
                suggestions.append("Monitor vital signs closely")
                if patient_age > 50:
                    suggestions.append("Consider cardiac risk stratification")

            elif category == "respiratory":
                suggestions.append("Monitor oxygen saturation")
                suggestions.append("Pulmonology consultation if symptoms persist")

            elif category == "infectious":
                suggestions.append("Consider empiric antimicrobial therapy pending cultures")
                suggestions.append("Ensure adequate hydration")

            elif category == "gastrointestinal":
                suggestions.append("Dietary modifications may be beneficial")
                suggestions.append("Gastroenterology referral if symptoms persist")

            elif category == "mental_health":
                suggestions.append("Mental health professional consultation recommended")
                suggestions.append("Assess for safety concerns")

        # General suggestions
        suggestions.append("Review and reconcile current medications")
        suggestions.append("Schedule follow-up to reassess symptoms")

        # Age-specific suggestions
        if patient_age > 65:
            suggestions.append("Consider geriatric-specific dosing adjustments")

        return list(set(suggestions))

    def _check_drug_interactions(
        self,
        medications: List[str],
        allergies: List[str]
    ) -> List[Dict[str, str]]:
        """Check for potential drug interactions"""
        interactions = []

        med_lower = [m.lower().strip() for m in medications]

        for drug, interaction_dict in DRUG_INTERACTIONS_DATABASE.items():
            if drug in med_lower:
                for interacting_drug, warning in interaction_dict.items():
                    if interacting_drug in med_lower:
                        interactions.append({
                            "drug1": drug.capitalize(),
                            "drug2": interacting_drug.capitalize(),
                            "severity": "high" if "contraindicated" in warning.lower() else "moderate",
                            "warning": warning
                        })

        # Check allergies against common drug classes
        allergy_warnings = {
            "penicillin": ["amoxicillin", "ampicillin", "augmentin"],
            "sulfa": ["sulfamethoxazole", "bactrim", "septra"],
            "nsaid": ["ibuprofen", "naproxen", "aspirin"],
        }

        allergy_lower = [a.lower() for a in allergies]
        for allergy, drugs in allergy_warnings.items():
            if allergy in allergy_lower:
                for drug in drugs:
                    if drug in med_lower:
                        interactions.append({
                            "drug1": drug.capitalize(),
                            "drug2": f"{allergy.capitalize()} allergy",
                            "severity": "high",
                            "warning": f"Patient has {allergy} allergy - avoid {drug}"
                        })

        return interactions

    def _identify_risk_factors(
        self,
        age: int,
        gender: str,
        medical_history: List[str],
        vital_signs: Optional[Dict[str, Any]],
        diagnoses: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """Identify patient risk factors"""
        risk_factors = []

        # Age-related risks
        if age > 65:
            risk_factors.append({
                "factor": "Age > 65 years",
                "relevance": "Increased risk for cardiovascular and infectious complications"
            })
        elif age > 50:
            risk_factors.append({
                "factor": "Age > 50 years",
                "relevance": "Consider age-appropriate screening recommendations"
            })

        # Medical history risks
        history_lower = [h.lower() for h in medical_history]

        chronic_conditions = {
            "diabetes": "Increased infection risk, cardiovascular complications",
            "hypertension": "Cardiovascular and renal complications",
            "heart disease": "Cardiac event risk",
            "copd": "Respiratory complications",
            "asthma": "Respiratory exacerbations",
            "kidney disease": "Drug dosing considerations, electrolyte imbalances",
            "liver disease": "Drug metabolism considerations",
            "immunocompromised": "Increased infection risk",
            "cancer": "Consider oncologic implications",
            "obesity": "Metabolic and cardiovascular risks",
        }

        for condition, relevance in chronic_conditions.items():
            if any(condition in h for h in history_lower):
                risk_factors.append({
                    "factor": f"History of {condition}",
                    "relevance": relevance
                })

        # Vital sign abnormalities
        if vital_signs:
            # Blood pressure
            bp = vital_signs.get("bloodPressure", "")
            if bp and "/" in str(bp):
                try:
                    systolic = int(str(bp).split("/")[0])
                    diastolic = int(str(bp).split("/")[1])
                    if systolic > 140 or diastolic > 90:
                        risk_factors.append({
                            "factor": f"Elevated blood pressure ({bp})",
                            "relevance": "Hypertensive; monitor for end-organ damage"
                        })
                    elif systolic < 90:
                        risk_factors.append({
                            "factor": f"Low blood pressure ({bp})",
                            "relevance": "Hypotensive; assess for shock or dehydration"
                        })
                except ValueError:
                    pass

            # Heart rate
            hr = vital_signs.get("heartRate")
            if hr:
                if hr > 100:
                    risk_factors.append({
                        "factor": f"Tachycardia (HR: {hr})",
                        "relevance": "Elevated heart rate; consider underlying cause"
                    })
                elif hr < 60:
                    risk_factors.append({
                        "factor": f"Bradycardia (HR: {hr})",
                        "relevance": "Low heart rate; evaluate for cardiac conduction issues"
                    })

            # Oxygen saturation
            spo2 = vital_signs.get("oxygenSaturation")
            if spo2 and spo2 < 95:
                risk_factors.append({
                    "factor": f"Low oxygen saturation ({spo2}%)",
                    "relevance": "Hypoxemia; supplemental oxygen may be needed"
                })

            # Temperature
            temp = vital_signs.get("temperature")
            if temp:
                if temp > 38.0:
                    risk_factors.append({
                        "factor": f"Fever ({temp}°C)",
                        "relevance": "Febrile; consider infectious etiology"
                    })
                elif temp < 36.0:
                    risk_factors.append({
                        "factor": f"Hypothermia ({temp}°C)",
                        "relevance": "Low body temperature; assess for exposure or sepsis"
                    })

        return risk_factors

    def _calculate_confidence(
        self,
        symptoms: List[str],
        diagnoses: List[Dict[str, Any]]
    ) -> float:
        """Calculate overall analysis confidence"""
        if not diagnoses:
            return 0.3

        # Weight top diagnoses
        top_confidence = diagnoses[0]["confidence"] if diagnoses else 0
        avg_top3 = sum(d["confidence"] for d in diagnoses[:3]) / min(len(diagnoses), 3)

        # Factor in symptom count (more symptoms = more confident analysis)
        symptom_factor = min(len(symptoms) / 5, 1.0)

        # Factor in diagnosis spread (if top diagnosis is much higher, more confident)
        if len(diagnoses) > 1:
            spread = diagnoses[0]["confidence"] - diagnoses[1]["confidence"]
            spread_factor = min(spread + 0.5, 1.0)
        else:
            spread_factor = 0.7

        confidence = (top_confidence * 0.4 + avg_top3 * 0.3 +
                     symptom_factor * 0.15 + spread_factor * 0.15)

        return round(min(max(confidence, 0.2), 0.95), 2)
