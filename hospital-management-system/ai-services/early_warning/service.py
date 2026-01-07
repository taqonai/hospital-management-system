"""
Early Warning System (EWS/NEWS2+) AI Service
Enhanced clinical deterioration detection with ML-powered predictions,
sepsis early detection (qSOFA), and fall risk assessment

Uses GPT-4o-mini for clinical explanations with rule-based safety validation.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import numpy as np
from dataclasses import dataclass, asdict
import logging
import random
import json

# Import shared OpenAI client
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.openai_client import openai_manager, TaskComplexity

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ConsciousnessLevel(Enum):
    ALERT = "alert"
    VOICE = "voice"       # Responds to voice
    PAIN = "pain"         # Responds to pain
    UNRESPONSIVE = "unresponsive"


@dataclass
class NEWS2Score:
    """NEWS2 Score breakdown"""
    total_score: int
    respiration_rate_score: int
    spo2_score: int
    supplemental_oxygen_score: int
    temperature_score: int
    systolic_bp_score: int
    heart_rate_score: int
    consciousness_score: int
    risk_level: str
    clinical_response: str


@dataclass
class VitalTrend:
    """Vital sign trend analysis"""
    parameter: str
    direction: str  # 'improving', 'stable', 'worsening'
    rate_of_change: float
    values: List[float]
    timestamps: List[str]


@dataclass
class qSOFAScore:
    """qSOFA Score for sepsis screening"""
    total_score: int
    respiratory_rate_score: int  # RR >= 22
    altered_mentation_score: int  # GCS < 15 / not alert
    systolic_bp_score: int  # SBP <= 100
    sepsis_risk: str
    recommendation: str


@dataclass
class FallRiskScore:
    """Fall Risk Assessment Score"""
    total_score: int
    risk_level: str
    factors: List[str]
    interventions: List[str]


@dataclass
class EWSResponse:
    """Comprehensive EWS Response"""
    news2_score: int
    risk_level: str
    alerts: List[Dict[str, Any]]
    deterioration_probability: float
    sepsis_risk: Dict[str, Any]
    fall_risk: Dict[str, Any]
    recommended_actions: List[str]
    escalation_required: bool
    time_to_reassessment: str
    timestamp: str
    model_version: str


class EarlyWarningAI:
    """
    Enhanced Early Warning System with NEWS2+ scoring, ML deterioration prediction,
    sepsis detection (qSOFA), and fall risk assessment.

    Uses GPT-4o-mini for clinical explanations with validated rule-based scoring.
    """

    def __init__(self):
        self.model_version = "2.0.0-ews-ml"
        ai_status = "with AI explanations" if openai_manager.is_available() else "rule-based only"
        logger.info(f"EarlyWarningAI initialized {ai_status}")

    @staticmethod
    def is_available() -> bool:
        """Check if OpenAI API is available for AI explanations"""
        return openai_manager.is_available()

    def _ai_explain_news2(
        self,
        news2_result: Dict[str, Any],
        vitals: Dict[str, Any],
        patient_context: Dict[str, Any] = None
    ) -> Optional[str]:
        """
        Generate clinical explanation for NEWS2 score using GPT-4o-mini.

        Returns natural language explanation for healthcare providers.
        """
        if not openai_manager.is_available():
            return None

        # Build context
        patient_info = ""
        if patient_context:
            age = patient_context.get("age")
            conditions = patient_context.get("conditions", patient_context.get("chronicConditions", []))
            if age:
                patient_info += f"Patient age: {age} years. "
            if conditions:
                patient_info += f"Medical history: {', '.join(conditions[:5])}. "

        system_prompt = """You are an expert clinical decision support AI for healthcare providers.
Generate a concise clinical interpretation of NEWS2 (National Early Warning Score 2) results.

Provide:
1. A brief summary of clinical significance (1-2 sentences)
2. Key physiological concerns based on abnormal parameters
3. Immediate clinical priorities

Keep response under 150 words. Be clinical and professional. This is for healthcare providers, not patients."""

        user_content = f"""NEWS2 Assessment Results:
- Total Score: {news2_result.get('totalScore')}/20
- Risk Level: {news2_result.get('riskLevel')}
- Clinical Response: {news2_result.get('clinicalResponse')}
- Contributing factors: {', '.join(news2_result.get('components', []))}

Current Vitals:
- RR: {vitals.get('respiratoryRate', 'N/A')}/min
- SpO2: {vitals.get('oxygenSaturation', 'N/A')}%
- BP: {vitals.get('systolicBP', 'N/A')}/{vitals.get('diastolicBP', 'N/A')} mmHg
- HR: {vitals.get('heartRate', 'N/A')} bpm
- Temp: {vitals.get('temperature', 'N/A')}°C
- Consciousness: {vitals.get('consciousness', 'alert')}
- Supplemental O2: {'Yes' if vitals.get('supplementalOxygen') else 'No'}

{patient_info}

Provide clinical interpretation:"""

        try:
            result = openai_manager.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                task_complexity=TaskComplexity.SIMPLE,  # gpt-4o-mini for explanations
                temperature=0.3,
                max_tokens=300
            )

            if result and result.get("success"):
                logger.info("AI NEWS2 explanation generated successfully")
                return result.get("content")
            return None

        except Exception as e:
            logger.error(f"AI NEWS2 explanation error: {e}")
            return None

    def _ai_explain_sepsis_risk(
        self,
        qsofa_result: Dict[str, Any],
        vitals: Dict[str, Any]
    ) -> Optional[str]:
        """Generate clinical explanation for qSOFA/sepsis risk"""
        if not openai_manager.is_available():
            return None

        system_prompt = """You are an expert clinical decision support AI. Explain qSOFA sepsis screening results.
Keep response under 100 words. Focus on clinical significance and next steps for healthcare providers."""

        user_content = f"""qSOFA Results:
- Score: {qsofa_result.get('qsofaScore')}/3
- Sepsis Risk: {qsofa_result.get('sepsisRisk')}
- Components: {', '.join(qsofa_result.get('components', []))}
- Additional indicators: {', '.join(qsofa_result.get('additionalIndicators', []))}

Current vitals: RR {vitals.get('respiratoryRate')}, SBP {vitals.get('systolicBP')}, consciousness {vitals.get('consciousness')}

Provide clinical interpretation:"""

        try:
            result = openai_manager.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                task_complexity=TaskComplexity.SIMPLE,
                temperature=0.3,
                max_tokens=200
            )

            if result and result.get("success"):
                return result.get("content")
            return None

        except Exception as e:
            logger.error(f"AI sepsis explanation error: {e}")
            return None

    def _ai_explain_deterioration(
        self,
        deterioration_result: Dict[str, Any],
        patient_context: Dict[str, Any] = None
    ) -> Optional[str]:
        """Generate clinical explanation for deterioration prediction"""
        if not openai_manager.is_available():
            return None

        patient_info = ""
        if patient_context:
            age = patient_context.get("age")
            conditions = patient_context.get("chronicConditions", [])
            if age:
                patient_info += f"Age: {age}. "
            if conditions:
                patient_info += f"Comorbidities: {', '.join(conditions[:3])}."

        system_prompt = """You are an expert clinical decision support AI. Explain clinical deterioration risk assessment.
