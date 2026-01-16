"""
Insurance Coding AI Service

Provides AI-powered assistance for medical coding:
- Code suggestions from clinical text
- Medical necessity validation
- Claim acceptance prediction
- Diagnosis extraction
"""

import json
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.openai_client import openai_manager, TaskComplexity
from shared.llm_provider import HospitalAIConfig
from .knowledge_base import knowledge_base, InsuranceCodingKnowledgeBase


@dataclass
class SuggestedCode:
    """Represents a suggested ICD-10 or CPT code"""
    code: str
    description: str
    confidence: float
    category: str
    reasoning: str
    is_primary: bool = False
    requires_pre_auth: bool = False
    supporting_documentation: List[str] = None

    def __post_init__(self):
        if self.supporting_documentation is None:
            self.supporting_documentation = []


@dataclass
class ValidationResult:
    """Result of code pair validation"""
    valid: bool
    score: float
    issues: List[str]
    suggestions: List[str]
    documentation_required: List[str]


@dataclass
class AcceptancePrediction:
    """Prediction of claim acceptance"""
    acceptance_probability: float
    risk_factors: List[Dict[str, Any]]
    recommendations: List[str]
    estimated_denial_reasons: List[str]


class InsuranceCodingAI:
    """
    AI service for insurance coding assistance.

    Provides:
    - ICD-10 and CPT code suggestions from clinical text
    - Medical necessity validation
    - Claim acceptance prediction
    - Code pair validation
    """

    def __init__(self):
        self.model_version = "1.0.0"
        self.kb = knowledge_base

    def suggest_codes(
        self,
        clinical_text: str,
        patient_context: Optional[Dict[str, Any]] = None,
        encounter_type: str = "outpatient",
        payer_id: Optional[str] = None,
        specialty: Optional[str] = None,
        hospital_config: Optional[HospitalAIConfig] = None
    ) -> Dict[str, Any]:
        """
        Suggest ICD-10 and CPT codes based on clinical text.

        Args:
            clinical_text: Clinical notes, assessment, or documentation
            patient_context: Optional patient demographics, history
            encounter_type: "outpatient", "inpatient", "emergency"
            payer_id: Optional payer for specific rules
            specialty: Medical specialty for focused suggestions
            hospital_config: Hospital AI configuration

        Returns:
            Dictionary with suggested ICD-10 codes, CPT codes, and reasoning
        """
        # Try AI-powered suggestion first
        try:
            ai_result = self._ai_suggest_codes(
                clinical_text, patient_context, encounter_type,
                specialty, hospital_config
            )
            if ai_result.get("success"):
                return self._enhance_with_rules(ai_result, payer_id)
        except Exception as e:
            print(f"AI code suggestion failed, falling back to rules: {e}")

        # Fallback to rule-based extraction
        return self._rule_based_suggest(clinical_text, patient_context, encounter_type, specialty)

    def _ai_suggest_codes(
        self,
        clinical_text: str,
        patient_context: Optional[Dict[str, Any]],
        encounter_type: str,
        specialty: Optional[str],
        hospital_config: Optional[HospitalAIConfig]
    ) -> Dict[str, Any]:
        """Use LLM to suggest codes from clinical text"""

        system_prompt = """You are an expert medical coder specializing in ICD-10-CM and CPT coding.
Your task is to analyze clinical documentation and suggest appropriate diagnosis and procedure codes.

Guidelines:
1. Suggest specific ICD-10 codes (not unspecified when more specific is documented)
2. Include all documented conditions (primary and secondary)
3. Suggest CPT codes that are medically necessary based on the documentation
4. Consider the encounter type when suggesting E/M codes
5. Identify procedures that may require pre-authorization

Return a JSON object with this structure:
{
    "icd10_codes": [
        {
            "code": "ICD-10 code",
            "description": "Code description",
            "confidence": 0.0-1.0,
            "is_primary": true/false,
            "reasoning": "Why this code applies"
        }
    ],
    "cpt_codes": [
        {
            "code": "CPT code",
            "description": "Code description",
            "confidence": 0.0-1.0,
            "category": "E&M/Laboratory/Radiology/Procedure",
            "reasoning": "Why this procedure/service is indicated"
        }
    ],
    "coding_notes": "Additional notes about the coding rationale",
    "missing_documentation": ["List of documentation gaps that affect coding"]
}"""

        user_prompt = f"""Analyze this clinical documentation and suggest appropriate ICD-10 and CPT codes.

Clinical Text:
{clinical_text}

Encounter Type: {encounter_type}
{f"Specialty: {specialty}" if specialty else ""}
{f"Patient Context: {json.dumps(patient_context)}" if patient_context else ""}

Please provide your code suggestions in the specified JSON format."""

        # Make LLM call
        result = openai_manager.chat_completion_json_with_config(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            hospital_config=hospital_config,
            task_complexity=TaskComplexity.COMPLEX,
            temperature=0.2,
            max_tokens=2000
        )

        if result.get("success") and result.get("data"):
            data = result["data"]
            return {
                "success": True,
                "icd10_codes": data.get("icd10_codes", []),
                "cpt_codes": data.get("cpt_codes", []),
                "coding_notes": data.get("coding_notes", ""),
                "missing_documentation": data.get("missing_documentation", []),
                "model": result.get("model"),
                "ai_powered": True
            }

        return {"success": False}

    def _enhance_with_rules(
        self,
        ai_result: Dict[str, Any],
        payer_id: Optional[str]
    ) -> Dict[str, Any]:
        """Enhance AI suggestions with rule-based validation"""

        icd_codes = ai_result.get("icd10_codes", [])
        cpt_codes = ai_result.get("cpt_codes", [])

        # Add pre-auth flags
        for cpt in cpt_codes:
            cpt["requires_pre_auth"] = self.kb.requires_pre_auth(cpt.get("code", ""))

        # Add validation scores for each ICD-CPT pair
        pair_validations = []
        for icd in icd_codes:
            for cpt in cpt_codes:
                validation = self.kb.validate_icd_cpt_pair(
                    icd.get("code", ""),
                    cpt.get("code", "")
                )
                if validation["score"] >= 0.5:
                    pair_validations.append({
                        "icd10": icd.get("code"),
                        "cpt": cpt.get("code"),
                        "validity_score": validation["score"],
                        "documentation_required": validation["documentation"]
                    })

        ai_result["validated_pairs"] = pair_validations
        return ai_result

    def _rule_based_suggest(
        self,
        clinical_text: str,
        patient_context: Optional[Dict[str, Any]],
        encounter_type: str,
        specialty: Optional[str]
    ) -> Dict[str, Any]:
        """Fallback rule-based code suggestion"""

        text_lower = clinical_text.lower()
        icd_codes = []
        cpt_codes = []

        # Simple keyword-based extraction
        keyword_mappings = {
            "hypertension": {"icd": "I10", "desc": "Essential hypertension"},
            "high blood pressure": {"icd": "I10", "desc": "Essential hypertension"},
            "diabetes": {"icd": "E11.9", "desc": "Type 2 diabetes mellitus"},
            "type 2 diabetes": {"icd": "E11.9", "desc": "Type 2 diabetes mellitus"},
            "asthma": {"icd": "J45.909", "desc": "Unspecified asthma"},
            "pneumonia": {"icd": "J18.9", "desc": "Pneumonia, unspecified"},
            "upper respiratory": {"icd": "J06.9", "desc": "Acute upper respiratory infection"},
            "common cold": {"icd": "J06.9", "desc": "Acute upper respiratory infection"},
            "back pain": {"icd": "M54.5", "desc": "Low back pain"},
            "low back pain": {"icd": "M54.5", "desc": "Low back pain"},
            "headache": {"icd": "R51.9", "desc": "Headache"},
            "chest pain": {"icd": "R07.9", "desc": "Chest pain, unspecified"},
            "abdominal pain": {"icd": "R10.9", "desc": "Unspecified abdominal pain"},
            "cough": {"icd": "R05.9", "desc": "Cough, unspecified"},
            "fatigue": {"icd": "R53.83", "desc": "Other fatigue"},
            "anxiety": {"icd": "F41.9", "desc": "Anxiety disorder, unspecified"},
            "depression": {"icd": "F32.9", "desc": "Major depressive disorder"},
        }

        added_icds = set()
        is_first = True
        for keyword, mapping in keyword_mappings.items():
            if keyword in text_lower and mapping["icd"] not in added_icds:
                icd_codes.append({
                    "code": mapping["icd"],
                    "description": mapping["desc"],
                    "confidence": 0.7,
                    "is_primary": is_first,
                    "reasoning": f"Keyword '{keyword}' found in clinical text"
                })
                added_icds.add(mapping["icd"])
                is_first = False

                # Add associated CPT codes from knowledge base
                cpt_mappings = self.kb.get_cpt_for_icd(mapping["icd"])
                for cpt_mapping in cpt_mappings[:2]:  # Limit to top 2
                    for code in cpt_mapping.cpt_codes[:1]:  # Take first CPT
                        cpt_codes.append({
                            "code": code,
                            "description": f"Associated with {mapping['icd']}",
                            "confidence": cpt_mapping.validity_score * 0.7,
                            "category": self.kb._get_cpt_category(code),
                            "reasoning": "Rule-based mapping from diagnosis"
                        })

        # Add E/M code based on encounter type
        em_codes = {
            "outpatient": {"code": "99214", "desc": "Office visit, established patient, moderate complexity"},
            "inpatient": {"code": "99223", "desc": "Initial hospital care, high complexity"},
            "emergency": {"code": "99284", "desc": "Emergency department visit, moderate severity"},
        }
        if encounter_type in em_codes:
            em = em_codes[encounter_type]
            cpt_codes.insert(0, {
                "code": em["code"],
                "description": em["desc"],
                "confidence": 0.6,
                "category": "E&M",
                "reasoning": f"Standard E/M code for {encounter_type} encounter"
            })

        return {
            "success": True,
            "icd10_codes": icd_codes,
            "cpt_codes": cpt_codes,
            "coding_notes": "Rule-based extraction - AI unavailable",
            "missing_documentation": [],
            "ai_powered": False,
            "validated_pairs": []
        }

    def validate_codes(
        self,
        icd10_codes: List[str],
        cpt_codes: List[str],
        payer_id: Optional[str] = None,
        patient_age: Optional[int] = None,
        patient_gender: Optional[str] = None,
        hospital_config: Optional[HospitalAIConfig] = None
    ) -> Dict[str, Any]:
        """
        Validate a set of ICD-10 and CPT codes for medical necessity.

        Args:
            icd10_codes: List of ICD-10 codes
            cpt_codes: List of CPT codes
            payer_id: Optional payer for specific rules
            patient_age: Patient age for age-specific validation
            patient_gender: Patient gender for gender-specific validation
            hospital_config: Hospital AI configuration

        Returns:
            Validation results with issues and suggestions
        """
        issues = []
        suggestions = []
        documentation_required = []
        overall_score = 1.0

        # Validate each ICD-CPT pair
        pair_results = []
        for icd in icd10_codes:
            for cpt in cpt_codes:
                result = self.kb.validate_icd_cpt_pair(icd, cpt)
                pair_results.append({
                    "icd10": icd,
                    "cpt": cpt,
                    "valid": result["valid"],
                    "score": result["score"],
                    "documentation": result["documentation"]
                })

                if not result["valid"]:
                    issues.append(f"ICD-10 {icd} may not support CPT {cpt}")
                    overall_score *= 0.8

                documentation_required.extend(result["documentation"])

        # Check for pre-auth requirements
        pre_auth_needed = []
        for cpt in cpt_codes:
            if self.kb.requires_pre_auth(cpt):
                pre_auth_needed.append(cpt)
                suggestions.append(f"CPT {cpt} requires pre-authorization")

        # Check for specificity issues
        for icd in icd10_codes:
            if icd.endswith("9") and len(icd) <= 5:
                suggestions.append(f"Consider more specific code for {icd}")
                overall_score *= 0.95

        # Try AI-enhanced validation if available
        try:
            ai_validation = self._ai_validate_codes(
                icd10_codes, cpt_codes, patient_age, patient_gender, hospital_config
            )
            if ai_validation.get("success"):
                issues.extend(ai_validation.get("issues", []))
                suggestions.extend(ai_validation.get("suggestions", []))
        except Exception as e:
            print(f"AI validation failed: {e}")

        return {
            "valid": overall_score >= 0.5,
            "overall_score": overall_score,
            "pair_validations": pair_results,
            "issues": list(set(issues)),
            "suggestions": list(set(suggestions)),
            "documentation_required": list(set(documentation_required)),
            "pre_auth_required": pre_auth_needed,
            "model_version": self.model_version
        }

    def _ai_validate_codes(
        self,
        icd10_codes: List[str],
        cpt_codes: List[str],
        patient_age: Optional[int],
        patient_gender: Optional[str],
        hospital_config: Optional[HospitalAIConfig]
    ) -> Dict[str, Any]:
        """Use LLM for enhanced validation"""

        system_prompt = """You are a medical coding compliance expert.
Review the provided ICD-10 and CPT code combinations for medical necessity and coding accuracy.

Identify:
1. Coding errors or inconsistencies
2. Missing documentation requirements
3. Potential denial risks
4. Opportunities for more specific codes

Return a JSON object:
{
    "issues": ["List of identified issues"],
    "suggestions": ["List of improvement suggestions"],
    "compliance_notes": "Overall compliance assessment"
}"""

        user_prompt = f"""Review these codes for compliance and medical necessity:

ICD-10 Codes: {', '.join(icd10_codes)}
CPT Codes: {', '.join(cpt_codes)}
{f"Patient Age: {patient_age}" if patient_age else ""}
{f"Patient Gender: {patient_gender}" if patient_gender else ""}

Provide your analysis in JSON format."""

        result = openai_manager.chat_completion_json_with_config(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            hospital_config=hospital_config,
            task_complexity=TaskComplexity.SIMPLE,
            temperature=0.1,
            max_tokens=1000
        )

        if result.get("success") and result.get("data"):
            return {"success": True, **result["data"]}
        return {"success": False}

    def predict_acceptance(
        self,
        icd10_codes: List[str],
        cpt_codes: List[str],
        payer_id: Optional[str] = None,
        documentation_score: float = 0.8,
        prior_auth_obtained: bool = False,
        patient_context: Optional[Dict[str, Any]] = None,
        hospital_config: Optional[HospitalAIConfig] = None
    ) -> Dict[str, Any]:
        """
        Predict the probability of claim acceptance.

        Args:
            icd10_codes: List of ICD-10 codes
            cpt_codes: List of CPT codes
            payer_id: Payer identifier
            documentation_score: Quality score of documentation (0-1)
            prior_auth_obtained: Whether prior auth was obtained
            patient_context: Additional patient information
            hospital_config: Hospital AI configuration

        Returns:
            Acceptance probability with risk factors and recommendations
        """
        risk_factors = []
        recommendations = []
        estimated_denials = []
        base_probability = 0.85

        # Factor 1: Code validation
        validation = self.validate_codes(icd10_codes, cpt_codes)
        if not validation["valid"]:
            base_probability *= 0.7
            risk_factors.append({
                "factor": "Code validation issues",
                "impact": -0.15,
                "details": validation["issues"][:3]
            })
            estimated_denials.append("CO-11: Diagnosis inconsistent with procedure")

        # Factor 2: Pre-authorization
        pre_auth_needed = validation.get("pre_auth_required", [])
        if pre_auth_needed and not prior_auth_obtained:
            base_probability *= 0.5
            risk_factors.append({
                "factor": "Missing pre-authorization",
                "impact": -0.25,
                "details": [f"Pre-auth required for: {', '.join(pre_auth_needed)}"]
            })
            recommendations.append("Obtain prior authorization before claim submission")
            estimated_denials.append("CO-151: Prior authorization required but not obtained")

        # Factor 3: Documentation quality
        if documentation_score < 0.6:
            base_probability *= 0.8
            risk_factors.append({
                "factor": "Low documentation score",
                "impact": -0.10,
                "details": ["Documentation may not support medical necessity"]
            })
            recommendations.append("Ensure complete clinical documentation")
            estimated_denials.append("CO-16: Claim lacks information needed for adjudication")

        # Factor 4: Code specificity
        unspecified_codes = [c for c in icd10_codes if c.endswith("9") and len(c) <= 5]
        if unspecified_codes:
            base_probability *= 0.95
            risk_factors.append({
                "factor": "Unspecified diagnosis codes",
                "impact": -0.05,
                "details": [f"Consider more specific codes: {', '.join(unspecified_codes)}"]
            })
            recommendations.append("Use most specific ICD-10 codes available")

        # Factor 5: Multiple procedures
        if len(cpt_codes) > 3:
            base_probability *= 0.9
            risk_factors.append({
                "factor": "Multiple procedures",
                "impact": -0.05,
                "details": ["Multiple procedures may require modifier 59 or XE/XS/XP/XU"]
            })
            recommendations.append("Verify bundling rules and apply appropriate modifiers")
            estimated_denials.append("CO-97: Payment adjusted due to bundling")

        # Try AI prediction for more nuanced assessment
        try:
            ai_prediction = self._ai_predict_acceptance(
                icd10_codes, cpt_codes, documentation_score,
                prior_auth_obtained, hospital_config
            )
            if ai_prediction.get("success"):
                # Blend AI prediction with rule-based
                ai_prob = ai_prediction.get("probability", 0.5)
                base_probability = (base_probability * 0.6) + (ai_prob * 0.4)
                risk_factors.extend(ai_prediction.get("risk_factors", []))
                recommendations.extend(ai_prediction.get("recommendations", []))
        except Exception as e:
            print(f"AI prediction failed: {e}")

        # Ensure probability is in valid range
        final_probability = max(0.05, min(0.99, base_probability))

        return {
            "acceptance_probability": round(final_probability, 3),
            "risk_level": "low" if final_probability > 0.8 else "medium" if final_probability > 0.6 else "high",
            "risk_factors": risk_factors,
            "recommendations": list(set(recommendations)),
            "estimated_denial_reasons": list(set(estimated_denials)),
            "validation_summary": {
                "codes_validated": validation["valid"],
                "documentation_score": documentation_score,
                "prior_auth_status": "obtained" if prior_auth_obtained else "not_obtained"
            },
            "model_version": self.model_version
        }

    def _ai_predict_acceptance(
        self,
        icd10_codes: List[str],
        cpt_codes: List[str],
        documentation_score: float,
        prior_auth_obtained: bool,
        hospital_config: Optional[HospitalAIConfig]
    ) -> Dict[str, Any]:
        """Use LLM for enhanced acceptance prediction"""

        system_prompt = """You are an insurance claims processing expert.
Analyze the provided claim information and predict acceptance likelihood.

Consider:
1. Medical necessity of diagnoses supporting procedures
2. Common payer denial patterns
3. Documentation requirements
4. Prior authorization needs

Return a JSON object:
{
    "probability": 0.0-1.0,
    "risk_factors": [{"factor": "...", "impact": -0.1}],
    "recommendations": ["..."]
}"""

        user_prompt = f"""Predict acceptance for this claim:

ICD-10: {', '.join(icd10_codes)}
CPT: {', '.join(cpt_codes)}
Documentation Score: {documentation_score}
Prior Auth: {"Yes" if prior_auth_obtained else "No"}

Provide your prediction in JSON format."""

        result = openai_manager.chat_completion_json_with_config(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            hospital_config=hospital_config,
            task_complexity=TaskComplexity.SIMPLE,
            temperature=0.2,
            max_tokens=800
        )

        if result.get("success") and result.get("data"):
            return {"success": True, **result["data"]}
        return {"success": False}

    def extract_diagnoses_from_text(
        self,
        clinical_text: str,
        extract_procedures: bool = True,
        hospital_config: Optional[HospitalAIConfig] = None
    ) -> Dict[str, Any]:
        """
        Extract diagnoses and optionally procedures from clinical text.

        Args:
            clinical_text: Clinical notes or documentation
            extract_procedures: Whether to also extract procedures
            hospital_config: Hospital AI configuration

        Returns:
            Extracted diagnoses and procedures with supporting text
        """
        # Try AI extraction first
        try:
            ai_result = self._ai_extract_diagnoses(
                clinical_text, extract_procedures, hospital_config
            )
            if ai_result.get("success"):
                return ai_result
        except Exception as e:
            print(f"AI extraction failed: {e}")

        # Fallback to rule-based extraction
        return self._rule_based_extract(clinical_text, extract_procedures)

    def _ai_extract_diagnoses(
        self,
        clinical_text: str,
        extract_procedures: bool,
        hospital_config: Optional[HospitalAIConfig]
    ) -> Dict[str, Any]:
        """Use LLM to extract diagnoses from text"""

        system_prompt = """You are a medical information extraction specialist.
Extract all diagnoses (and optionally procedures) from clinical text.

For each diagnosis, identify:
1. The condition name
2. Relevant ICD-10 code
3. The text snippet that supports this diagnosis
4. Confidence level

Return a JSON object:
{
    "diagnoses": [
        {
            "condition": "Condition name",
            "icd10_code": "ICD-10 code",
            "supporting_text": "Quote from clinical text",
            "confidence": 0.0-1.0,
            "is_primary": true/false
        }
    ],
    "procedures": [
        {
            "procedure": "Procedure name",
            "cpt_code": "CPT code",
            "supporting_text": "Quote from clinical text",
            "confidence": 0.0-1.0
        }
    ]
}"""

        user_prompt = f"""Extract diagnoses{" and procedures" if extract_procedures else ""} from this clinical text:

{clinical_text}

Return the extracted information in JSON format."""

        result = openai_manager.chat_completion_json_with_config(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            hospital_config=hospital_config,
            task_complexity=TaskComplexity.COMPLEX,
            temperature=0.1,
            max_tokens=1500
        )

        if result.get("success") and result.get("data"):
            data = result["data"]
            return {
                "success": True,
                "diagnoses": data.get("diagnoses", []),
                "procedures": data.get("procedures", []) if extract_procedures else [],
                "ai_powered": True,
                "model": result.get("model")
            }

        return {"success": False}

    def _rule_based_extract(
        self,
        clinical_text: str,
        extract_procedures: bool
    ) -> Dict[str, Any]:
        """Fallback rule-based extraction"""

        text_lower = clinical_text.lower()
        diagnoses = []
        procedures = []

        # Diagnosis patterns
        diagnosis_patterns = [
            (r"diagnos(?:is|ed|es):\s*(.+?)(?:\.|$)", 0.9),
            (r"assessment:\s*(.+?)(?:\.|$)", 0.85),
            (r"impression:\s*(.+?)(?:\.|$)", 0.85),
            (r"patient (?:has|with|presents with)\s+(.+?)(?:\.|,|$)", 0.7),
        ]

        for pattern, confidence in diagnosis_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                # Clean and add
                condition = match.strip()
                if len(condition) > 3 and len(condition) < 100:
                    diagnoses.append({
                        "condition": condition.title(),
                        "icd10_code": None,
                        "supporting_text": match,
                        "confidence": confidence,
                        "is_primary": len(diagnoses) == 0
                    })

        if extract_procedures:
            # Procedure patterns
            procedure_patterns = [
                (r"performed?\s+(.+?)(?:\.|$)", 0.8),
                (r"procedure:\s*(.+?)(?:\.|$)", 0.9),
                (r"(?:lab|imaging|test)(?:s)?:\s*(.+?)(?:\.|$)", 0.75),
            ]

            for pattern, confidence in procedure_patterns:
                matches = re.findall(pattern, text_lower, re.IGNORECASE)
                for match in matches:
                    procedure = match.strip()
                    if len(procedure) > 3 and len(procedure) < 100:
                        procedures.append({
                            "procedure": procedure.title(),
                            "cpt_code": None,
                            "supporting_text": match,
                            "confidence": confidence
                        })

        return {
            "success": True,
            "diagnoses": diagnoses,
            "procedures": procedures if extract_procedures else [],
            "ai_powered": False,
            "model": None
        }

    def check_medical_necessity(
        self,
        icd10_codes: List[str],
        cpt_codes: List[str],
        clinical_notes: Optional[str] = None,
        hospital_config: Optional[HospitalAIConfig] = None
    ) -> Dict[str, Any]:
        """
        Check if procedures are medically necessary given diagnoses.

        Args:
            icd10_codes: List of diagnosis codes
            cpt_codes: List of procedure codes
            clinical_notes: Optional clinical documentation
            hospital_config: Hospital AI configuration

        Returns:
            Medical necessity assessment with documentation requirements
        """
        results = []
        overall_necessity_score = 1.0
        missing_documentation = []

        for cpt in cpt_codes:
            cpt_result = {
                "cpt_code": cpt,
                "supporting_diagnoses": [],
                "necessity_score": 0,
                "documentation_required": [],
                "is_medically_necessary": False
            }

            for icd in icd10_codes:
                validation = self.kb.validate_icd_cpt_pair(icd, cpt)
                if validation["score"] >= 0.5:
                    cpt_result["supporting_diagnoses"].append({
                        "icd10": icd,
                        "score": validation["score"],
                        "is_required": validation["is_required"]
                    })
                    cpt_result["necessity_score"] = max(
                        cpt_result["necessity_score"],
                        validation["score"]
                    )
                    cpt_result["documentation_required"].extend(
                        validation["documentation"]
                    )

            cpt_result["is_medically_necessary"] = cpt_result["necessity_score"] >= 0.5
            cpt_result["documentation_required"] = list(set(cpt_result["documentation_required"]))

            if not cpt_result["is_medically_necessary"]:
                overall_necessity_score *= 0.8
                missing_documentation.append(
                    f"Medical necessity documentation needed for CPT {cpt}"
                )

            results.append(cpt_result)

        # Try AI enhancement if clinical notes provided
        ai_notes = None
        if clinical_notes:
            try:
                ai_result = self._ai_check_necessity(
                    icd10_codes, cpt_codes, clinical_notes, hospital_config
                )
                if ai_result.get("success"):
                    ai_notes = ai_result.get("analysis")
            except Exception as e:
                print(f"AI necessity check failed: {e}")

        return {
            "overall_necessity_score": round(overall_necessity_score, 3),
            "is_medically_necessary": overall_necessity_score >= 0.6,
            "procedure_assessments": results,
            "missing_documentation": missing_documentation,
            "ai_analysis": ai_notes,
            "model_version": self.model_version
        }

    def _ai_check_necessity(
        self,
        icd10_codes: List[str],
        cpt_codes: List[str],
        clinical_notes: str,
        hospital_config: Optional[HospitalAIConfig]
    ) -> Dict[str, Any]:
        """Use LLM for enhanced medical necessity check"""

        system_prompt = """You are a medical necessity reviewer.
Analyze if the documented clinical findings support the medical necessity
of the proposed procedures.

Consider:
1. Does the clinical documentation support the diagnoses?
2. Are the procedures appropriate for the documented conditions?
3. What additional documentation would strengthen the claim?

Return a JSON object:
{
    "analysis": "Brief medical necessity assessment",
    "supports_necessity": true/false,
    "documentation_gaps": ["List of missing documentation"]
}"""

        user_prompt = f"""Review medical necessity:

Diagnoses (ICD-10): {', '.join(icd10_codes)}
Procedures (CPT): {', '.join(cpt_codes)}

Clinical Notes:
{clinical_notes}

Provide your assessment in JSON format."""

        result = openai_manager.chat_completion_json_with_config(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            hospital_config=hospital_config,
            task_complexity=TaskComplexity.SIMPLE,
            temperature=0.1,
            max_tokens=800
        )

        if result.get("success") and result.get("data"):
            return {"success": True, **result["data"]}
        return {"success": False}

    def get_denial_resolution(self, denial_code: str) -> Dict[str, Any]:
        """Get resolution guidance for a denial code"""
        denial = self.kb.get_denial_resolution(denial_code)
        if denial:
            return {
                "found": True,
                "code": denial.code,
                "description": denial.description,
                "resolution_steps": denial.resolution_steps
            }
        return {
            "found": False,
            "code": denial_code,
            "description": "Unknown denial code",
            "resolution_steps": [
                "Contact payer for specific denial reason",
                "Review claim for common issues",
                "Consider requesting a review"
            ]
        }

    def get_modifier_guidance(self, modifier: str) -> Dict[str, Any]:
        """Get guidance for using a specific modifier"""
        guidance = self.kb.get_modifier_guidance(modifier)
        if guidance:
            return {"found": True, **guidance}
        return {
            "found": False,
            "modifier": modifier,
            "description": "Unknown modifier",
            "rules": ["Consult CPT manual for modifier guidelines"]
        }


# Singleton instance
insurance_coding_ai = InsuranceCodingAI()