Provide actionable clinical guidance in under 100 words."""

        user_content = f"""Deterioration Assessment:
- Probability: {deterioration_result.get('deteriorationProbability', 0) * 100:.1f}%
- Risk Level: {deterioration_result.get('riskLevel')}
- Prediction Window: {deterioration_result.get('predictionWindow')}
- Risk Factors: {', '.join([rf.get('factor', '') for rf in deterioration_result.get('riskFactors', [])])}
- NEWS2 Score: {deterioration_result.get('news2Score')}
{patient_info}

Explain clinical significance:"""

        try:
            result = openai_manager.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                task_complexity=TaskComplexity.SIMPLE,
                temperature=0.3,
                max_tokens=200
            )

            if result and result.get("success"):
                return result.get("content")
            return None

        except Exception as e:
            logger.error(f"AI deterioration explanation error: {e}")
            return None

    # ============== NEWS2 Calculation ==============

    def calculate_news2(self, vitals: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate NEWS2 score from vital signs

        Parameters:
        - respiratoryRate: breaths per minute (8-25+ range)
        - oxygenSaturation: SpO2 percentage (<=91 to >=96)
        - supplementalOxygen: boolean - on oxygen therapy
        - temperature: degrees Celsius (<=35.0 to >=39.1)
        - systolicBP: mmHg (<=90 to >=220)
        - diastolicBP: mmHg
        - heartRate: beats per minute (<=40 to >=131)
        - consciousness: 'alert', 'voice', 'pain', 'unresponsive' (AVPU)
        """
        scores = {}
        components = []

        # Respiration Rate (breaths/min)
        rr = vitals.get("respiratoryRate", 16)
        if rr <= 8:
            scores["respiratoryRate"] = 3
            components.append(f"Respiratory rate critically low ({rr}/min): +3")
        elif rr <= 11:
            scores["respiratoryRate"] = 1
            components.append(f"Respiratory rate low ({rr}/min): +1")
        elif rr <= 20:
            scores["respiratoryRate"] = 0
        elif rr <= 24:
            scores["respiratoryRate"] = 2
            components.append(f"Respiratory rate elevated ({rr}/min): +2")
        else:
            scores["respiratoryRate"] = 3
            components.append(f"Respiratory rate critically high ({rr}/min): +3")

        # Oxygen Saturation (SpO2 Scale 1)
        spo2 = vitals.get("oxygenSaturation", 98)
        is_hypercapnic = vitals.get("isHypercapnic", False)  # Scale 2 for COPD patients

        if is_hypercapnic:
            # Scale 2 for hypercapnic respiratory failure
            if spo2 <= 83:
                scores["oxygenSaturation"] = 3
                components.append(f"SpO2 critically low - Scale 2 ({spo2}%): +3")
            elif spo2 <= 85:
                scores["oxygenSaturation"] = 2
                components.append(f"SpO2 low - Scale 2 ({spo2}%): +2")
            elif spo2 <= 87:
                scores["oxygenSaturation"] = 1
                components.append(f"SpO2 slightly low - Scale 2 ({spo2}%): +1")
            elif spo2 <= 92:
                scores["oxygenSaturation"] = 0
            elif spo2 <= 94:
                scores["oxygenSaturation"] = 1
                components.append(f"SpO2 elevated - Scale 2 ({spo2}%): +1")
            elif spo2 <= 96:
                scores["oxygenSaturation"] = 2
                components.append(f"SpO2 high - Scale 2 ({spo2}%): +2")
            else:
                scores["oxygenSaturation"] = 3
                components.append(f"SpO2 too high - Scale 2 ({spo2}%): +3")
        else:
            # Scale 1 (standard)
            if spo2 <= 91:
                scores["oxygenSaturation"] = 3
                components.append(f"SpO2 critically low ({spo2}%): +3")
            elif spo2 <= 93:
                scores["oxygenSaturation"] = 2
                components.append(f"SpO2 low ({spo2}%): +2")
            elif spo2 <= 95:
                scores["oxygenSaturation"] = 1
                components.append(f"SpO2 slightly low ({spo2}%): +1")
            else:
                scores["oxygenSaturation"] = 0

        # Supplemental Oxygen
        on_oxygen = vitals.get("supplementalOxygen", False)
        if on_oxygen:
            scores["supplementalOxygen"] = 2
            components.append("On supplemental oxygen: +2")
        else:
            scores["supplementalOxygen"] = 0

        # Temperature (Celsius)
        temp = vitals.get("temperature", 37.0)
        if temp <= 35.0:
            scores["temperature"] = 3
            components.append(f"Temperature critically low ({temp}C): +3")
        elif temp <= 36.0:
            scores["temperature"] = 1
            components.append(f"Temperature low ({temp}C): +1")
        elif temp <= 38.0:
            scores["temperature"] = 0
        elif temp <= 39.0:
            scores["temperature"] = 1
            components.append(f"Temperature elevated ({temp}C): +1")
        else:
            scores["temperature"] = 2
            components.append(f"Temperature high ({temp}C): +2")

        # Systolic Blood Pressure (mmHg)
        sbp = vitals.get("systolicBP", 120)
        if sbp <= 90:
            scores["systolicBP"] = 3
            components.append(f"Systolic BP critically low ({sbp}mmHg): +3")
        elif sbp <= 100:
            scores["systolicBP"] = 2
            components.append(f"Systolic BP low ({sbp}mmHg): +2")
        elif sbp <= 110:
            scores["systolicBP"] = 1
            components.append(f"Systolic BP slightly low ({sbp}mmHg): +1")
        elif sbp <= 219:
            scores["systolicBP"] = 0
        else:
            scores["systolicBP"] = 3
            components.append(f"Systolic BP critically high ({sbp}mmHg): +3")

        # Heart Rate (bpm)
        hr = vitals.get("heartRate", 80)
        if hr <= 40:
            scores["heartRate"] = 3
            components.append(f"Heart rate critically low ({hr}bpm): +3")
        elif hr <= 50:
            scores["heartRate"] = 1
            components.append(f"Heart rate low ({hr}bpm): +1")
        elif hr <= 90:
            scores["heartRate"] = 0
        elif hr <= 110:
            scores["heartRate"] = 1
            components.append(f"Heart rate elevated ({hr}bpm): +1")
        elif hr <= 130:
            scores["heartRate"] = 2
            components.append(f"Heart rate high ({hr}bpm): +2")
        else:
            scores["heartRate"] = 3
            components.append(f"Heart rate critically high ({hr}bpm): +3")

        # Consciousness (AVPU)
        consciousness = vitals.get("consciousness", "alert").lower()
        if consciousness == "alert":
            scores["consciousness"] = 0
        else:
            scores["consciousness"] = 3
            avpu_map = {"voice": "responds to voice", "pain": "responds to pain", "unresponsive": "unresponsive"}
            desc = avpu_map.get(consciousness, consciousness)
            components.append(f"Altered consciousness - {desc}: +3")

        # Calculate total score
        total_score = sum(scores.values())

        # Determine risk level and clinical response
        # Check for single parameter score of 3 (RED score trigger)
        has_extreme_score = any(s == 3 for s in scores.values())

        if total_score >= 7:
            risk_level = "CRITICAL"
            clinical_response = "Emergency response - continuous monitoring, immediate senior review, consider ICU"
            severity = AlertSeverity.CRITICAL
            time_to_reassessment = "Continuous"
        elif total_score >= 5 or has_extreme_score:
            risk_level = "HIGH"
            clinical_response = "Urgent response - increase monitoring to at least hourly, urgent clinical review within 30 minutes"
            severity = AlertSeverity.HIGH
            time_to_reassessment = "30 minutes"
        elif total_score >= 3:
            risk_level = "MEDIUM"
            clinical_response = "Ward-based response - increase monitoring to 4-6 hourly, inform nurse-in-charge"
            severity = AlertSeverity.MEDIUM
            time_to_reassessment = "4 hours"
        else:
            risk_level = "LOW"
            clinical_response = "Continue routine monitoring - minimum 12 hourly (or as per patient needs)"
            severity = AlertSeverity.LOW
            time_to_reassessment = "12 hours"

        return {
            "totalScore": total_score,
            "scores": scores,
            "components": components,
            "riskLevel": risk_level,
            "severity": severity.value,
            "clinicalResponse": clinical_response,
            "hasExtremeScore": has_extreme_score,
            "timeToReassessment": time_to_reassessment,
            "timestamp": datetime.now().isoformat(),
            "modelVersion": self.model_version,
        }

    # ============== qSOFA Sepsis Screening ==============

    def calculate_qsofa(self, vitals: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate qSOFA (Quick Sequential Organ Failure Assessment) score
        for early sepsis screening

        qSOFA criteria (each = 1 point):
        - Respiratory rate >= 22 breaths/min
        - Altered mentation (not alert / GCS < 15)
        - Systolic BP <= 100 mmHg

        Score >= 2: High risk of poor outcomes, further sepsis evaluation needed
        """
        scores = {}
        components = []

        # Respiratory Rate >= 22
        rr = vitals.get("respiratoryRate", 16)
        if rr >= 22:
            scores["respiratoryRate"] = 1
            components.append(f"Respiratory rate >= 22 ({rr}/min): +1")
        else:
            scores["respiratoryRate"] = 0

        # Altered mentation (not alert)
        consciousness = vitals.get("consciousness", "alert").lower()
        gcs = vitals.get("gcs", 15)
        if consciousness != "alert" or gcs < 15:
            scores["alteredMentation"] = 1
            if consciousness != "alert":
                components.append(f"Altered mental status ({consciousness}): +1")
            else:
                components.append(f"GCS < 15 (GCS: {gcs}): +1")
        else:
            scores["alteredMentation"] = 0

        # Systolic BP <= 100
        sbp = vitals.get("systolicBP", 120)
        if sbp <= 100:
            scores["systolicBP"] = 1
            components.append(f"Systolic BP <= 100 ({sbp}mmHg): +1")
        else:
            scores["systolicBP"] = 0

        total_score = sum(scores.values())

        # Determine sepsis risk
        if total_score >= 2:
            sepsis_risk = "HIGH"
            recommendation = "qSOFA >= 2: High suspicion for sepsis. Initiate Sepsis-3 evaluation, consider lactate level, blood cultures before antibiotics, and urgent physician review."
            probability = 0.7 + (total_score - 2) * 0.15
        elif total_score == 1:
            sepsis_risk = "MODERATE"
            recommendation = "qSOFA = 1: Monitor closely for signs of sepsis. Reassess vitals frequently and consider sepsis screening if clinical suspicion."
            probability = 0.35
        else:
            sepsis_risk = "LOW"
            recommendation = "qSOFA = 0: Low current sepsis risk. Continue standard monitoring and reassess if clinical condition changes."
            probability = 0.1

        # Additional sepsis indicators
        additional_indicators = []
        temp = vitals.get("temperature", 37.0)
        hr = vitals.get("heartRate", 80)

        if temp > 38.3 or temp < 36.0:
            additional_indicators.append(f"Temperature abnormality ({temp}C)")
            probability = min(probability + 0.1, 0.95)
        if hr > 90:
            additional_indicators.append(f"Tachycardia ({hr}bpm)")
            probability = min(probability + 0.05, 0.95)

        return {
            "qsofaScore": total_score,
            "scores": scores,
            "components": components,
            "sepsisRisk": sepsis_risk,
            "sepsisProbability": round(probability, 3),
            "recommendation": recommendation,
            "additionalIndicators": additional_indicators,
            "requiresSepsisWorkup": total_score >= 2,
            "timestamp": datetime.now().isoformat(),
            "modelVersion": self.model_version,
        }

    # ============== Fall Risk Assessment ==============

    def calculate_fall_risk(
        self,
        vitals: Dict[str, Any],
        patient_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Calculate fall risk using Morse Fall Scale-like assessment

        Factors assessed:
        - History of falling
        - Secondary diagnosis
        - Ambulatory aid
        - IV/heparin lock
        - Gait/transferring
        - Mental status
        - Age
        - Medications (sedatives, etc.)
        - Postural hypotension
        """
        patient_data = patient_data or {}
        score = 0
        factors = []
        interventions = []

        # History of falling (within 3 months)
        fall_history = patient_data.get("fallHistory", False)
        recent_falls = patient_data.get("recentFalls", 0)
        if fall_history or recent_falls > 0:
            score += 25
            factors.append(f"History of falling (recent falls: {recent_falls})")
            interventions.append("Implement fall precautions protocol")

        # Secondary diagnosis (multiple conditions)
        conditions = patient_data.get("conditions", patient_data.get("chronicConditions", []))
        if isinstance(conditions, list) and len(conditions) >= 2:
            score += 15
            factors.append(f"Multiple diagnoses ({len(conditions)} conditions)")
            interventions.append("Review medications for fall risk contributors")

        # Ambulatory aid
        mobility_aid = patient_data.get("mobilityAid", "none").lower()
        if mobility_aid in ["walker", "cane", "crutches"]:
            score += 15
            factors.append(f"Uses ambulatory aid ({mobility_aid})")
            interventions.append("Ensure mobility aid is within reach")
        elif mobility_aid in ["wheelchair", "bedbound"]:
            score += 0  # Not ambulatory
        elif mobility_aid == "furniture" or patient_data.get("usesFurnitureToWalk", False):
            score += 30
            factors.append("Walks holding onto furniture")
            interventions.append("Physical therapy consultation")

        # IV therapy / Heparin lock
        has_iv = patient_data.get("hasIV", False) or patient_data.get("ivTherapy", False)
        if has_iv:
            score += 20
            factors.append("IV therapy in place")
            interventions.append("Ensure IV lines are secured and not a trip hazard")

        # Gait assessment
        gait = patient_data.get("gait", "normal").lower()
        if gait in ["impaired", "weak", "unsteady"]:
            score += 20
            factors.append(f"Impaired gait ({gait})")
            interventions.append("Assist with ambulation")
        elif gait == "normal":
            score += 0
        else:
            # Assume some impairment if unclear
            score += 10
            factors.append("Gait status unclear - assume mild impairment")

        # Mental status
        consciousness = vitals.get("consciousness", "alert").lower()
        mental_status = patient_data.get("mentalStatus", "oriented").lower()
        if consciousness != "alert" or mental_status in ["confused", "disoriented", "impaired"]:
            score += 15
            factors.append(f"Altered mental status ({consciousness}/{mental_status})")
            interventions.append("Frequent orientation checks and supervision")

        # Age factor
        age = patient_data.get("age", 50)
        if age >= 85:
            score += 20
            factors.append(f"Advanced age ({age} years)")
            interventions.append("Age-appropriate fall precautions")
        elif age >= 75:
            score += 15
            factors.append(f"Elderly ({age} years)")
            interventions.append("Consider age-related fall risks")
        elif age >= 65:
            score += 10
            factors.append(f"Over 65 years ({age} years)")

        # High-risk medications
        medications = patient_data.get("medications", [])
        high_risk_meds = ["sedative", "hypnotic", "opioid", "anticonvulsant", "antihypertensive",
                         "diuretic", "benzodiazepine", "antidepressant", "antipsychotic"]
        for med in medications:
            med_lower = str(med).lower()
            for risk_med in high_risk_meds:
                if risk_med in med_lower:
                    score += 10
                    factors.append(f"High-risk medication: {med}")
                    interventions.append(f"Monitor for {med} side effects affecting balance")
                    break

        # Postural hypotension check
        sbp = vitals.get("systolicBP", 120)
        if sbp < 100:
            score += 10
            factors.append(f"Low blood pressure ({sbp}mmHg) - orthostatic risk")
            interventions.append("Assist with position changes, assess for orthostatic hypotension")

        # Determine risk level
        if score >= 51:
            risk_level = "HIGH"
            base_interventions = [
                "Implement high fall risk protocol",
                "Bed in lowest position with brakes locked",
                "Non-skid footwear required",
                "Fall risk signage/bracelet",
                "Frequent rounding (every 1-2 hours)",
                "Consider 1:1 sitter if indicated",
                "Clear path to bathroom",
                "Toileting schedule",
            ]
        elif score >= 25:
            risk_level = "MEDIUM"
            base_interventions = [
                "Implement moderate fall risk protocol",
                "Bed in low position",
                "Call bell within reach",
                "Toileting assistance offered",
                "Ensure adequate lighting",
                "Remove clutter from room",
            ]
        else:
            risk_level = "LOW"
            base_interventions = [
                "Standard fall precautions",
                "Educate patient on fall risks",
                "Ensure call bell accessible",
            ]

        # Combine interventions
        all_interventions = list(set(base_interventions + interventions))[:10]

        return {
            "fallRiskScore": score,
            "riskLevel": risk_level,
            "factors": factors[:8],
            "interventions": all_interventions,
            "requiresFallProtocol": score >= 25,
            "timestamp": datetime.now().isoformat(),
            "modelVersion": self.model_version,
        }

    # ============== Trend Analysis ==============

    def analyze_trends(self, vitals_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze vital sign trends over time
        Returns trend direction and rate of change for each parameter
        """
        if len(vitals_history) < 2:
            return {
                "hasEnoughData": False,
                "message": "Need at least 2 vital sign readings for trend analysis",
                "trends": {},
            }

        # Sort by timestamp (most recent first)
        sorted_vitals = sorted(
            vitals_history,
            key=lambda x: x.get("timestamp", x.get("recordedAt", "")),
            reverse=True
        )

        parameters = [
            "respiratoryRate", "oxygenSaturation", "temperature",
            "systolicBP", "diastolicBP", "heartRate"
        ]

        trends = {}
        overall_concern = False
        concerning_trends = []

        for param in parameters:
            values = []
            timestamps = []

            for v in sorted_vitals[:10]:  # Last 10 readings
                val = v.get(param)
                if val is not None:
                    values.append(float(val))
                    timestamps.append(v.get("timestamp", v.get("recordedAt", "")))

            if len(values) >= 2:
                # Calculate trend direction and rate
                # Positive slope = increasing, Negative slope = decreasing
                x = np.arange(len(values))
                slope, _ = np.polyfit(x, values, 1)

                # Normalize slope by parameter
                avg_val = np.mean(values)
                if avg_val != 0:
                    rate_of_change = (slope / avg_val) * 100  # Percentage change
                else:
                    rate_of_change = 0

                # Determine direction
                if abs(rate_of_change) < 2:
                    direction = "stable"
                elif rate_of_change > 0:
                    direction = "increasing"
                else:
                    direction = "decreasing"

                # Check for concerning trends
                is_concerning = False
                concern_reason = ""

                if param == "oxygenSaturation" and direction == "decreasing" and abs(rate_of_change) > 3:
                    is_concerning = True
                    concern_reason = "SpO2 declining"
                elif param == "heartRate" and direction == "increasing" and abs(rate_of_change) > 5:
                    is_concerning = True
                    concern_reason = "Heart rate rising"
                elif param == "systolicBP" and direction == "decreasing" and abs(rate_of_change) > 5:
                    is_concerning = True
                    concern_reason = "Blood pressure falling"
                elif param == "respiratoryRate" and direction == "increasing" and abs(rate_of_change) > 5:
                    is_concerning = True
                    concern_reason = "Respiratory rate increasing"
                elif param == "temperature" and direction == "increasing" and values[0] > 38.0:
                    is_concerning = True
                    concern_reason = "Temperature rising"

                if is_concerning:
                    overall_concern = True
                    concerning_trends.append(concern_reason)

                trends[param] = {
                    "direction": direction,
                    "rateOfChange": round(rate_of_change, 2),
                    "currentValue": values[0] if values else None,
                    "previousValue": values[1] if len(values) > 1 else None,
                    "min": min(values),
                    "max": max(values),
                    "mean": round(np.mean(values), 2),
                    "isConcerning": is_concerning,
                    "concernReason": concern_reason if is_concerning else None,
                    "dataPoints": len(values),
                }

        return {
            "hasEnoughData": True,
            "trends": trends,
            "overallConcern": overall_concern,
            "concerningTrends": concerning_trends,
            "analysisTime": datetime.now().isoformat(),
            "dataPointsAnalyzed": len(sorted_vitals[:10]),
        }

    # ============== ML Deterioration Prediction ==============

    def predict_deterioration(
        self,
        vitals: Dict[str, Any],
        vitals_history: List[Dict[str, Any]] = None,
        patient_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        ML-powered deterioration prediction combining NEWS2 with trend analysis
        and patient-specific risk factors
        """
        # Calculate current NEWS2
        news2_result = self.calculate_news2(vitals)

        # Base risk from NEWS2
        news2_score = news2_result["totalScore"]
        base_risk = min(news2_score / 15, 1.0)  # Normalize to 0-1

        risk_factors = []
        ml_adjustment = 0.0

        # Trend analysis if history available
        trend_concern = False
        if vitals_history and len(vitals_history) >= 2:
            trend_analysis = self.analyze_trends(vitals_history)
            if trend_analysis.get("overallConcern"):
                trend_concern = True
                ml_adjustment += 0.15
                for concern in trend_analysis.get("concerningTrends", []):
                    risk_factors.append({
                        "factor": f"Worsening trend: {concern}",
                        "impact": "high",
                        "contribution": 0.15
                    })

        # Patient-specific factors
        if patient_data:
            age = patient_data.get("age", 50)
            if age >= 85:
                ml_adjustment += 0.10
                risk_factors.append({
                    "factor": f"Advanced age ({age} years)",
                    "impact": "high",
                    "contribution": 0.10
                })
            elif age >= 75:
                ml_adjustment += 0.05
                risk_factors.append({
                    "factor": f"Elderly patient ({age} years)",
                    "impact": "moderate",
                    "contribution": 0.05
                })

            # Comorbidities
            conditions = patient_data.get("chronicConditions", patient_data.get("conditions", []))
            high_risk_conditions = ["heart failure", "copd", "ckd", "cancer", "diabetes", "sepsis"]

            for condition in conditions:
                condition_lower = str(condition).lower()
                for hrc in high_risk_conditions:
                    if hrc in condition_lower:
                        ml_adjustment += 0.05
                        risk_factors.append({
                            "factor": f"Comorbidity: {condition}",
                            "impact": "moderate",
                            "contribution": 0.05
                        })
                        break

            # Recent deterioration events
            if patient_data.get("recentRapidResponse", False):
                ml_adjustment += 0.15
                risk_factors.append({
                    "factor": "Recent rapid response activation",
                    "impact": "high",
                    "contribution": 0.15
                })

            if patient_data.get("recentICUTransfer", False):
                ml_adjustment += 0.12
                risk_factors.append({
                    "factor": "Recent ICU transfer",
                    "impact": "high",
                    "contribution": 0.12
                })

        # Calculate final risk
        final_risk = min(base_risk + ml_adjustment, 0.95)

        # Determine prediction
        if final_risk >= 0.7 or news2_score >= 7:
            prediction_level = "CRITICAL"
            prediction_text = "High probability of clinical deterioration within 24 hours"
            time_window = "0-6 hours"
        elif final_risk >= 0.5 or news2_score >= 5:
            prediction_level = "HIGH"
            prediction_text = "Elevated risk of deterioration - close monitoring required"
            time_window = "6-12 hours"
        elif final_risk >= 0.3 or news2_score >= 3:
            prediction_level = "MEDIUM"
            prediction_text = "Moderate risk - increased vigilance recommended"
            time_window = "12-24 hours"
        else:
            prediction_level = "LOW"
            prediction_text = "Low current risk - maintain standard monitoring"
            time_window = ">24 hours"

        return {
            "deteriorationProbability": round(final_risk, 3),
            "riskLevel": prediction_level,
            "prediction": prediction_text,
            "predictionWindow": time_window,
            "news2Score": news2_score,
            "news2Details": news2_result,
            "riskFactors": risk_factors[:8],
            "trendConcern": trend_concern,
            "recommendations": self._get_recommendations(prediction_level, news2_result),
            "escalationPathway": self._get_escalation_pathway(prediction_level),
            "modelVersion": self.model_version,
            "timestamp": datetime.now().isoformat(),
        }

    # ============== Comprehensive Assessment ==============

    def comprehensive_assessment(
        self,
        vitals: Dict[str, Any],
        vitals_history: List[Dict[str, Any]] = None,
        patient_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive early warning assessment combining:
        - NEWS2 scoring
        - Deterioration prediction
        - Sepsis screening (qSOFA)
        - Fall risk assessment
        - AI-generated clinical explanations (when available)

        Returns the structured response format required by the frontend
        """
        patient_data = patient_data or {}
        vitals_history = vitals_history or []

        # Calculate all components (validated rule-based algorithms)
        news2_result = self.calculate_news2(vitals)
        qsofa_result = self.calculate_qsofa(vitals)
        fall_risk_result = self.calculate_fall_risk(vitals, patient_data)
        deterioration_result = self.predict_deterioration(vitals, vitals_history, patient_data)

        # Generate AI explanations if available
        ai_explanations = {}
        if self.is_available():
            try:
                # Generate explanations for significant scores
                if news2_result.get("totalScore", 0) >= 3:
                    news2_explanation = self._ai_explain_news2(news2_result, vitals, patient_data)
                    if news2_explanation:
                        ai_explanations["news2"] = news2_explanation

                if qsofa_result.get("qsofaScore", 0) >= 1:
                    sepsis_explanation = self._ai_explain_sepsis_risk(qsofa_result, vitals)
                    if sepsis_explanation:
                        ai_explanations["sepsis"] = sepsis_explanation

                if deterioration_result.get("deteriorationProbability", 0) >= 0.3:
                    deterioration_explanation = self._ai_explain_deterioration(deterioration_result, patient_data)
                    if deterioration_explanation:
                        ai_explanations["deterioration"] = deterioration_explanation

            except Exception as e:
                logger.warning(f"AI explanation generation failed: {e}")

        # Generate alerts based on all assessments
        alerts = []

        # NEWS2 based alerts
        if news2_result["totalScore"] >= 3:
            alerts.append({
                "type": "NEWS2",
                "severity": news2_result["severity"],
                "message": f"NEWS2 Score: {news2_result['totalScore']} - {news2_result['riskLevel']} Risk",
                "action": news2_result["clinicalResponse"],
                "timestamp": datetime.now().isoformat()
            })

        # Sepsis alerts
        if qsofa_result["qsofaScore"] >= 2:
            alerts.append({
                "type": "SEPSIS",
                "severity": "critical" if qsofa_result["qsofaScore"] >= 2 else "high",
                "message": f"qSOFA Score: {qsofa_result['qsofaScore']} - Sepsis Risk: {qsofa_result['sepsisRisk']}",
                "action": qsofa_result["recommendation"],
                "timestamp": datetime.now().isoformat()
            })

        # Fall risk alerts
        if fall_risk_result["riskLevel"] in ["HIGH", "MEDIUM"]:
            alerts.append({
                "type": "FALL_RISK",
                "severity": "high" if fall_risk_result["riskLevel"] == "HIGH" else "medium",
                "message": f"Fall Risk: {fall_risk_result['riskLevel']} (Score: {fall_risk_result['fallRiskScore']})",
                "action": "Implement fall precautions protocol",
                "timestamp": datetime.now().isoformat()
            })

        # Determine overall escalation requirement
        escalation_required = (
            news2_result["totalScore"] >= 5 or
            qsofa_result["qsofaScore"] >= 2 or
            news2_result.get("hasExtremeScore", False)
        )

        # Compile recommended actions
        recommended_actions = []
        recommended_actions.extend(deterioration_result.get("recommendations", [])[:3])
        if qsofa_result["qsofaScore"] >= 1:
            recommended_actions.append(qsofa_result["recommendation"])
        recommended_actions.extend(fall_risk_result.get("interventions", [])[:2])

        # Remove duplicates while preserving order
        seen = set()
        unique_actions = []
        for action in recommended_actions:
            if action not in seen:
                seen.add(action)
                unique_actions.append(action)

        return {
            "news2Score": news2_result["totalScore"],
            "riskLevel": news2_result["riskLevel"],
            "alerts": alerts,
            "deteriorationProbability": deterioration_result["deteriorationProbability"],
            "sepsisRisk": {
                "qsofaScore": qsofa_result["qsofaScore"],
                "riskLevel": qsofa_result["sepsisRisk"],
                "probability": qsofa_result["sepsisProbability"],
                "requiresWorkup": qsofa_result["requiresSepsisWorkup"],
                "components": qsofa_result["components"],
                "additionalIndicators": qsofa_result["additionalIndicators"]
            },
            "fallRisk": {
                "score": fall_risk_result["fallRiskScore"],
                "riskLevel": fall_risk_result["riskLevel"],
                "factors": fall_risk_result["factors"],
                "interventions": fall_risk_result["interventions"]
            },
            "recommendedActions": unique_actions[:8],
            "escalationRequired": escalation_required,
            "timeToReassessment": news2_result["timeToReassessment"],
            "vitalSigns": {
                "respiratoryRate": vitals.get("respiratoryRate"),
                "oxygenSaturation": vitals.get("oxygenSaturation"),
                "supplementalOxygen": vitals.get("supplementalOxygen", False),
                "temperature": vitals.get("temperature"),
                "systolicBP": vitals.get("systolicBP"),
                "diastolicBP": vitals.get("diastolicBP"),
                "heartRate": vitals.get("heartRate"),
                "consciousness": vitals.get("consciousness", "alert")
            },
            "scores": {
                "news2": news2_result,
                "qsofa": qsofa_result,
                "fallRisk": fall_risk_result
            },
            "escalationPathway": self._get_escalation_pathway(news2_result["riskLevel"]),
            "aiExplanations": ai_explanations if ai_explanations else None,
            "aiPowered": len(ai_explanations) > 0,
            "timestamp": datetime.now().isoformat(),
            "modelVersion": self.model_version
        }

    # ============== Monitoring Functions ==============

    def monitor_vitals(
        self,
        patient_id: str,
        vitals: Dict[str, Any],
        vitals_history: List[Dict[str, Any]] = None,
        patient_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Real-time vital sign monitoring endpoint
        Returns assessment with alert generation
        """
        assessment = self.comprehensive_assessment(vitals, vitals_history, patient_data)

        return {
            "patientId": patient_id,
            "assessment": assessment,
            "alertsGenerated": len(assessment["alerts"]),
            "requiresImmediateAction": assessment["escalationRequired"],
            "timestamp": datetime.now().isoformat()
        }

    # ============== Helper Functions ==============

    def _get_recommendations(self, risk_level: str, news2_result: Dict[str, Any]) -> List[str]:
        """Get clinical recommendations based on risk level"""

        recommendations = {
            "CRITICAL": [
                "Activate emergency/rapid response team immediately",
                "Continuous vital sign monitoring",
                "Notify senior physician/attending immediately",
                "Prepare for possible ICU transfer",
                "Establish IV access if not present",
                "Consider arterial blood gas analysis",
                "Document all interventions and responses",
                "Prepare emergency medications",
            ],
            "HIGH": [
                "Increase monitoring frequency to at least hourly",
                "Urgent clinical review within 30 minutes",
                "Notify nurse-in-charge and primary physician",
                "Review current treatment plan",
                "Consider additional investigations (labs, imaging)",
                "Ensure IV access is functional",
                "Prepare for potential escalation",
            ],
            "MEDIUM": [
                "Increase monitoring to 4-6 hourly",
                "Inform nurse-in-charge of NEWS2 score",
                "Clinical review within 4 hours",
                "Review and address contributing factors",
                "Document trend observations",
                "Consider whether current treatment is adequate",
            ],
            "LOW": [
                "Continue routine monitoring (minimum 12 hourly)",
                "Reassess if clinical condition changes",
                "Document current stable status",
                "Patient education on warning signs",
            ],
        }

        base_recommendations = recommendations.get(risk_level, recommendations["LOW"])

        # Add specific recommendations based on NEWS2 components
        scores = news2_result.get("scores", {})

        specific_recommendations = []
        if scores.get("oxygenSaturation", 0) >= 2:
            specific_recommendations.append("Consider supplemental oxygen therapy or increase FiO2")
        if scores.get("respiratoryRate", 0) >= 2:
            specific_recommendations.append("Assess respiratory pattern and consider chest assessment")
        if scores.get("systolicBP", 0) >= 2:
            specific_recommendations.append("Review fluid status and consider hemodynamic support")
        if scores.get("heartRate", 0) >= 2:
            specific_recommendations.append("ECG monitoring and review for arrhythmias")
        if scores.get("temperature", 0) >= 2:
            specific_recommendations.append("Consider sepsis screening and blood cultures if febrile")
        if scores.get("consciousness", 0) >= 3:
            specific_recommendations.append("Neurological assessment and consider brain imaging")

        return (base_recommendations + specific_recommendations)[:10]

    def _get_escalation_pathway(self, risk_level: str) -> Dict[str, Any]:
        """Get escalation pathway based on risk level"""

        pathways = {
            "CRITICAL": {
                "immediate": [
                    "Activate Code Blue/Rapid Response Team",
                    "Notify ICU for potential transfer",
                    "Inform attending physician STAT",
                ],
                "within15min": [
                    "Senior physician at bedside",
                    "ICU consultation completed",
                    "Family notification if appropriate",
                ],
                "within1hour": [
                    "Patient either stabilized or transferred to higher level of care",
                    "All interventions documented",
                    "Debrief completed",
                ],
                "escalationLevel": "Immediate - Code Team/Rapid Response",
            },
            "HIGH": {
                "immediate": [
                    "Notify nurse-in-charge",
                    "Page primary physician",
                ],
                "within30min": [
                    "Physician at bedside for assessment",
                    "Treatment plan reviewed and modified",
                ],
                "within1hour": [
                    "Reassess vital signs",
                    "Document response to interventions",
                    "Consider further escalation if no improvement",
                ],
                "escalationLevel": "Urgent - Physician Review Required",
            },
            "MEDIUM": {
                "immediate": [
                    "Increase monitoring frequency",
                    "Document current status",
                ],
                "within4hours": [
                    "Clinical review by nurse or junior doctor",
                    "Address any modifiable factors",
                ],
                "within12hours": [
                    "Reassess and recalculate NEWS2",
                    "Adjust care plan if needed",
                ],
                "escalationLevel": "Ward-based - Enhanced Monitoring",
            },
            "LOW": {
                "routine": [
                    "Continue standard monitoring schedule",
                    "Reassess at next scheduled observation",
                ],
                "escalationLevel": "None - Routine Care",
            },
        }

        return pathways.get(risk_level, pathways["LOW"])

    # ============== Alert Management ==============

    def generate_alert(
        self,
        patient_id: str,
        patient_name: str,
        ward: str,
        bed: str,
        news2_result: Dict[str, Any],
        prediction_result: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Generate an alert based on NEWS2 score and prediction"""

        risk_level = news2_result.get("riskLevel", "LOW")
        total_score = news2_result.get("totalScore", 0)

        # Determine if alert should be generated
        should_alert = total_score >= 3 or news2_result.get("hasExtremeScore", False)

        if not should_alert:
            return {
                "generated": False,
                "reason": "NEWS2 score below alert threshold",
            }

        severity_map = {
            "LOW": AlertSeverity.LOW,
            "MEDIUM": AlertSeverity.MEDIUM,
            "HIGH": AlertSeverity.HIGH,
            "CRITICAL": AlertSeverity.CRITICAL,
        }

        severity = severity_map.get(risk_level, AlertSeverity.LOW)

        # Generate alert title
        titles = {
            AlertSeverity.LOW: f"NEWS2 Alert - Low Risk (Score: {total_score})",
            AlertSeverity.MEDIUM: f"NEWS2 Alert - Medium Risk (Score: {total_score})",
            AlertSeverity.HIGH: f"URGENT: NEWS2 Alert - High Risk (Score: {total_score})",
            AlertSeverity.CRITICAL: f"CRITICAL: NEWS2 Alert - Immediate Action Required (Score: {total_score})",
        }

        alert = {
            "id": f"ews-{patient_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "generated": True,
            "patientId": patient_id,
            "patientName": patient_name,
            "ward": ward,
            "bed": bed,
            "severity": severity.value,
            "title": titles[severity],
            "news2Score": total_score,
            "riskLevel": risk_level,
            "scoreBreakdown": news2_result.get("scores", {}),
            "components": news2_result.get("components", []),
            "clinicalResponse": news2_result.get("clinicalResponse", ""),
            "hasExtremeScore": news2_result.get("hasExtremeScore", False),
            "recommendations": self._get_recommendations(risk_level, news2_result)[:5],
            "escalationPathway": self._get_escalation_pathway(risk_level),
            "timestamp": datetime.now().isoformat(),
            "status": "active",
            "acknowledgedBy": None,
            "acknowledgedAt": None,
            "resolvedAt": None,
        }

        if prediction_result:
            alert["predictionRisk"] = prediction_result.get("deteriorationProbability")
            alert["predictionLevel"] = prediction_result.get("riskLevel")
            alert["predictionWindow"] = prediction_result.get("predictionWindow")

        return alert

    def get_ward_overview(self, patients: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate ward-level overview of all patients' EWS status
        """
        overview = {
            "totalPatients": len(patients),
            "byRiskLevel": {
                "CRITICAL": [],
                "HIGH": [],
                "MEDIUM": [],
                "LOW": [],
            },
            "stats": {
                "criticalCount": 0,
                "highCount": 0,
                "mediumCount": 0,
                "lowCount": 0,
                "vitalsOverdueCount": 0,
                "worseningCount": 0,
                "sepsisRiskCount": 0,
                "highFallRiskCount": 0,
            },
            "activeAlerts": [],
            "timestamp": datetime.now().isoformat(),
        }

        for patient in patients:
            vitals = patient.get("latestVitals", {})
            patient_id = patient.get("id", "unknown")
            patient_name = patient.get("name", "Unknown")
            ward = patient.get("ward", "Unknown")
            bed = patient.get("bed", "N/A")
            patient_data = patient.get("patientData", {})

            # Calculate comprehensive assessment
            if vitals:
                assessment = self.comprehensive_assessment(vitals, patient.get("vitalsHistory"), patient_data)
                risk_level = assessment.get("riskLevel", "LOW")

                patient_summary = {
                    "patientId": patient_id,
                    "patientName": patient_name,
                    "ward": ward,
                    "bed": bed,
                    "news2Score": assessment.get("news2Score", 0),
                    "riskLevel": risk_level,
                    "lastVitalsTime": vitals.get("timestamp", vitals.get("recordedAt")),
                    "trend": patient.get("trend", "stable"),
                    "sepsisRisk": assessment.get("sepsisRisk", {}).get("riskLevel", "LOW"),
                    "fallRisk": assessment.get("fallRisk", {}).get("riskLevel", "LOW"),
                    "deteriorationProbability": assessment.get("deteriorationProbability", 0),
                    "escalationRequired": assessment.get("escalationRequired", False),
                }

                overview["byRiskLevel"][risk_level].append(patient_summary)
                overview["stats"][f"{risk_level.lower()}Count"] += 1

                # Track sepsis risk
                if assessment.get("sepsisRisk", {}).get("qsofaScore", 0) >= 2:
                    overview["stats"]["sepsisRiskCount"] += 1

                # Track high fall risk
                if assessment.get("fallRisk", {}).get("riskLevel") == "HIGH":
                    overview["stats"]["highFallRiskCount"] += 1

                # Check for alerts
                for alert in assessment.get("alerts", []):
                    alert_with_patient = {
                        **alert,
                        "patientId": patient_id,
                        "patientName": patient_name,
                        "ward": ward,
                        "bed": bed,
                    }
                    overview["activeAlerts"].append(alert_with_patient)

            # Check for overdue vitals
            last_vitals_time = patient.get("lastVitalsTime")
            if last_vitals_time:
                try:
                    last_time = datetime.fromisoformat(last_vitals_time.replace('Z', '+00:00'))
                    if datetime.now(last_time.tzinfo) - last_time > timedelta(hours=4):
                        overview["stats"]["vitalsOverdueCount"] += 1
                except:
                    pass

            # Check for worsening trends
            if patient.get("trend") == "worsening":
                overview["stats"]["worseningCount"] += 1

        # Sort alerts by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        overview["activeAlerts"].sort(
            key=lambda x: (severity_order.get(x.get("severity"), 4), -x.get("news2Score", x.get("qsofaScore", 0)))
        )

        return overview

    def acknowledge_alert(
        self,
        alert_id: str,
        acknowledged_by: str,
        notes: str = None
    ) -> Dict[str, Any]:
        """Acknowledge an alert"""
        return {
            "alertId": alert_id,
            "status": "acknowledged",
            "acknowledgedBy": acknowledged_by,
            "acknowledgedAt": datetime.now().isoformat(),
            "notes": notes,
        }

    def resolve_alert(
        self,
        alert_id: str,
        resolved_by: str,
        resolution_notes: str = None,
        outcome: str = "stabilized"
    ) -> Dict[str, Any]:
        """Resolve an alert"""
        return {
            "alertId": alert_id,
            "status": "resolved",
            "resolvedBy": resolved_by,
            "resolvedAt": datetime.now().isoformat(),
            "resolutionNotes": resolution_notes,
            "outcome": outcome,  # stabilized, escalated, transferred, etc.
        }


# Create singleton instance
ews_ai = EarlyWarningAI()


# Standalone FastAPI app for the Early Warning service
if __name__ == "__main__":
    import uvicorn
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from typing import List, Optional

    app = FastAPI(
        title="HMS Early Warning System",
        description="NEWS2+ Early Warning System with ML-powered deterioration prediction, sepsis detection, and fall risk assessment",
        version="2.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    ews_service = EarlyWarningAI()

    # Request Models
    class VitalsInput(BaseModel):
        respiratoryRate: Optional[float] = 16
        oxygenSaturation: Optional[float] = 98
        supplementalOxygen: Optional[bool] = False
        isHypercapnic: Optional[bool] = False
        temperature: Optional[float] = 37.0
        systolicBP: Optional[float] = 120
        diastolicBP: Optional[float] = 80
        heartRate: Optional[float] = 80
        consciousness: Optional[str] = "alert"
        gcs: Optional[int] = 15

    class PatientDataInput(BaseModel):
        age: Optional[int] = 50
        conditions: Optional[List[str]] = []
        chronicConditions: Optional[List[str]] = []
        medications: Optional[List[str]] = []
        fallHistory: Optional[bool] = False
        recentFalls: Optional[int] = 0
        mobilityAid: Optional[str] = "none"
        hasIV: Optional[bool] = False
        gait: Optional[str] = "normal"
        mentalStatus: Optional[str] = "oriented"
        recentRapidResponse: Optional[bool] = False
        recentICUTransfer: Optional[bool] = False

    class CalculateNEWS2Request(BaseModel):
        vitals: VitalsInput

    class CalculateQSOFARequest(BaseModel):
        vitals: VitalsInput

    class CalculateFallRiskRequest(BaseModel):
        vitals: VitalsInput
        patientData: Optional[PatientDataInput] = None

    class TrendAnalysisRequest(BaseModel):
        vitalsHistory: List[Dict[str, Any]]

    class DeteriorationPredictionRequest(BaseModel):
        vitals: VitalsInput
        vitalsHistory: Optional[List[Dict[str, Any]]] = None
        patientData: Optional[PatientDataInput] = None

    class ComprehensiveAssessmentRequest(BaseModel):
        vitals: VitalsInput
        vitalsHistory: Optional[List[Dict[str, Any]]] = None
        patientData: Optional[PatientDataInput] = None

    class MonitorVitalsRequest(BaseModel):
        patientId: str
        vitals: VitalsInput
        vitalsHistory: Optional[List[Dict[str, Any]]] = None
        patientData: Optional[PatientDataInput] = None

    class GenerateAlertRequest(BaseModel):
        patientId: str
        patientName: str
        ward: str
        bed: str
        vitals: VitalsInput

    class WardOverviewRequest(BaseModel):
        patients: List[Dict[str, Any]]

    class AcknowledgeAlertRequest(BaseModel):
        alertId: str
        acknowledgedBy: str
        notes: Optional[str] = None

    # Endpoints
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "service": "early-warning",
            "version": "2.0.0",
            "features": ["news2", "qsofa", "fall_risk", "deterioration_prediction", "ai_explanations"],
            "aiAvailable": openai_manager.is_available(),
            "model": "gpt-4o-mini (clinical explanations)" if openai_manager.is_available() else "rule-based only"
        }

    @app.post("/api/ews/calculate")
    async def calculate_news2(request: CalculateNEWS2Request):
        """Calculate NEWS2 score from vitals"""
        try:
            result = ews_service.calculate_news2(request.vitals.model_dump())
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/qsofa")
    async def calculate_qsofa(request: CalculateQSOFARequest):
        """Calculate qSOFA score for sepsis screening"""
        try:
            result = ews_service.calculate_qsofa(request.vitals.model_dump())
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/fall-risk")
    async def calculate_fall_risk(request: CalculateFallRiskRequest):
        """Calculate fall risk score"""
        try:
            patient_data = request.patientData.model_dump() if request.patientData else {}
            result = ews_service.calculate_fall_risk(request.vitals.model_dump(), patient_data)
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/trends")
    async def analyze_trends(request: TrendAnalysisRequest):
        """Analyze vital sign trends"""
        try:
            result = ews_service.analyze_trends(request.vitalsHistory)
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/predict")
    async def predict_deterioration(request: DeteriorationPredictionRequest):
        """Predict patient deterioration"""
        try:
            patient_data = request.patientData.model_dump() if request.patientData else None
            result = ews_service.predict_deterioration(
                vitals=request.vitals.model_dump(),
                vitals_history=request.vitalsHistory,
                patient_data=patient_data
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/assess")
    async def comprehensive_assessment(request: ComprehensiveAssessmentRequest):
        """Comprehensive EWS assessment including NEWS2, qSOFA, and fall risk"""
        try:
            patient_data = request.patientData.model_dump() if request.patientData else None
            result = ews_service.comprehensive_assessment(
                vitals=request.vitals.model_dump(),
                vitals_history=request.vitalsHistory,
                patient_data=patient_data
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/monitor")
    async def monitor_vitals(request: MonitorVitalsRequest):
        """Real-time vital sign monitoring"""
        try:
            patient_data = request.patientData.model_dump() if request.patientData else None
            result = ews_service.monitor_vitals(
                patient_id=request.patientId,
                vitals=request.vitals.model_dump(),
                vitals_history=request.vitalsHistory,
                patient_data=patient_data
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/alert")
    async def generate_alert(request: GenerateAlertRequest):
        """Generate alert based on vitals"""
        try:
            news2_result = ews_service.calculate_news2(request.vitals.model_dump())
            result = ews_service.generate_alert(
                patient_id=request.patientId,
                patient_name=request.patientName,
                ward=request.ward,
                bed=request.bed,
                news2_result=news2_result
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/ward-overview")
    async def get_ward_overview(request: WardOverviewRequest):
        """Get ward-level EWS overview"""
        try:
            result = ews_service.get_ward_overview(request.patients)
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/ews/acknowledge")
    async def acknowledge_alert(request: AcknowledgeAlertRequest):
        """Acknowledge an alert"""
        try:
            result = ews_service.acknowledge_alert(
                alert_id=request.alertId,
                acknowledged_by=request.acknowledgedBy,
                notes=request.notes
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    uvicorn.run(app, host="0.0.0.0", port=8012)
